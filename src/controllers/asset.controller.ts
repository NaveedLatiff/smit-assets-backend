import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Asset, IAsset } from '../models/Asset';
import { AssetCategory } from '../models/AssetCategory';
import { Campus } from '../models/Campus';
import { Building } from '../models/Building';
import { Room } from '../models/Room';
import { AssetHistory, AssetHistoryAction } from '../models/AssetHistory';
import { getNextSequentialTag } from '../models/Counter';
import { generateOpaqueQRToken } from '../utils/tokenGenerator';
import {
  createAssetSchema,
  updateAssetSchema,
  queryAssetSchema,
  bulkImportSchema,
} from '../validators/asset.validator';
import { AssetStatus } from '../constants/enums';

/**
 * @route   POST /api/assets
 * @desc    Create a new asset with permanent sequential Asset ID & opaque QR token
 * @access  Private (Requires assets:create permission)
 */
export const createAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = createAssetSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    // 1. Campus Scoping Check
    if (req.user && !req.user.isGlobalScope) {
      const isAllowed = req.user.campusScope.includes(data.location.campusId);
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          message: `Access Denied: You do not have permission to create assets in campus '${data.location.campusId}'.`,
          authorizedCampuses: req.user.campusScope,
        });
        return;
      }
    }

    // 2. Validate Category
    const category = await AssetCategory.findOne({ _id: data.categoryId, isActive: true });
    if (!category) {
      res.status(400).json({
        success: false,
        message: `Asset Category '${data.categoryId}' not found or inactive.`,
      });
      return;
    }

    // 3. Validate Location (Campus, Building, Room)
    const [campus, building, room] = await Promise.all([
      Campus.findOne({ _id: data.location.campusId, isActive: true }),
      Building.findOne({ _id: data.location.buildingId, campusId: data.location.campusId, isActive: true }),
      Room.findOne({ _id: data.location.roomId, buildingId: data.location.buildingId, isActive: true }),
    ]);

    if (!campus) {
      res.status(400).json({ success: false, message: `Campus '${data.location.campusId}' not found.` });
      return;
    }
    if (!building) {
      res.status(400).json({
        success: false,
        message: `Building '${data.location.buildingId}' not found or does not belong to campus.`,
      });
      return;
    }
    if (!room) {
      res.status(400).json({
        success: false,
        message: `Room '${data.location.roomId}' not found or does not belong to building.`,
      });
      return;
    }

    // 4. Validate Serial Number Uniqueness if provided
    if (data.serialNumber) {
      const existingSerial = await Asset.findOne({
        serialNumber: data.serialNumber.trim(),
        isDeleted: false,
      });
      if (existingSerial) {
        res.status(409).json({
          success: false,
          message: `An active asset with serial number '${data.serialNumber}' already exists (Asset Tag: ${existingSerial.assetTag}).`,
        });
        return;
      }
    }

    // 5. Generate or verify Asset Tag
    let assetTag = data.assetTag?.trim().toUpperCase();
    if (!assetTag) {
      const tagPrefix = category.tagPrefix ? `SMIT-${category.tagPrefix}` : 'SMIT-AST';
      assetTag = await getNextSequentialTag(tagPrefix, 6);
    } else {
      const existingTag = await Asset.findOne({ assetTag });
      if (existingTag) {
        res.status(409).json({
          success: false,
          message: `Asset tag '${assetTag}' is already in use.`,
        });
        return;
      }
    }

    // 6. Generate Cryptographic Opaque QR Token
    const qrToken = generateOpaqueQRToken();

    // 7. Create Asset
    const newAsset = await Asset.create({
      ...data,
      assetTag,
      qrToken,
      createdBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      updatedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
    });

    // 8. Log Initial Creation in AssetHistory
    await AssetHistory.create({
      assetId: newAsset._id,
      action: AssetHistoryAction.CREATED,
      performedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      performedByName: req.user?.name || 'System',
      newValues: {
        assetTag: newAsset.assetTag,
        status: newAsset.status,
        condition: newAsset.condition,
        location: newAsset.location,
      },
      remarks: 'Asset initially registered in system master inventory',
    });

    const populatedAsset = await Asset.findById(newAsset._id)
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .populate('location.buildingId', 'name code')
      .populate('location.roomId', 'name roomNumber roomType')
      .populate('assignedTo.userId', 'name email department');

    res.status(201).json({
      success: true,
      message: 'Asset created successfully',
      data: populatedAsset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/assets
 * @desc    List assets with filtering, pagination, and campus scoping
 * @access  Private (Requires assets:read permission)
 */
export const getAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = queryAssetSchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parseResult.error.format(),
      });
      return;
    }

    const { page, limit, campusId, categoryId, status, condition, search, sortBy, sortOrder } =
      parseResult.data;

    const filter: Record<string, any> = { isDeleted: false };

    // Enforce Campus Scoping
    if (req.user && !req.user.isGlobalScope) {
      if (campusId) {
        if (!req.user.campusScope.includes(campusId)) {
          res.status(403).json({
            success: false,
            message: `Access Denied: You do not have permission to view assets in campus '${campusId}'.`,
          });
          return;
        }
        filter['location.campusId'] = new mongoose.Types.ObjectId(campusId);
      } else {
        filter['location.campusId'] = {
          $in: req.user.campusScope.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
    } else if (campusId) {
      filter['location.campusId'] = new mongoose.Types.ObjectId(campusId);
    }

    if (categoryId) {
      filter.categoryId = new mongoose.Types.ObjectId(categoryId);
    }
    if (status) {
      filter.status = status;
    }
    if (condition) {
      filter.condition = condition;
    }

    // Full text / regex search across asset tag, name, brand, model, serial
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { assetTag: searchRegex },
        { name: searchRegex },
        { brand: searchRegex },
        { modelNumber: searchRegex },
        { serialNumber: searchRegex },
      ];
    }

    const total = await Asset.countDocuments(filter);
    const skip = (page - 1) * limit;

    const assets = await Asset.find(filter)
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .populate('location.buildingId', 'name code')
      .populate('location.roomId', 'name roomNumber roomType')
      .populate('assignedTo.userId', 'name email department')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/assets/:id
 * @desc    Get single asset details including its chronological history/timeline
 * @access  Private (Requires assets:read permission)
 */
