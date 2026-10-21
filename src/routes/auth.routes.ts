import { Router, Request, Response } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticate, authorizeRoles, enforceCampusScope } from '../middlewares/auth.middleware';
import { SystemRole } from '../constants/enums';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    Login user & issue JWT
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Get authenticated user profile, roles, and campus scope
 * @access  Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route   GET /api/auth/test-campus-access/:campusId
 * @desc    Demonstrates RBAC + Campus Scoping middleware enforcement in action
 * @access  Private (Scoped by campus)
 */
router.get(
  '/test-campus-access/:campusId',
  authenticate,
  enforceCampusScope({ paramName: 'campusId' }),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED: User '${req.user?.name}' is authorized to access campus '${req.params.campusId}'`,
      user: {
        id: req.user?._id,
        role: req.user?.role.displayName,
        isGlobalScope: req.user?.isGlobalScope,
        campusScope: req.user?.campusScope,
      },
    });
  }
);

/**
 * @route   GET /api/auth/admin-only
 * @desc    Demonstrates role verification middleware
 * @access  Private (SUPER_ADMIN or INVENTORY_ADMIN only)
 */
router.get(
  '/admin-only',
  authenticate,
  authorizeRoles(SystemRole.SUPER_ADMIN, SystemRole.INVENTORY_ADMIN),
  (req: Request, res: Response) => {
    res.json({
      success: true,
      message: `Access GRANTED: You are viewing admin-only area as role: ${req.user?.role.displayName}`,
    });
  }
);

export default router;
