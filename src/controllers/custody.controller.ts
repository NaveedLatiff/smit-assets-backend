import { Request, Response, NextFunction } from 'express';
import { Asset } from '../models/Asset';
import { User } from '../models/User';
import { AssetHistory, AssetHistoryAction } from '../models/AssetHistory';
import { AssetCondition, AssetStatus } from '../constants/enums';
import { assignAssetSchema, returnAssetSchema } from '../validators/custody.validator';

/**
 * Assign an asset to an employee
 * POST /api/custody/assign
 */
export const assignAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = assignAssetSchema.parse(req.body);

    const asset = await Asset.findOne({ _id: input.assetId, isDeleted: false });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    // Verify campus authority if not global scope
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((id) => id.toString());
      if (!authorizedCampusIds.includes(asset.location.campusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over the campus where this asset is located.',
        });
        return;
      }
    }

    // Check current asset status
    if (asset.status === AssetStatus.ASSIGNED || asset.assignedTo?.userId) {
      res.status(400).json({
        success: false,
        message: `Asset is already assigned to a user. Please return it before reassigning.`,
      });
      return;
    }

    if (asset.status === AssetStatus.IN_TRANSIT) {
      res.status(400).json({
        success: false,
        message: 'Cannot assign asset while it is in transit between branches.',
      });
      return;
    }

    if (
      asset.status === AssetStatus.IN_MAINTENANCE ||
      asset.status === AssetStatus.UNDER_REPAIR ||
      asset.status === AssetStatus.DECOMMISSIONED ||
      asset.status === AssetStatus.LOST_STOLEN
    ) {
      res.status(400).json({
        success: false,
        message: `Cannot assign asset with status '${asset.status}'. It must be AVAILABLE.`,
      });
      return;
    }

    // Verify target employee exists and is active
    const targetUser = await User.findById(input.userId);
    if (!targetUser || !targetUser.isActive) {
      res.status(404).json({
        success: false,
        message: 'Target employee not found or account is deactivated.',
      });
      return;
    }

    // Snapshot previous values for audit history
    const previousStatus = asset.status;
    const previousAssignedTo = asset.assignedTo;

    // Update asset
    asset.status = AssetStatus.ASSIGNED;
    asset.assignedTo = {
      userId: targetUser._id as any,
      assignedAt: new Date(),
      expectedReturnDate: input.expectedReturnDate ? new Date(input.expectedReturnDate) : undefined,
      remarks: input.remarks,
    };
    asset.updatedBy = req.user!._id as any;
    await asset.save();

    // Log to AssetHistory
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.ASSIGNED,
      performedBy: req.user!._id,
      performedByName: req.user!.name,
      previousValues: {
        status: previousStatus,
        assignedTo: previousAssignedTo || null,
      },
      newValues: {
        status: AssetStatus.ASSIGNED,
        assignedTo: {
          userId: targetUser._id,
          userName: targetUser.name,
          userEmail: targetUser.email,
          assignedAt: asset.assignedTo.assignedAt,
          expectedReturnDate: asset.assignedTo.expectedReturnDate,
        },
      },
      remarks: input.remarks || `Assigned to ${targetUser.name} (${targetUser.email})`,
    });

    const populatedAsset = await Asset.findById(asset._id)
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .populate('assignedTo.userId', 'name email designation department phone');

    res.status(200).json({
      success: true,
      message: `Asset ${asset.assetTag} successfully assigned to ${targetUser.name}.`,
      data: populatedAsset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Return an assigned asset back to branch stock/storage
 * POST /api/custody/return
 */
export const returnAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = returnAssetSchema.parse(req.body);

    const asset = await Asset.findOne({ _id: input.assetId, isDeleted: false });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    // Verify campus authority if not global scope
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((id) => id.toString());
      if (!authorizedCampusIds.includes(asset.location.campusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over the campus where this asset is located.',
        });
        return;
      }
    }

    // Check if asset is actually assigned
    if (!asset.assignedTo || !asset.assignedTo.userId) {
      res.status(400).json({
        success: false,
        message: 'Asset is not currently assigned to any employee.',
      });
      return;
    }

    // Determine return condition and resulting status
    const returnCondition = input.condition || asset.condition;
    const newStatus =
      returnCondition === AssetCondition.DAMAGED
        ? AssetStatus.IN_MAINTENANCE
        : AssetStatus.AVAILABLE;

    const previousStatus = asset.status;
    const previousCondition = asset.condition;
    const previousLocation = { campusId: asset.location.campusId };
    const previousAssignedTo = asset.assignedTo
      ? {
          userId: asset.assignedTo.userId,
          assignedAt: asset.assignedTo.assignedAt,
          expectedReturnDate: asset.assignedTo.expectedReturnDate,
          remarks: asset.assignedTo.remarks,
        }
      : null;

    // Update asset
    asset.status = newStatus;
    asset.condition = returnCondition;
    asset.assignedTo = undefined;
    asset.updatedBy = req.user!._id as any;
    await asset.save();

    // Log to AssetHistory
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.UNASSIGNED,
      performedBy: req.user!._id,
      performedByName: req.user!.name,
      previousValues: {
        status: previousStatus,
        condition: previousCondition,
        location: previousLocation,
        assignedTo: previousAssignedTo,
      },
      newValues: {
        status: newStatus,
        condition: returnCondition,
        location: {
          campusId: asset.location.campusId,
        },
        assignedTo: null,
      },
      remarks: input.remarks || `Returned to campus stock in condition: ${returnCondition}`,
    });

    const populatedAsset = await Asset.findById(asset._id)
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city');

    res.status(200).json({
      success: true,
      message: `Asset ${asset.assetTag} successfully returned to campus stock.`,
      data: populatedAsset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all assets currently assigned to the logged-in employee
 * GET /api/custody/my-assets
 */
export const getMyAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;

    const assets = await Asset.find({
      'assignedTo.userId': userId,
      isDeleted: false,
    })
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .sort({ 'assignedTo.assignedAt': -1 });

    res.status(200).json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    next(error);
  }
};
