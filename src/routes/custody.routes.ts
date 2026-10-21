import { Router } from 'express';
import { assignAsset, returnAsset, getMyAssets } from '../controllers/custody.controller';
import { authenticate, requirePermissions } from '../middlewares/auth.middleware';
import { Permission } from '../constants/permissions';

const router = Router();

/**
 * @route   POST /api/custody/assign
 * @desc    Assign an asset (e.g. laptop or movable gear) to an employee
 * @access  Private (Requires assets:assign)
 */
router.post('/assign', authenticate, requirePermissions(Permission.ASSETS_ASSIGN), assignAsset);

/**
 * @route   POST /api/custody/return
 * @desc    Return an assigned asset back to branch stock/storage
 * @access  Private (Requires assets:assign)
 */
router.post('/return', authenticate, requirePermissions(Permission.ASSETS_ASSIGN), returnAsset);

/**
 * @route   GET /api/custody/my-assets
 * @desc    View all assets currently checked out to the authenticated employee
 * @access  Private (Any authenticated employee/user)
 */
router.get('/my-assets', authenticate, getMyAssets);

export default router;
