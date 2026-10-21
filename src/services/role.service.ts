import { Role, IRole } from '../models/Role';
import { SystemRole } from '../constants/enums';
import { DEFAULT_ROLE_PERMISSIONS } from '../constants/permissions';

const SYSTEM_ROLE_DEFINITIONS = [
  {
    name: SystemRole.SUPER_ADMIN,
    displayName: 'Super Admin',
    description: 'System-wide administrator with full unrestricted access to all campuses and resources',
    isSystem: true,
  },
  {
    name: SystemRole.INVENTORY_ADMIN,
    displayName: 'Inventory Administrator',
    description: 'Central administrator managing all asset categories, inventory lifecycles, and audit reports',
    isSystem: true,
  },
  {
    name: SystemRole.CAMPUS_MANAGER,
    displayName: 'Campus Manager',
    description: 'Campus administrator managing localized inventory, rooms, buildings, and campus helpdesk tickets',
    isSystem: true,
  },
  {
    name: SystemRole.CAMPUS_IT_TECHNICIAN,
    displayName: 'Campus IT Technician',
    description: 'IT Support technician handling repairs, maintenance, and asset status updates for assigned campus(es)',
    isSystem: true,
  },
  {
    name: SystemRole.EMPLOYEE,
    displayName: 'Standard Employee',
    description: 'Regular employee or staff requesting assets and filing IT helpdesk tickets',
    isSystem: true,
  },
];

export const ensureDefaultRoles = async (): Promise<void> => {
  for (const def of SYSTEM_ROLE_DEFINITIONS) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[def.name] || [];
    await Role.findOneAndUpdate(
      { name: def.name },
      {
        $setOnInsert: {
          name: def.name,
          displayName: def.displayName,
          description: def.description,
          permissions,
          isSystem: true,
          isActive: true,
        },
      },
      { upsert: true, new: true }
    );
  }
};

export const getRoleByName = async (roleName: string): Promise<IRole | null> => {
  let role = await Role.findOne({ name: roleName.toUpperCase(), isActive: true });
  if (!role) {
    // If roles have not been seeded yet, seed and retry
    await ensureDefaultRoles();
    role = await Role.findOne({ name: roleName.toUpperCase(), isActive: true });
  }
  return role;
};
