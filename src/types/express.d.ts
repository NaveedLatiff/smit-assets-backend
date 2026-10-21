import { IUser } from '../models/User';
import { IRole } from '../models/Role';

export interface AuthUserContext {
  _id: string;
  name: string;
  email: string;
  role: {
    _id: string;
    name: string;
    displayName: string;
    permissions: string[];
  };
  campusScope: string[];
  isGlobalScope: boolean;
  customPermissions: string[];
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserContext;
      // Helper array holding campus IDs the current user is permitted to access. Empty or null if isGlobalScope is true.
      scopedCampusIds?: string[];
    }
  }
}
