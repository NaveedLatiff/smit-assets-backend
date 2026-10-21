import { Router } from 'express';
import {
  requestTransfer,
  approveTransfer,
  dispatchTransfer,
  receiveTransfer,
  listTransfers,
  getTransferById,
} from '../controllers/transfer.controller';
import { authenticate, requirePermissions } from '../middlewares/auth.middleware';
import { Permission } from '../constants/permissions';

const router = Router();

/**
 * @route   POST /api/transfers
 * @desc    Request an inter-branch transfer of an asset
 * @access  Private (Requires transfers:request)
 */
router.post('/', authenticate, requirePermissions(Permission.TRANSFERS_REQUEST), requestTransfer);

/**
 * @route   GET /api/transfers
 * @desc    List all asset transfers with campus scoping and filters
 * @access  Private (Requires transfers:read)
 */
router.get('/', authenticate, requirePermissions(Permission.TRANSFERS_READ), listTransfers);

/**
 * @route   GET /api/transfers/:id
 * @desc    Get detailed transfer view with full history and populated entities
 * @access  Private (Requires transfers:read)
 */
router.get('/:id', authenticate, requirePermissions(Permission.TRANSFERS_READ), getTransferById);

/**
 * @route   PUT /api/transfers/:id/approve
 * @desc    Approve or reject a pending transfer request
 * @access  Private (Requires transfers:approve)
 */
router.put('/:id/approve', authenticate, requirePermissions(Permission.TRANSFERS_APPROVE), approveTransfer);

/**
 * @route   PUT /api/transfers/:id/dispatch
 * @desc    Mark an approved transfer as dispatched / in-transit
 * @access  Private (Requires transfers:dispatch)
 */
router.put('/:id/dispatch', authenticate, requirePermissions(Permission.TRANSFERS_DISPATCH), dispatchTransfer);

/**
 * @route   PUT /api/transfers/:id/receive
 * @desc    Confirm receipt of asset at destination branch and update location/status
 * @access  Private (Requires transfers:receive)
 */
router.put('/:id/receive', authenticate, requirePermissions(Permission.TRANSFERS_RECEIVE), receiveTransfer);

export default router;
