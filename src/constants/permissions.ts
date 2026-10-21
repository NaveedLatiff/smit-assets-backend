export enum Permission {
  // User & Role Management
  USERS_CREATE = 'users:create',
  USERS_READ = 'users:read',
  USERS_UPDATE = 'users:update',
  USERS_DELETE = 'users:delete',
  ROLES_MANAGE = 'roles:manage',

  // Location Hierarchy Management
  LOCATIONS_MANAGE = 'locations:manage',
  LOCATIONS_READ = 'locations:read',

  // Asset Management
  ASSETS_CREATE = 'assets:create',
  ASSETS_READ = 'assets:read',
  ASSETS_UPDATE = 'assets:update',
  ASSETS_DELETE = 'assets:delete',
  ASSETS_ASSIGN = 'assets:assign',
  ASSETS_AUDIT = 'assets:audit',
  ASSETS_EXPORT = 'assets:export',

  // Asset Transfers
  TRANSFERS_REQUEST = 'transfers:request',
  TRANSFERS_APPROVE = 'transfers:approve',
  TRANSFERS_DISPATCH = 'transfers:dispatch',
  TRANSFERS_RECEIVE = 'transfers:receive',
  TRANSFERS_READ = 'transfers:read',

  // Categories
  CATEGORIES_MANAGE = 'categories:manage',

  // Helpdesk & Tickets (upcoming phases)
  TICKETS_CREATE = 'tickets:create',
  TICKETS_READ = 'tickets:read',
  TICKETS_ASSIGN = 'tickets:assign',
  TICKETS_UPDATE = 'tickets:update',
  TICKETS_RESOLVE = 'tickets:resolve',

  // System & Reports
  REPORTS_VIEW = 'reports:view',
  AUDIT_LOGS_VIEW = 'audit_logs:view',
}

/**
 * Default permission matrix for initial system roles
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  INVENTORY_ADMIN: [
    Permission.USERS_READ,
    Permission.LOCATIONS_READ,
    Permission.LOCATIONS_MANAGE,
    Permission.CATEGORIES_MANAGE,
    Permission.ASSETS_CREATE,
    Permission.ASSETS_READ,
    Permission.ASSETS_UPDATE,
    Permission.ASSETS_DELETE,
    Permission.ASSETS_ASSIGN,
    Permission.ASSETS_AUDIT,
    Permission.ASSETS_EXPORT,
    Permission.TRANSFERS_REQUEST,
    Permission.TRANSFERS_APPROVE,
    Permission.TRANSFERS_DISPATCH,
    Permission.TRANSFERS_RECEIVE,
    Permission.TRANSFERS_READ,
    Permission.REPORTS_VIEW,
    Permission.AUDIT_LOGS_VIEW,
  ],
  CAMPUS_MANAGER: [
    Permission.USERS_READ,
    Permission.LOCATIONS_MANAGE,
    Permission.LOCATIONS_READ,
    Permission.ASSETS_CREATE,
    Permission.ASSETS_READ,
    Permission.ASSETS_UPDATE,
    Permission.ASSETS_ASSIGN,
    Permission.ASSETS_AUDIT,
    Permission.ASSETS_EXPORT,
    Permission.TRANSFERS_REQUEST,
    Permission.TRANSFERS_APPROVE,
    Permission.TRANSFERS_DISPATCH,
    Permission.TRANSFERS_RECEIVE,
    Permission.TRANSFERS_READ,
    Permission.CATEGORIES_MANAGE,
    Permission.TICKETS_CREATE,
    Permission.TICKETS_READ,
    Permission.TICKETS_ASSIGN,
    Permission.TICKETS_UPDATE,
    Permission.TICKETS_RESOLVE,
    Permission.REPORTS_VIEW,
  ],
  CAMPUS_IT_TECHNICIAN: [
    Permission.LOCATIONS_READ,
    Permission.ASSETS_READ,
    Permission.ASSETS_UPDATE,
    Permission.ASSETS_AUDIT,
    Permission.TRANSFERS_READ,
    Permission.TRANSFERS_DISPATCH,
    Permission.TRANSFERS_RECEIVE,
    Permission.TICKETS_CREATE,
    Permission.TICKETS_READ,
    Permission.TICKETS_UPDATE,
    Permission.TICKETS_RESOLVE,
  ],
  EMPLOYEE: [
    Permission.LOCATIONS_READ,
    Permission.ASSETS_READ,
    Permission.TICKETS_CREATE,
    Permission.TICKETS_READ,
  ],
};
