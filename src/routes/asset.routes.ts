import { Router } from 'express';
import {
  createAsset,
  getAssets,
  getAssetById,
  updateAsset,
  deleteAsset,
  resolveQRToken,
  bulkImportAssets,
} from '../controllers/asset.controller';
import {
  authenticate,
  optionalAuthenticate,
  requirePermissions,
} from '../middlewares/auth.middleware';
import { Permission } from '../constants/permissions';

const router = Router();

/**
 * @route   POST /api/assets/import
 * @desc    Bulk intake of asset records with error checking and duplicate rejection
 * @access  Private (Requires assets:create)
 */
router.post('/import', authenticate, requirePermissions(Permission.ASSETS_CREATE), bulkImportAssets);

/**
 * @route   GET /api/assets/qr/:token
 * @desc    Securely resolves a scanned QR token to asset profile (public summary or full private)
 * @access  Public / Authenticated
 */
router.get('/qr/:token', optionalAuthenticate, resolveQRToken);

/**
 * @route   POST /api/assets
 * @desc    Create single asset with sequential SMIT-AST-XXXXXX and opaque QR token
 * @access  Private (Requires assets:create)
 */
router.post('/', authenticate, requirePermissions(Permission.ASSETS_CREATE), createAsset);

/**
 * @route   GET /api/assets
 * @desc    List assets with campus scoping, category/status filters, and pagination
 * @access  Private (Requires assets:read)
 */
router.get('/', authenticate, requirePermissions(Permission.ASSETS_READ), getAssets);

/**
 * @route   GET /api/assets/:id
 * @desc    Get asset details including complete history/timeline events
 * @access  Private (Requires assets:read)
 */
router.get('/:id', authenticate, requirePermissions(Permission.ASSETS_READ), getAssetById);

/**
 * @route   PUT /api/assets/:id
 * @desc    Update asset details and append change history event
 * @access  Private (Requires assets:update)
 */
router.put('/:id', authenticate, requirePermissions(Permission.ASSETS_UPDATE), updateAsset);

/**
 * @route   DELETE /api/assets/:id
 * @desc    Soft-delete / retire an asset from active inventory
 * @access  Private (Requires assets:delete)
 */
router.delete('/:id', authenticate, requirePermissions(Permission.ASSETS_DELETE), deleteAsset);

export default router;
