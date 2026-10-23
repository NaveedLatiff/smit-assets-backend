import { Request, Response, NextFunction } from 'express';
import { Campus } from '../models/Campus';
import { Asset } from '../models/Asset';

/**
 * @route   GET /api/campuses
 * @desc    List all campuses with total asset count for each branch
 * @access  Private (Super Admin)
 */
export const listCampuses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN' || req.user?.isGlobalScope;
    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can manage campus branches.',
      });
      return;
    }

    const campuses = await Campus.find().sort({ createdAt: -1 });

    // Aggregate asset count per campus
    const assetCounts = await Asset.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$location.campusId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map<string, number>();
    for (const item of assetCounts) {
      if (item._id) countMap.set(item._id.toString(), item.count);
    }

    const data = campuses.map((c) => ({
      ...c.toObject(),
      totalAssets: countMap.get(c._id.toString()) || 0,
    }));

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/campuses
 * @desc    Create a new campus/branch
 * @access  Private (Super Admin only)
 */
export const createCampus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN' || req.user?.isGlobalScope;
    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can create new campus branches.',
      });
      return;
    }

    const { name, code, city, address, contactPerson } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, message: 'Campus name is required.' });
      return;
    }

    if (!code || !code.trim()) {
      res.status(400).json({ success: false, message: 'Campus code is required.' });
      return;
    }

    if (!city || !city.trim()) {
      res.status(400).json({ success: false, message: 'Campus city is required.' });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    // Check code uniqueness
    const existing = await Campus.findOne({ code: normalizedCode });
    if (existing) {
      res.status(409).json({
        success: false,
        message: `A campus with code '${normalizedCode}' already exists (${existing.name}).`,
      });
      return;
    }

    const campus = await Campus.create({
      name: name.trim(),
      code: normalizedCode,
      city: city.trim(),
      address: address ? address.trim() : undefined,
      contactPerson: contactPerson || undefined,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Campus branch created successfully.',
      data: campus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/campuses/:id
 * @desc    Update a campus branch details
 * @access  Private (Super Admin only)
 */
export const updateCampus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN' || req.user?.isGlobalScope;
    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can update campus branches.',
      });
      return;
    }

    const { id } = req.params;
    const { name, code, city, address, contactPerson, isActive } = req.body;

    const campus = await Campus.findById(id);
    if (!campus) {
      res.status(404).json({ success: false, message: 'Campus branch not found.' });
      return;
    }

    if (code && code.trim().toUpperCase() !== campus.code) {
      const existing = await Campus.findOne({ code: code.trim().toUpperCase() });
      if (existing) {
        res.status(409).json({
          success: false,
          message: `A campus with code '${code.trim().toUpperCase()}' already exists.`,
        });
        return;
      }
      campus.code = code.trim().toUpperCase();
    }

    if (name) campus.name = name.trim();
    if (city) campus.city = city.trim();
    if (address !== undefined) campus.address = address ? address.trim() : undefined;
    if (contactPerson !== undefined) campus.contactPerson = contactPerson;
    if (isActive !== undefined) campus.isActive = Boolean(isActive);

    await campus.save();

    res.status(200).json({
      success: true,
      message: 'Campus branch updated successfully.',
      data: campus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/campuses/:id
 * @desc    Deactivate / delete a campus branch
 * @access  Private (Super Admin only)
 */
export const deleteCampus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isSuperAdmin = req.user?.role?.name === 'SUPER_ADMIN' || req.user?.isGlobalScope;
    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'Access Denied: Only Super Admin can delete campus branches.',
      });
      return;
    }

    const { id } = req.params;
    const campus = await Campus.findById(id);
    if (!campus) {
      res.status(404).json({ success: false, message: 'Campus branch not found.' });
      return;
    }

    // Check if any active assets belong to this campus
    const assetCount = await Asset.countDocuments({ 'location.campusId': id, isDeleted: false });
    if (assetCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete campus '${campus.name}': It currently houses ${assetCount} active assets. Please transfer or decommission them first.`,
      });
      return;
    }

    await Campus.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: `Campus '${campus.name}' has been deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
};
