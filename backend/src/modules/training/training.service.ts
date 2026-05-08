import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all active training modules */
  async listModules() {
    return this.prisma.trainingModule.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });
  }

  /** Get one module */
  async getModule(moduleId: string) {
    const mod = await this.prisma.trainingModule.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Training module not found');
    return mod;
  }

  /** Get training assignments for an org */
  async getOrgAssignments(orgId: string) {
    return this.prisma.trainingAssignment.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        module: { select: { id: true, title: true, kind: true, durationMin: true } },
        assignedByUser: { select: { id: true, fullName: true } },
      } as any,
      orderBy: { dueDate: 'asc' },
    });
  }

  /** Get assignments for a specific user */
  async getUserAssignments(userId: string, orgId: string) {
    return this.prisma.trainingAssignment.findMany({
      where: { userId, orgId },
      include: {
        module: true,
      } as any,
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Assign a training module to a user.
   * Idempotent: returns existing assignment if already assigned.
   */
  async assignModule(
    orgId: string,
    userId: string,
    moduleId: string,
    assignedBy: string,
    dueDate?: Date,
  ) {
    const mod = await this.prisma.trainingModule.findUnique({ where: { id: moduleId } });
    if (!mod) throw new NotFoundException('Training module not found');

    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new NotFoundException('User not found in this organization');

    // Check for existing incomplete assignment
    const existing = await this.prisma.trainingAssignment.findFirst({
      where: { orgId, userId, moduleId, completedAt: null } as any,
    });
    if (existing) return existing;

    const due = dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days default

    const assignment = await this.prisma.trainingAssignment.create({
      data: {
        orgId,
        userId,
        moduleId,
        assignedBy,
        dueDate: due,
      } as any,
      include: {
        module: true,
        user: { select: { id: true, fullName: true, email: true } },
      } as any,
    });

    this.logger.log(`Training module "${mod.title}" assigned to user ${userId} in org ${orgId}`);
    return assignment;
  }

  /**
   * Bulk-assign security awareness training to all active org users who haven't completed it.
   */
  async assignSecurityAwarenessToAll(orgId: string, assignedBy: string) {
    const SECURITY_AWARENESS_MODULE_ID = 'tm-security-awareness-001';

    const mod = await this.prisma.trainingModule.findUnique({
      where: { id: SECURITY_AWARENESS_MODULE_ID },
    });
    if (!mod) throw new NotFoundException('Security awareness module not found. Run the database seed first.');

    const users = await this.prisma.user.findMany({
      where: { orgId, status: 'active' },
      select: { id: true },
    } as any);

    let assigned = 0;
    let skipped = 0;

    for (const user of users) {
      try {
        const result = await this.assignModule(orgId, user.id, SECURITY_AWARENESS_MODULE_ID, assignedBy);
        if ((result as any).completedAt) { skipped++; } else { assigned++; }
      } catch {
        skipped++;
      }
    }

    return { assigned, skipped, total: users.length };
  }

  /**
   * Mark a training assignment as complete.
   * Generates evidence mapped to ISO A.6.3.
   */
  async completeAssignment(
    orgId: string,
    assignmentId: string,
    userId: string,
    score?: number,
  ) {
    const assignment = await this.prisma.trainingAssignment.findFirst({
      where: { id: assignmentId, orgId, userId } as any,
      include: {
        module: true,
        user: { select: { id: true, fullName: true } },
      } as any,
    });

    if (!assignment) throw new NotFoundException('Training assignment not found');
    if ((assignment as any).completedAt) {
      throw new BadRequestException('This training has already been completed');
    }

    const mod = (assignment as any).module;
    const passingScore = (mod?.content as any)?.passingScore ?? 80;

    if (score !== undefined && score < passingScore) {
      throw new BadRequestException(`Score ${score}% is below the passing threshold of ${passingScore}%`);
    }

    const completedAt = new Date();

    // Update assignment
    const completed = await this.prisma.trainingAssignment.update({
      where: { id: assignmentId },
      data: {
        completedAt,
        score,
      } as any,
    });

    // Generate evidence for ISO A.6.3
    const evidenceTitle = `Training Completion: ${mod.title} — ${(assignment as any).user?.fullName ?? 'User'} — ${completedAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

    try {
      // Find ISO A.6.3 org control
      const orgControl = await this.prisma.organizationControl.findFirst({
        where: { orgId, control: { code: 'A.6.3' } },
        include: { control: { select: { id: true } } },
      });

      const evidence = await this.prisma.evidence.create({
        data: {
          orgId,
          title: evidenceTitle,
          description: `${(assignment as any).user?.fullName ?? 'User'} completed "${mod.title}" training${score !== undefined ? ` with a score of ${score}%` : ''}. Control: ISO A.6.3 Security Awareness Training.`,
          fileType: 'application/json',
          fileSize: 512,
          storageUrl: `evidence/training/${assignmentId}/completion.json`,
          uploadedBy: userId,
          controlId: (orgControl as any)?.control?.id,
          reviewedBy: userId,
          expiresAt: new Date(completedAt.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
        } as any,
      });

      // Map to training controls
      if (orgControl) {
        await this.prisma.controlEvidence.create({
          data: {
            evidenceId: evidence.id,
            controlId: (orgControl as any).control.id,
            orgId,
            confidence: 100,
            mappedBy: 'training_completion',
          } as any,
        }).catch(() => {});
      }

      // Update the assignment with evidence ID
      await this.prisma.trainingAssignment.update({
        where: { id: assignmentId },
        data: { evidenceId: evidence.id } as any,
      });

      this.logger.log(`Training "${mod.title}" completed by ${userId}. Evidence: ${evidence.id}`);

      return { assignment: completed, evidence };
    } catch (err) {
      this.logger.warn(`Evidence generation failed (non-fatal): ${(err as Error).message}`);
      return { assignment: completed };
    }
  }

  /** Org-level training completion stats */
  async getStats(orgId: string) {
    const [assignments, users] = await Promise.all([
      this.prisma.trainingAssignment.findMany({
        where: { orgId } as any,
        select: { userId: true, completedAt: true, moduleId: true },
      }),
      this.prisma.user.count({ where: { orgId, status: 'active' } as any }),
    ]);

    const completed   = assignments.filter((a) => (a as any).completedAt).length;
    const total       = assignments.length;
    const uniqueUsers = new Set(assignments.filter((a) => (a as any).completedAt).map((a) => a.userId)).size;

    return {
      totalAssignments:    total,
      completedAssignments: completed,
      pendingAssignments:  total - completed,
      completionRate:      total > 0 ? Math.round((completed / total) * 100) : 0,
      usersWithAny:        uniqueUsers,
      totalActiveUsers:    users,
      orgCompletionPct:    users > 0 ? Math.round((uniqueUsers / users) * 100) : 0,
    };
  }
}
