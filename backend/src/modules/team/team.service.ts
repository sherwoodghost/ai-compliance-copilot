import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';
import { PlatformRole, ComplianceRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

export interface InviteMemberDto {
  email: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  platformRole: PlatformRole;
  employmentType?: string;
  responsibilities?: ComplianceRole[];
  requireNda?: boolean;
  requireAup?: boolean;
  requireTraining?: boolean;
}

export interface UpdateMemberDto {
  fullName?: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  platformRole?: PlatformRole;
  responsibilities?: ComplianceRole[];
}

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get all org members with per-member compliance stats.
   */
  async getMembers(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId, status: { not: 'deactivated' } },
      include: {
        responsibilities: { select: { role: true, isPrimary: true } },
        manager: { select: { id: true, fullName: true } },
      },
      orderBy: [{ platformRole: 'asc' }, { fullName: 'asc' }],
    });

    // Fetch stats in parallel for each user
    const statsPromises = users.map(async (u) => {
      const [controlsAssigned, raciAccountable, tasksCompleted, sodConflicts, trainingComplete] = await Promise.all([
        this.prisma.organizationControl.count({ where: { orgId, assignedTo: u.id } }),
        this.prisma.raciAssignment.count({ where: { orgId, userId: u.id, raci: 'A' } }),
        this.prisma.task.count({ where: { orgId, assignedTo: u.id, status: 'done' } }),
        // SoD conflicts: same user has both R and A on the same control
        this.countSodConflictsForUser(orgId, u.id),
        this.prisma.trainingAssignment.count({ where: { orgId, userId: u.id, completedAt: { not: null } } }),
      ]);

      return {
        userId: u.id,
        stats: { controlsAssigned, raciAccountable, tasksCompleted, sodConflicts, trainingComplete },
      };
    });

    const statsArray = await Promise.all(statsPromises);
    const statsMap = new Map(statsArray.map((s) => [s.userId, s.stats]));

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      jobTitle: (u as any).jobTitle,
      department: (u as any).department,
      role: u.role,
      platformRole: (u as any).platformRole,
      status: (u as any).status,
      employmentType: (u as any).employmentType,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      ndaSignedAt: (u as any).ndaSignedAt,
      aupSignedAt: (u as any).aupSignedAt,
      manager: (u as any).manager,
      responsibilities: (u as any).responsibilities ?? [],
      stats: statsMap.get(u.id) ?? { controlsAssigned: 0, raciAccountable: 0, tasksCompleted: 0, sodConflicts: 0, trainingComplete: 0 },
      createdAt: u.createdAt,
    }));
  }

  /**
   * Invite a new team member. Creates user with status='suspended' pending activation.
   * Optionally creates NDA, AUP, and training tasks.
   */
  async inviteMember(orgId: string, dto: InviteMemberDto, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate a secure invite token (7-day magic link)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Temporary password hash (user must set password via invite link)
    const tempHash = await bcrypt.hash(rawToken, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      // Create the user in suspended state
      const newUser = await tx.user.create({
        data: {
          orgId,
          email: dto.email.toLowerCase(),
          passwordHash: tempHash,
          fullName: dto.fullName,
          role: 'member',
          platformRole: dto.platformRole,
          status: 'suspended',     // Active only after completing pre-access tasks
          isActive: false,
          jobTitle: dto.jobTitle,
          department: dto.department,
          managerId: dto.managerId,
          employmentType: (dto.employmentType as any),
        },
      });

      // Assign compliance responsibilities
      if (dto.responsibilities?.length) {
        await tx.complianceResponsibility.createMany({
          data: dto.responsibilities.map((role, i) => ({
            orgId,
            userId: newUser.id,
            role,
            isPrimary: i === 0,
            assignedBy: actorId,
          })),
          skipDuplicates: true,
        });
      }

      // Create pre-access tasks if required
      const now = new Date();
      const due14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      const preTasks = [];
      if (dto.requireNda) {
        preTasks.push(tx.task.create({
          data: {
            orgId,
            title: `Sign Non-Disclosure Agreement — ${newUser.fullName}`,
            description: 'Review and sign the NDA before account activation.',
            priority: 'high',
            status: 'open',
            source: 'manual',
            kind: 'ATTESTATION',
            isGuided: true,
            assignedTo: newUser.id,
            dueDate: due14Days,
            guidance: {
              why: 'ISO 27001 A.6.2 requires employees to sign NDA before accessing company information.',
              evidenceHint: 'Signed NDA document (PDF)',
              stepByStep: ['Download NDA template', 'Sign and date', 'Upload signed copy'],
              estimatedMinutes: 30,
              controlCategory: 'HR Security',
            },
          },
        }));
      }

      if (dto.requireAup) {
        preTasks.push(tx.task.create({
          data: {
            orgId,
            title: `Acknowledge Acceptable Use Policy — ${newUser.fullName}`,
            description: 'Read and acknowledge the Acceptable Use Policy.',
            priority: 'high',
            status: 'open',
            source: 'manual',
            kind: 'ATTESTATION',
            isGuided: true,
            assignedTo: newUser.id,
            dueDate: due14Days,
            guidance: {
              why: 'ISO 27001 A.5.10 and SOC 2 CC1.1 require all users to acknowledge acceptable use policies.',
              evidenceHint: 'Acknowledgement record with date',
              stepByStep: ['Read AUP', 'Click Accept in the portal'],
              estimatedMinutes: 15,
              controlCategory: 'Policies',
            },
          },
        }));
      }

      await Promise.all(preTasks);
      return newUser;
    });

    // Persist InviteToken for redemption via /auth/accept-invite
    await this.prisma.inviteToken.create({
      data: {
        tokenHash,
        userId: user.id,
        orgId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Log the invite
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'user.invite',
        targetType: 'User',
        targetId: user.id,
        after: { email: user.email, platformRole: dto.platformRole },
      },
    });

    this.logger.log(`Member invited: ${user.email} (${dto.platformRole}) by ${actorId}`);

    // Send invite email with magic link
    const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const acceptUrl = `${appUrl}/accept-invite?token=${rawToken}`;

    // Get inviter's name for the email
    const inviter = await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
    const org     = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });

    await this.resend.sendInviteEmail({
      to:          user.email,
      inviteeName: user.fullName,
      inviterName: inviter?.fullName ?? 'Your admin',
      orgName:     org?.name ?? 'Your organization',
      role:        dto.platformRole,
      acceptUrl,
      expiresIn:   '7 days',
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: dto.platformRole,
        status: 'suspended',
      },
    };
  }

  /**
   * Update a member's profile, role, or responsibilities.
   */
  async updateMember(orgId: string, userId: string, dto: UpdateMemberDto, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new NotFoundException('Member not found');

    const before = {
      fullName: user.fullName,
      jobTitle: (user as any).jobTitle,
      platformRole: (user as any).platformRole,
    };

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.managerId !== undefined && { managerId: dto.managerId }),
        ...(dto.platformRole && { platformRole: dto.platformRole }),
      },
    });

    // Update responsibilities if provided
    if (dto.responsibilities !== undefined) {
      // Remove existing and re-insert
      await this.prisma.complianceResponsibility.deleteMany({ where: { orgId, userId } });
      if (dto.responsibilities.length) {
        await this.prisma.complianceResponsibility.createMany({
          data: dto.responsibilities.map((role, i) => ({
            orgId,
            userId,
            role,
            isPrimary: i === 0,
            assignedBy: actorId,
          })),
          skipDuplicates: true,
        });
      }
    }

    // Audit log
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: dto.platformRole ? 'role.change' : 'user.update',
        targetType: 'User',
        targetId: userId,
        before,
        after: { fullName: updated.fullName, platformRole: (updated as any).platformRole },
      },
    });

    return updated;
  }

  /**
   * Resend an invite to a suspended member.
   * Invalidates any existing unused tokens and issues a fresh 7-day magic link.
   */
  async resendInvite(orgId: string, targetUserId: string, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, orgId } });
    if (!user) throw new NotFoundException('Member not found');

    if ((user as any).status !== 'suspended') {
      throw new BadRequestException('Can only resend invites for suspended (pending activation) members');
    }

    // Invalidate any existing unused tokens
    await this.prisma.inviteToken.updateMany({
      where: { userId: targetUserId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Create a fresh token (7 days)
    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.inviteToken.create({
      data: {
        tokenHash,
        userId:    targetUserId,
        orgId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Audit log
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action:     'user.invite.resent',
        targetType: 'User',
        targetId:   targetUserId,
        after:      { email: user.email },
      },
    });

    // Send the invite email again
    const appUrl    = this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const acceptUrl = `${appUrl}/accept-invite?token=${rawToken}`;
    const inviter   = await this.prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
    const org       = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });

    await this.resend.sendInviteEmail({
      to:          user.email,
      inviteeName: user.fullName,
      inviterName: inviter?.fullName ?? 'Your admin',
      orgName:     org?.name ?? 'Your organization',
      role:        (user as any).platformRole ?? 'contributor',
      acceptUrl,
      expiresIn:   '7 days',
    });

    this.logger.log(`Invite resent to ${user.email} by ${actorId}`);
    return { message: `Invite resent to ${user.email}` };
  }

  /**
   * Initiate offboarding for a team member.
   * Sets status to 'offboarding', creates parallel tasks for IT, HR, Security.
   */
  async initiateOffboarding(orgId: string, targetUserId: string, offboardDate: Date, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: targetUserId, orgId } });
    if (!user) throw new NotFoundException('Member not found');

    if ((user as any).status === 'deactivated') {
      throw new BadRequestException('User is already deactivated');
    }

    // Set status to offboarding
    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: 'offboarding' as any },
    });

    // Check for RACI-A assignments that need transfer
    const accountableCount = await this.prisma.raciAssignment.count({
      where: { orgId, userId: targetUserId, raci: 'A' },
    });

    // Create offboarding tasks
    await this.prisma.task.createMany({
      data: [
        {
          orgId,
          title: `[IT] Revoke access & deprovisioning — ${user.fullName}`,
          description: `Revoke all system access for ${user.email} by ${offboardDate.toDateString()}. Include SSO, GitHub, AWS, Slack, email.`,
          priority: 'high',
          status: 'open',
          source: 'manual',
          kind: 'CONFIGURATION',
          isGuided: true,
          dueDate: offboardDate,
          guidance: {
            why: 'ISO 27001 A.6.5 requires all access to be revoked promptly on termination.',
            evidenceHint: 'Screenshot of deprovisioning checklist completed',
            stepByStep: ['Remove from SSO', 'Revoke GitHub access', 'Disable AWS IAM', 'Archive email'],
            estimatedMinutes: 60,
            controlCategory: 'HR Security',
          },
        },
        {
          orgId,
          title: `[Compliance] Transfer RACI assignments — ${user.fullName}`,
          description: `Transfer ${accountableCount} Accountable (A) RACI assignment(s) from ${user.fullName} to another qualified user before offboarding is complete.`,
          priority: accountableCount > 0 ? 'critical' : 'medium',
          status: 'open',
          source: 'manual',
          kind: 'CONFIGURATION',
          isGuided: true,
          dueDate: offboardDate,
          guidance: {
            why: 'Every control must have an Accountable owner. Offboarding blocks until all A assignments are transferred.',
            evidenceHint: 'RACI matrix showing new assignments',
            stepByStep: ['Go to RACI Matrix', 'For each A assignment', 'Assign to another team member'],
            estimatedMinutes: 30,
            controlCategory: 'Access Control',
          },
        },
      ],
    });

    // Audit log
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'user.offboard.initiated',
        targetType: 'User',
        targetId: targetUserId,
        after: { offboardDate: offboardDate.toISOString(), accountableControlsToTransfer: accountableCount },
      },
    });

    this.logger.log(`Offboarding initiated for ${user.email}, ${accountableCount} A-RACI to transfer`);

    return {
      userId: targetUserId,
      status: 'offboarding',
      offboardDate,
      accountableControlsToTransfer: accountableCount,
      tasksCreated: 2,
    };
  }

  /** Get the team audit log */
  async getAuditLog(orgId: string, limit = 50) {
    return this.prisma.teamAuditLog.findMany({
      where: { orgId },
      include: {
        actor: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async countSodConflictsForUser(orgId: string, userId: string): Promise<number> {
    const rAssignments = await this.prisma.raciAssignment.findMany({
      where: { orgId, userId, raci: 'R' },
      select: { controlId: true },
    });
    const rControlIds = new Set(rAssignments.map((a) => a.controlId));

    const aAssignments = await this.prisma.raciAssignment.findMany({
      where: { orgId, userId, raci: 'A' },
      select: { controlId: true },
    });

    return aAssignments.filter((a) => rControlIds.has(a.controlId)).length;
  }
}
