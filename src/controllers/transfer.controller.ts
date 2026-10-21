import { Request, Response, NextFunction } from 'express';
import { Asset } from '../models/Asset';
import { Campus } from '../models/Campus';
import { AssetTransfer } from '../models/AssetTransfer';
import { AssetHistory, AssetHistoryAction } from '../models/AssetHistory';
import { AssetStatus, TransferStatus } from '../constants/enums';
import {
  requestTransferSchema,
  approveTransferSchema,
  dispatchTransferSchema,
  receiveTransferSchema,
  queryTransferSchema,
} from '../validators/transfer.validator';

/**
 * Request an inter-branch transfer of an asset
 * POST /api/transfers
 */
export const requestTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const input = requestTransferSchema.parse(req.body);

    const asset = await Asset.findOne({ _id: input.assetId, isDeleted: false });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    const fromCampusId = asset.location.campusId;

    // Check authority over origin campus if not global scope
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((id) => id.toString());
      if (!authorizedCampusIds.includes(fromCampusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over the origin campus of this asset.',
        });
        return;
      }
    }

    // Check asset assignment status: must be returned before transfer
    if (asset.assignedTo?.userId || asset.status === AssetStatus.ASSIGNED) {
      res.status(400).json({
        success: false,
        message: 'Cannot transfer an asset that is currently assigned to an employee. Please return/check it in first.',
      });
      return;
    }

    // Check if asset is already in transit
    if (asset.status === AssetStatus.IN_TRANSIT) {
      res.status(400).json({
        success: false,
        message: 'Asset is already in transit between branches.',
      });
      return;
    }

    // Check if destination campus is different from origin campus
    if (fromCampusId.toString() === input.toCampusId) {
      res.status(400).json({
        success: false,
        message: 'Destination campus must be different from the origin campus for an inter-branch transfer.',
      });
      return;
    }

    // Check if an active transfer request already exists for this asset
    const activeTransfer = await AssetTransfer.findOne({
      assetId: asset._id,
      status: { $in: [TransferStatus.PENDING, TransferStatus.APPROVED, TransferStatus.DISPATCHED] },
    });
    if (activeTransfer) {
      res.status(400).json({
        success: false,
        message: `An active transfer (${activeTransfer.transferNumber}) is already in progress for this asset.`,
      });
      return;
    }

    // Verify destination campus exists and is active
    const destCampus = await Campus.findOne({ _id: input.toCampusId, isActive: true });
    if (!destCampus) {
      res.status(404).json({ success: false, message: 'Destination campus not found or inactive.' });
      return;
    }

    // Create Transfer record
    const transfer = await AssetTransfer.create({
      assetId: asset._id,
      fromCampusId,
      toCampusId: destCampus._id,
      status: TransferStatus.PENDING,
      reason: input.reason,
      notes: input.notes,
      requestedBy: req.user!._id,
      requestedAt: new Date(),
    });

    // Log to AssetHistory
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.TRANSFER_REQUESTED,
      performedBy: req.user!._id,
      performedByName: req.user!.name,
      newValues: {
        transferNumber: transfer.transferNumber,
        fromCampusId,
        toCampusId: destCampus._id,
        reason: input.reason,
      },
      remarks: `Transfer requested to ${destCampus.name}: ${input.reason}`,
    });

    const populatedTransfer = await AssetTransfer.findById(transfer._id)
      .populate('assetId', 'assetTag name brand modelNumber')
      .populate('fromCampusId', 'name code city')
      .populate('toCampusId', 'name code city')
      .populate('requestedBy', 'name email');

    res.status(201).json({
      success: true,
      message: `Transfer request ${transfer.transferNumber} created successfully.`,
      data: populatedTransfer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or Reject an asset transfer request
 * PUT /api/transfers/:id/approve
 */
export const approveTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = approveTransferSchema.parse(req.body);

    const transfer = await AssetTransfer.findById(id);
    if (!transfer) {
      res.status(404).json({ success: false, message: 'Transfer request not found.' });
      return;
    }

    if (transfer.status !== TransferStatus.PENDING) {
      res.status(400).json({
        success: false,
        message: `Cannot approve or reject a transfer that is in '${transfer.status}' status.`,
      });
      return;
    }

    // Campus authority check: user must have authority over origin OR destination campus (or global scope)
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((cId) => cId.toString());
      const hasOriginAccess = authorizedCampusIds.includes(transfer.fromCampusId.toString());
      const hasDestAccess = authorizedCampusIds.includes(transfer.toCampusId.toString());

      if (!hasOriginAccess && !hasDestAccess) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over the origin or destination campus.',
        });
        return;
      }
    }

    if (input.action === 'APPROVE') {
      transfer.status = TransferStatus.APPROVED;
      transfer.approvedBy = req.user!._id as any;
      transfer.approvedAt = new Date();
      if (input.notes) transfer.notes = `${transfer.notes || ''}\nApproval Note: ${input.notes}`.trim();
      await transfer.save();

      await AssetHistory.create({
        assetId: transfer.assetId,
        action: AssetHistoryAction.TRANSFER_APPROVED,
        performedBy: req.user!._id,
        performedByName: req.user!.name,
        newValues: {
          transferNumber: transfer.transferNumber,
          status: TransferStatus.APPROVED,
        },
        remarks: `Transfer ${transfer.transferNumber} approved by ${req.user!.name}`,
      });
    } else {
      transfer.status = TransferStatus.REJECTED;
      transfer.approvedBy = req.user!._id as any;
      transfer.approvedAt = new Date();
      transfer.rejectionReason = input.rejectionReason;
      if (input.notes) transfer.notes = `${transfer.notes || ''}\nRejection Note: ${input.notes}`.trim();
      await transfer.save();

      await AssetHistory.create({
        assetId: transfer.assetId,
        action: AssetHistoryAction.TRANSFER_REJECTED,
        performedBy: req.user!._id,
        performedByName: req.user!.name,
        newValues: {
          transferNumber: transfer.transferNumber,
          status: TransferStatus.REJECTED,
          rejectionReason: input.rejectionReason,
        },
        remarks: `Transfer ${transfer.transferNumber} rejected: ${input.rejectionReason}`,
      });
    }

    const populatedTransfer = await AssetTransfer.findById(transfer._id)
      .populate('assetId', 'assetTag name brand modelNumber')
      .populate('fromCampusId', 'name code city')
      .populate('toCampusId', 'name code city')
      .populate('requestedBy', 'name email')
      .populate('approvedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Transfer ${transfer.transferNumber} ${input.action.toLowerCase()}d successfully.`,
      data: populatedTransfer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a transfer as dispatched / in-transit
 * PUT /api/transfers/:id/dispatch
 */
export const dispatchTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = dispatchTransferSchema.parse(req.body);

    const transfer = await AssetTransfer.findById(id);
    if (!transfer) {
      res.status(404).json({ success: false, message: 'Transfer request not found.' });
      return;
    }

    if (transfer.status !== TransferStatus.APPROVED) {
      res.status(400).json({
        success: false,
        message: `Transfer must be in APPROVED status to dispatch. Current status: '${transfer.status}'.`,
      });
      return;
    }

    // Origin campus check: user dispatching must have authority over origin campus
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((cId) => cId.toString());
      if (!authorizedCampusIds.includes(transfer.fromCampusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority to dispatch assets from the origin campus.',
        });
        return;
      }
    }

    const asset = await Asset.findById(transfer.assetId);
    if (!asset || asset.isDeleted) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    // Update Asset status to IN_TRANSIT
    const previousAssetStatus = asset.status;
    asset.status = AssetStatus.IN_TRANSIT;
    asset.updatedBy = req.user!._id as any;
    await asset.save();

    // Update Transfer
    transfer.status = TransferStatus.DISPATCHED;
    transfer.dispatchedBy = req.user!._id as any;
    transfer.dispatchedAt = new Date();
    transfer.dispatchNotes = input.dispatchNotes;
    await transfer.save();

    // Log to AssetHistory
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.TRANSFER_DISPATCHED,
      performedBy: req.user!._id,
      performedByName: req.user!.name,
      previousValues: { status: previousAssetStatus },
      newValues: {
        status: AssetStatus.IN_TRANSIT,
        transferNumber: transfer.transferNumber,
        dispatchNotes: input.dispatchNotes,
      },
      remarks: `Dispatched from origin campus for transfer ${transfer.transferNumber}. Note: ${input.dispatchNotes || 'None'}`,
    });

    const populatedTransfer = await AssetTransfer.findById(transfer._id)
      .populate('assetId', 'assetTag name status brand modelNumber')
      .populate('fromCampusId', 'name code city')
      .populate('toCampusId', 'name code city')
      .populate('dispatchedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Asset ${asset.assetTag} successfully dispatched for transfer ${transfer.transferNumber}.`,
      data: populatedTransfer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm receipt of an asset at the destination campus
 * PUT /api/transfers/:id/receive
 */
export const receiveTransfer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const input = receiveTransferSchema.parse(req.body);

    const transfer = await AssetTransfer.findById(id);
    if (!transfer) {
      res.status(404).json({ success: false, message: 'Transfer request not found.' });
      return;
    }

    if (transfer.status !== TransferStatus.DISPATCHED) {
      res.status(400).json({
        success: false,
        message: `Transfer must be in DISPATCHED status to receive. Current status: '${transfer.status}'.`,
      });
      return;
    }

    // Destination campus check: receiving user must have authority over destination campus
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((cId) => cId.toString());
      if (!authorizedCampusIds.includes(transfer.toCampusId.toString())) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority to receive assets at the destination campus.',
        });
        return;
      }
    }

    const asset = await Asset.findById(transfer.assetId);
    if (!asset || asset.isDeleted) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    const previousLocation = { campusId: asset.location.campusId };
    const previousStatus = asset.status;
    const previousCondition = asset.condition;

    // Update Asset location and status
    asset.location = {
      campusId: transfer.toCampusId,
    };
    asset.status = AssetStatus.AVAILABLE;
    if (input.receivingCondition) {
      asset.condition = input.receivingCondition;
    }
    asset.updatedBy = req.user!._id as any;
    await asset.save();

    // Update Transfer
    transfer.status = TransferStatus.COMPLETED;
    transfer.receivedBy = req.user!._id as any;
    transfer.receivedAt = new Date();
    transfer.receivingCondition = input.receivingCondition;
    transfer.receivingNotes = input.receivingNotes;
    await transfer.save();

    // Log to AssetHistory
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.TRANSFER_RECEIVED,
      performedBy: req.user!._id,
      performedByName: req.user!.name,
      previousValues: {
        location: previousLocation,
        status: previousStatus,
        condition: previousCondition,
      },
      newValues: {
        location: asset.location,
        status: asset.status,
        condition: asset.condition,
        transferNumber: transfer.transferNumber,
      },
      remarks: `Asset received at destination campus via transfer ${transfer.transferNumber}. Condition: ${asset.condition}`,
    });

    const populatedTransfer = await AssetTransfer.findById(transfer._id)
      .populate('assetId', 'assetTag name status condition location brand modelNumber')
      .populate('fromCampusId', 'name code city')
      .populate('toCampusId', 'name code city')
      .populate('receivedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Asset ${asset.assetTag} successfully received at destination campus and updated to AVAILABLE.`,
      data: populatedTransfer,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List transfers with filters and campus scoping
 * GET /api/transfers
 */
export const listTransfers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const query = queryTransferSchema.parse(req.query);

    const filter: Record<string, any> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.assetId) {
      filter.assetId = query.assetId;
    }

    // Apply campus scoping
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = req.user?.campusScope || [];
      filter.$or = [
        { fromCampusId: { $in: authorizedCampusIds } },
        { toCampusId: { $in: authorizedCampusIds } },
      ];
    } else if (query.campusId) {
      filter.$or = [
        { fromCampusId: query.campusId },
        { toCampusId: query.campusId },
      ];
    }

    const skip = (query.page - 1) * query.limit;

    const [transfers, totalCount] = await Promise.all([
      AssetTransfer.find(filter)
        .populate('assetId', 'assetTag name brand modelNumber serialNumber')
        .populate('fromCampusId', 'name code city')
        .populate('toCampusId', 'name code city')
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('dispatchedBy', 'name email')
        .populate('receivedBy', 'name email')
        .sort({ [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(query.limit),
      AssetTransfer.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: transfers,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalCount,
        totalPages: Math.ceil(totalCount / query.limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transfer details by ID
 * GET /api/transfers/:id
 */
export const getTransferById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await AssetTransfer.findById(id)
      .populate('assetId')
      .populate('fromCampusId', 'name code city address')
      .populate('toCampusId', 'name code city address')
      .populate('requestedBy', 'name email phone designation')
      .populate('approvedBy', 'name email phone designation')
      .populate('dispatchedBy', 'name email phone designation')
      .populate('receivedBy', 'name email phone designation');

    if (!transfer) {
      res.status(404).json({ success: false, message: 'Transfer request not found.' });
      return;
    }

    // Campus authority check if not global scope
    if (!req.user?.isGlobalScope) {
      const authorizedCampusIds = (req.user?.campusScope || []).map((cId) => cId.toString());
      const hasOrigin = authorizedCampusIds.includes(transfer.fromCampusId._id.toString());
      const hasDest = authorizedCampusIds.includes(transfer.toCampusId._id.toString());
      if (!hasOrigin && !hasDest) {
        res.status(403).json({
          success: false,
          message: 'Access denied: You do not have authority over this transfer.',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    next(error);
  }
};
