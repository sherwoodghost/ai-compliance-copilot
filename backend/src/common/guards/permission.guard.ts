import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { PermissionService } from '../permissions/permission.service';
import { Permission } from '../permissions/permission.types';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * ABAC Permission Guard — replaces pure-RBAC RolesGuard.
 *
 * Usage: Add to a controller or specific route with @RequirePermission('some.action').
 * Falls through (allows) when no @RequirePermission decorator is present.
 *
 * The guard:
 *   1. Skips @Public() routes
 *   2. Reads @RequirePermission metadata
 *   3. Delegates to PermissionService.can() for role-baseline check
 *   4. Logs denials to TeamAuditLog
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Get required permission from decorator metadata
    const requiredPermission = this.reflector.getAllAndOverride<Permission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermission decorator — guard passes (JWT guard still requires auth)
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('No authenticated user');
    }

    const permUser = {
      id: user.sub ?? user.id,
      orgId: user.orgId,
      role: user.role ?? 'member',
      platformRole: user.platformRole ?? 'contributor',
      status: user.status ?? 'active',
    };

    await this.permissionService.assertCan(permUser, requiredPermission, {
      orgId: user.orgId,
      targetType: context.getClass().name,
      targetId: request.params?.id ?? 'n/a',
      ipAddress: request.ip,
    });

    return true;
  }
}
