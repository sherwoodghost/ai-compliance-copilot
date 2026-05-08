import { SetMetadata } from '@nestjs/common';
import { Permission } from '../permissions/permission.types';

export const PERMISSION_KEY = 'required_permission';

/**
 * Declare the permission required to access this route.
 * Used with PermissionGuard.
 *
 * @example
 * @RequirePermission('policy.approve')
 * @Post(':id/approve')
 * approve(...) {}
 */
export const RequirePermission = (permission: Permission) =>
  SetMetadata(PERMISSION_KEY, permission);