export const getAssetById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid Asset ObjectId format.' });
      return;
    }

    const asset = await Asset.findById(id)
      .populate('categoryId', 'name code tagPrefix specDefinitions')
      .populate('location.campusId', 'name code city address')
      .populate('location.buildingId', 'name code totalFloors')
      .populate('location.roomId', 'name roomNumber roomType floor')
      .populate('assignedTo.userId', 'name email department designation phone')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!asset || asset.isDeleted) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    // Campus Scoping Check
    if (req.user && !req.user.isGlobalScope) {
      const assetCampusId = asset.location.campusId?._id?.toString() || asset.location.campusId?.toString();
      if (!req.user.campusScope.includes(assetCampusId)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to view assets in this campus.',
        });
        return;
      }
    }

    // Fetch History / Timeline events
    const history = await AssetHistory.find({ assetId: asset._id })
      .populate('performedBy', 'name email role')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      data: asset,
      history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/assets/:id
 * @desc    Update asset details and log changes in AssetHistory
 * @access  Private (Requires assets:update permission)
 */
export const updateAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid Asset ObjectId format.' });
      return;
    }

    const parseResult = updateAssetSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parseResult.error.format(),
      });
      return;
    }

    const asset = await Asset.findById(id);
    if (!asset || asset.isDeleted) {
      res.status(404).json({ success: false, message: 'Asset not found or has been retired.' });
      return;
    }

    // Verify current campus scope
    if (req.user && !req.user.isGlobalScope) {
      const currentCampusId = asset.location.campusId.toString();
      if (!req.user.campusScope.includes(currentCampusId)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied: You cannot modify assets in this campus.',
        });
        return;
      }
    }

    const updates = parseResult.data;

    // If new campus is targeted, verify authorization for new campus
    if (updates.location?.campusId && req.user && !req.user.isGlobalScope) {
      if (!req.user.campusScope.includes(updates.location.campusId)) {
        res.status(403).json({
          success: false,
          message: `Access Denied: You do not have authorization for target campus '${updates.location.campusId}'.`,
        });
        return;
      }
    }

    // Track previous values for history logging
    const previousValues: Record<string, any> = {};
    const newValues: Record<string, any> = {};
    let historyAction = AssetHistoryAction.UPDATED;

    if (updates.status && updates.status !== asset.status) {
      historyAction = AssetHistoryAction.STATUS_CHANGED;
      previousValues.status = asset.status;
      newValues.status = updates.status;
    }

    if (updates.condition && updates.condition !== asset.condition) {
      historyAction = AssetHistoryAction.CONDITION_CHANGED;
      previousValues.condition = asset.condition;
      newValues.condition = updates.condition;
    }

    if (updates.location) {
      historyAction = AssetHistoryAction.LOCATION_CHANGED;
      previousValues.location = asset.location;
      newValues.location = updates.location;
    }

    if (updates.assignedTo) {
      historyAction = updates.assignedTo.userId
        ? AssetHistoryAction.ASSIGNED
        : AssetHistoryAction.UNASSIGNED;
      previousValues.assignedTo = asset.assignedTo;
      newValues.assignedTo = updates.assignedTo;
    }

    // Check serialNumber conflict if changed
    if (updates.serialNumber && updates.serialNumber !== asset.serialNumber) {
      const existingSerial = await Asset.findOne({
        serialNumber: updates.serialNumber.trim(),
        _id: { $ne: asset._id },
        isDeleted: false,
      });
      if (existingSerial) {
        res.status(409).json({
          success: false,
          message: `Serial number '${updates.serialNumber}' is already registered to asset ${existingSerial.assetTag}.`,
        });
        return;
      }
    }

    // Apply updates
    Object.assign(asset, updates);
    if (req.user) {
      asset.updatedBy = new mongoose.Types.ObjectId(req.user._id);
    }
    await asset.save();

    // Log history
    await AssetHistory.create({
      assetId: asset._id,
      action: historyAction,
      performedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      performedByName: req.user?.name || 'System',
      previousValues,
      newValues,
      remarks: (req.body.remarks as string) || 'Asset details updated',
    });

    const updatedAsset = await Asset.findById(asset._id)
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .populate('location.buildingId', 'name code')
      .populate('location.roomId', 'name roomNumber roomType')
      .populate('assignedTo.userId', 'name email department');

    res.status(200).json({
      success: true,
      message: 'Asset updated successfully',
      data: updatedAsset,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/assets/:id
 * @desc    Soft-delete or retire an asset from active inventory
 * @access  Private (Requires assets:delete permission)
 */
export const deleteAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, message: 'Invalid Asset ObjectId format.' });
      return;
    }

    const asset = await Asset.findById(id);
    if (!asset || asset.isDeleted) {
      res.status(404).json({ success: false, message: 'Asset not found or already retired.' });
      return;
    }

    // Verify campus scope
    if (req.user && !req.user.isGlobalScope) {
      const currentCampusId = asset.location.campusId.toString();
      if (!req.user.campusScope.includes(currentCampusId)) {
        res.status(403).json({
          success: false,
          message: 'Access Denied: You do not have permission to retire assets from this campus.',
        });
        return;
      }
    }

    // Soft delete
    asset.isDeleted = true;
    asset.deletedAt = new Date();
    asset.status = AssetStatus.DECOMMISSIONED;
    if (req.user) {
      asset.deletedBy = new mongoose.Types.ObjectId(req.user._id);
    }
    await asset.save();

    // Log Retirement in History
    await AssetHistory.create({
      assetId: asset._id,
      action: AssetHistoryAction.RETIRED,
      performedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
      performedByName: req.user?.name || 'System',
      remarks: (req.body.remarks as string) || 'Asset retired / soft-deleted from inventory master',
    });

    res.status(200).json({
      success: true,
      message: `Asset '${asset.assetTag}' (${asset.name}) has been retired successfully.`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/assets/qr/:token
 * @desc    Securely resolves a scanned QR token to asset details based on role and campus scope
 * @access  Public / Authenticated
 */
export const resolveQRToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token || token.trim() === '') {
      res.status(400).json({ success: false, message: 'QR token is required.' });
      return;
    }

    const asset = await Asset.findOne({ qrToken: token, isDeleted: false })
      .populate('categoryId', 'name code tagPrefix')
      .populate('location.campusId', 'name code city')
      .populate('location.buildingId', 'name code')
      .populate('location.roomId', 'name roomNumber roomType')
      .populate('assignedTo.userId', 'name email department');

    if (!asset) {
      res.status(404).json({
        success: false,
        message: 'Invalid or unknown QR code. No active asset corresponds to this token.',
      });
      return;
    }

    // Determine access level based on authentication
    const user = req.user;

    // If authenticated: enforce campus scope and return full profile
    if (user) {
      if (!user.isGlobalScope) {
        const campusId = asset.location.campusId?._id?.toString() || asset.location.campusId?.toString();
        if (!user.campusScope.includes(campusId)) {
          res.status(403).json({
            success: false,
            message: 'Access Denied: You are not authorized to view full details for assets in this campus.',
          });
          return;
        }
      }

      // Fetch history for authorized technicians/managers
      const history = await AssetHistory.find({ assetId: asset._id }).sort({ timestamp: -1 }).limit(10);

      res.status(200).json({
        success: true,
        accessLevel: 'AUTHORIZED_FULL',
        data: asset,
        recentHistory: history,
      });
      return;
    }

    // If unauthenticated / public scanner: return sanitized non-sensitive profile
    res.status(200).json({
      success: true,
      accessLevel: 'PUBLIC_LIMITED',
      message: 'Log in to view full technical specifications, purchase history, and assignment details.',
      data: {
        assetTag: asset.assetTag,
        name: asset.name,
        category: (asset.categoryId as any)?.name || 'General',
        brand: asset.brand,
        modelNumber: asset.modelNumber,
        status: asset.status,
        condition: asset.condition,
        location: {
          campus: (asset.location.campusId as any)?.name || 'N/A',
          building: (asset.location.buildingId as any)?.name || 'N/A',
          room: (asset.location.roomId as any)?.name || 'N/A',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/assets/import
 * @desc    Bulk intake of assets with row-by-row validation & duplicate checking
 * @access  Private (Requires assets:create permission)
 */
export const bulkImportAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parseResult = bulkImportSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        message: 'Invalid bulk import payload',
        errors: parseResult.error.format(),
      });
      return;
    }

    const { assets: assetRows } = parseResult.data;
    const successful: any[] = [];
    const failed: Array<{ row: number; assetName: string; error: string }> = [];

    for (let i = 0; i < assetRows.length; i++) {
      const row = assetRows[i];
      const rowIndex = i + 1;

      try {
        // Campus Scope Check
        if (req.user && !req.user.isGlobalScope) {
          if (!req.user.campusScope.includes(row.location.campusId)) {
            failed.push({
              row: rowIndex,
              assetName: row.name,
              error: `Unauthorized for campus '${row.location.campusId}'.`,
            });
            continue;
          }
        }

        // Validate Category
        const category = await AssetCategory.findOne({ _id: row.categoryId, isActive: true });
        if (!category) {
          failed.push({
            row: rowIndex,
            assetName: row.name,
            error: `Category '${row.categoryId}' not found.`,
          });
          continue;
        }

        // Check serial uniqueness if present
        if (row.serialNumber) {
          const serialExists = await Asset.findOne({
            serialNumber: row.serialNumber.trim(),
            isDeleted: false,
          });
          if (serialExists) {
            failed.push({
              row: rowIndex,
              assetName: row.name,
              error: `Duplicate serial number '${row.serialNumber}'.`,
            });
            continue;
          }
        }

        // Generate Tag
        const tagPrefix = category.tagPrefix ? `SMIT-${category.tagPrefix}` : 'SMIT-AST';
        const assetTag = row.assetTag?.trim().toUpperCase() || (await getNextSequentialTag(tagPrefix, 6));

        // Create asset
        const created = await Asset.create({
          ...row,
          assetTag,
          qrToken: generateOpaqueQRToken(),
          createdBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
          updatedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
        });

        // Log History
        await AssetHistory.create({
          assetId: created._id,
          action: AssetHistoryAction.BULK_IMPORTED,
          performedBy: req.user ? new mongoose.Types.ObjectId(req.user._id) : undefined,
          performedByName: req.user?.name || 'Bulk Intake',
          remarks: `Imported via bulk intake batch at row #${rowIndex}`,
        });

        successful.push({
          id: created._id,
          assetTag: created.assetTag,
          name: created.name,
        });
      } catch (err: any) {
        failed.push({
          row: rowIndex,
          assetName: row.name,
          error: err.message || 'Unknown database error',
        });
      }
    }

    res.status(failed.length === 0 ? 201 : 207).json({
      success: successful.length > 0,
      totalRows: assetRows.length,
      successCount: successful.length,
      failedCount: failed.length,
      importedAssets: successful,
      errors: failed,
    });
  } catch (error) {
    next(error);
  }
};
