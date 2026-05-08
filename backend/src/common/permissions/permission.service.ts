import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Permission, ROLE_PERMISSIONS } from './permission.types';

export interface PermissionUser {
  id: string;
  orgId: string;
  role: string;         // legacy UserRole (admin | auditor | member)
  platformRole: string; // new PlatformRole
  status?: string;      // UserStatus
}

export interface SodCheckOptions {
  /** The permission being requested */
  action: Permission;
  /** User ID stored on the resource (e.g. policy.authorId) */
  resourceOwnerId: string | null | undefined;
  /** Human-readable resource description for the error message */
  resourceDescription?: string;
  /** If provided, log the SoD violation to TeamAuditLog */
  orgId?: string;
  targetType?: string;
  targetId?: string;
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user can perform an action.
   * Returns { allowed: boolean, reason?: string }
   */
  can(user: PermissionUser, action: Permission): { allowed: boolean; reason?: string } {
    // Hard deny: deactivated or suspended users cannot do anything
    if (user.status === 'deactivated') {
      return { allowed: false, reason: 'Account is deactivated' };
    }
    if (user.status === 'suspended') {
      return { allowed: false, reason: 'Account is suspended' };
    }

    // Derive effective platform role
    const effectiveRole = this.getEffectiveRole(user);
    const rolePerms = ROLE_PERMISSIONS[effectiveRole] ?? [];

    if (rolePerms.includes(action)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Role '${effectiveRole}' does not have permission '${action}'`,
    };
  }

  /**
   * Assert permission — throws ForbiddenException if not allowed.
   * Optionally logs denial to TeamAuditLog.
   */
  async assertCan(
    user: PermissionUser,
    action: Permission,
    context?: { orgId?: string; targetType?: string; targetId?: string; ipAddress?: string },
  ): Promise<void> {
    const result = this.can(user, action);
    if (!result.allowed) {
      // Log the denial
      if (context?.orgId) {
        this.logDenial(user.id, context.orgId, action, result.reason, context).catch(
          (err) => this.logger.warn(`Failed to log permission denial: ${err.message}`),
        );
      }
      throw new ForbiddenException(result.reason ?? `Permission denied: ${action}`);
    }
  }

  /**
   * Segregation of Duties check.
   * Throws ForbiddenException if the requesting user is the resource owner
   * (e.g., the policy author cannot approve their own policy).
   * Logs all SoD violations to TeamAuditLog.
   */
  async checkSoD(user: PermissionUser, opts: SodCheckOptions): Promise<void> {
    if (!opts.resourceOwnerId) return; // nothing to check

    if (user.id === opts.resourceOwnerId) {
      const desc = opts.resourceDescription ?? 'resource';
      const reason = `Segregation of duties violation: you cannot perform '${opts.action}' on ${desc} that you created`;

      // Log to TeamAuditLog
      if (opts.orgId && opts.targetType && opts.targetId) {
        this.logSodViolation(user.id, opts.orgId, opts.action, opts.targetType, opts.targetId, reason).catch(
          (err) => this.logger.warn(`Failed to log SoD violation: ${err.message}`),
        );
      }

      throw new ForbiddenException(reason);
    }
  }

  /**
   * Maps legacy role + platformRole to an effective role string for permission lookup.
   * Legacy admin → admin, legacy auditor → viewer, legacy member → contributor
   * If platformRole is set (not default), it takes precedence.
   */
  private getEffectiveRole(user: PermissionUser): string {
    // If the user has an explicit platformRole that isn't the default 'contributor',
    // use it. Otherwise fall back to mapping from legacy role.
    if (user.platformRole && user.platformRole !== 'contributor') {
      return user.platformRole;
    }

    // Legacy role fallback
    switch (user.role) {
      case 'admin':
        return 'admin';
      case 'auditor':
        return 'viewer';
      case 'member':
      default:
        return user.platformRole ?? 'contributor';
    }
  }

  private async logDenial(
    actorId: string,
    orgId: string,
    action: string,
    reason: string | undefined,
    context: { targetType?: string; targetId?: string; ipAddress?: string },
  ): Promise<void> {
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'permission.denied',
        targetType: context.targetType ?? 'unknown',
        targetId: context.targetId ?? 'unknown',
        after: { action, reason },
        ipAddress: context.ipAddress,
      },
    });
  }

  private async logSodViolation(
    actorId: string,
    orgId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'sod.violation.blocked',
        targetType,
        targetId,
        after: { action, reason },
      },
    });
  }
}
