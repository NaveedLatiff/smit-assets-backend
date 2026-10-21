import { Request, Response, NextFunction } from 'express';
import { verifyJwtToken } from '../utils/jwt';
import { User } from '../models/User';
import { IRole } from '../models/Role';
import { AuthUserContext } from '../types/express';
import { Permission } from '../constants/permissions';

/**
 * Middleware to authenticate requests using a JWT Bearer token
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. Missing or malformed Bearer token.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyJwtToken(token);
    } catch (err: any) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
      return;
    }

    const user = await User.findById(decoded.userId).populate<{ role: IRole }>('role');
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'User account not found or has been deactivated.',
      });
      return;
    }

    const roleDoc = user.role as unknown as IRole;
    const userRoleName = roleDoc?.name || 'EMPLOYEE';
    const rolePermissions = roleDoc?.permissions || [];

    const userContext: AuthUserContext = {
      _id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: {
        _id: roleDoc?._id ? roleDoc._id.toString() : '',
        name: userRoleName,
        displayName: roleDoc?.displayName || userRoleName,
        permissions: rolePermissions,
      },
      campusScope: user.campusScope.map((id) => id.toString()),
      isGlobalScope: user.isGlobalScope,
      customPermissions: user.customPermissions || [],
      isActive: user.isActive,
    };

    req.user = userContext;
    req.scopedCampusIds = user.isGlobalScope ? [] : userContext.campusScope;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to restrict endpoints to specific system roles
 * e.g. authorizeRoles('SUPER_ADMIN', 'INVENTORY_ADMIN')
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Please authenticate first.',
      });
      return;
    }

    const userRole = req.user.role.name.toUpperCase();
    const hasRole = allowedRoles.map((r) => r.toUpperCase()).includes(userRole);

    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Role '${req.user.role.displayName}' does not have access to this resource. Required roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to restrict endpoints based on fine-grained permissions
 * e.g. requirePermissions(Permission.ASSETS_CREATE)
 */
export const requirePermissions = (...requiredPermissions: Permission[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Please authenticate first.',
      });
      return;
    }

    // Super Admin has all permissions automatically
    if (req.user.isGlobalScope && req.user.role.name === 'SUPER_ADMIN') {
      return next();
    }

    const userAllPermissions = new Set([
      ...req.user.role.permissions,
      ...req.user.customPermissions,
    ]);

    const hasAllRequired = requiredPermissions.every((perm) => userAllPermissions.has(perm));

    if (!hasAllRequired) {
      res.status(403).json({
        success: false,
        message: `Forbidden. Missing required permission(s): ${requiredPermissions.join(', ')}`,
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to enforce campus-level data scoping.
 * Validates that the requested target campus (passed via params, body, or query)
 * falls within the authenticated user's authorized campusScope.
 */
export interface CampusScopeOptions {
  paramName?: string;
  bodyField?: string;
  queryParam?: string;
}

export const enforceCampusScope = (options: CampusScopeOptions = {}) => {
  const {
    paramName = 'campusId',
    bodyField = 'campusId',
    queryParam = 'campusId',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized. Please authenticate first.',
      });
      return;
    }

    // Global administrators (e.g. Super Admin or global inventory admin) can access all campuses
    if (req.user.isGlobalScope) {
      return next();
    }

    // Resolve target campus ID from request
    const targetCampusId =
      req.params[paramName] ||
      req.body[bodyField] ||
      req.body?.location?.campusId ||
      (req.query[queryParam] as string);

    // If an explicit campus is being targeted, verify membership in user's campusScope
    if (targetCampusId) {
      const isAllowed = req.user.campusScope.includes(targetCampusId.toString());
      if (!isAllowed) {
        res.status(403).json({
          success: false,
          message: `Access Denied: You do not have authorization to view or modify data for campus '${targetCampusId}'.`,
          authorizedCampuses: req.user.campusScope,
        });
        return;
      }
    }

    next();
  };
};
