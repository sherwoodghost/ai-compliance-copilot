import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RaciLetter } from '@prisma/client';

@Injectable()
export class RaciService {
  private readonly logger = new Logger(RaciService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Assign or update a RACI letter for a user on a control.
   * Enforces SoD invariant: a user holding A must not hold R on the same control,
   * and vice-versa.
   */
  async assign(
    orgId: string,
    controlId: string,
    userId: string,
    raci: RaciLetter,
    actorId: string,
  ) {
    // Verify control belongs to this org
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId } },
    });
    if (!orgControl) {
      throw new NotFoundException('Control not found for this organization');
    }

    // SoD enforcement
    if (raci === 'A' || raci === 'R') {
      const conflictLetter: RaciLetter = raci === 'A' ? 'R' : 'A';
      const conflict = await this.prisma.raciAssignment.findFirst({
        where: { orgId, controlId, userId, raci: conflictLetter },
      });
      if (conflict) {
        // Log the violation
        await this.prisma.teamAuditLog.create({
          data: {
            orgId,
            actorId,
            action: 'sod.violation.blocked',
            targetType: 'RaciAssignment',
            targetId: `${controlId}:${userId}`,
            after: {
              attempted: raci,
              conflict: conflictLetter,
              reason: `User cannot hold both ${conflictLetter} and ${raci} on the same control`,
            },
          },
        });

        throw new ForbiddenException(
          `Segregation of duties violation: this user already holds '${conflictLetter}' on this control. ` +
          `A user cannot be both Responsible (R) and Accountable (A) for the same control.`,
        );
      }
    }

    // Upsert the assignment
    const assignment = await this.prisma.raciAssignment.upsert({
      where: {
        orgId_controlId_userId_raci: { orgId, controlId, userId, raci },
      },
      create: { orgId, controlId, userId, raci, assignedBy: actorId },
      update: { assignedBy: actorId, assignedAt: new Date() },
    });

    // Audit log
    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'raci.assign',
        targetType: 'RaciAssignment',
        targetId: `${controlId}:${userId}`,
        after: { controlId, userId, raci },
      },
    });

    this.logger.log(`RACI ${raci} assigned: control=${controlId} user=${userId} actor=${actorId}`);
    return assignment;
  }

  /** Remove a RACI assignment */
  async remove(orgId: string, controlId: string, userId: string, raci: RaciLetter, actorId: string) {
    const existing = await this.prisma.raciAssignment.findFirst({
      where: { orgId, controlId, userId, raci },
    });
    if (!existing) return { removed: false };

    await this.prisma.raciAssignment.delete({ where: { id: existing.id } });

    await this.prisma.teamAuditLog.create({
      data: {
        orgId,
        actorId,
        action: 'raci.remove',
        targetType: 'RaciAssignment',
        targetId: `${controlId}:${userId}`,
        before: { controlId, userId, raci },
      },
    });

    return { removed: true };
  }

  /** Get the full RACI matrix for an org (top N controls by weight) */
  async getMatrix(orgId: string) {
    const [assignments, controls] = await Promise.all([
      this.prisma.raciAssignment.findMany({
        where: { orgId },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { select: { id: true, code: true, title: true, category: true, weight: true } } },
        orderBy: [{ control: { weight: 'desc' } }, { control: { code: 'asc' } }],
        take: 50,
      }),
    ]);

    return {
      controls: controls.map((oc) => ({
        controlId: oc.controlId,
        code: oc.control.code,
        title: oc.control.title,
        category: oc.control.category,
        weight: oc.control.weight,
      })),
      assignments: assignments.map((a) => ({
        id: a.id,
        controlId: a.controlId,
        userId: a.userId,
        userName: a.user.fullName,
        raci: a.raci,
      })),
    };
  }

  /** Detect SoD conflicts: controls where a user has both R and A */
  async getSodConflicts(orgId: string) {
    const rAssignments = await this.prisma.raciAssignment.findMany({
      where: { orgId, raci: 'R' },
      select: { controlId: true, userId: true },
    });

    const aAssignments = await this.prisma.raciAssignment.findMany({
      where: { orgId, raci: 'A' },
      select: { controlId: true, userId: true },
    });

    const aSet = new Set(aAssignments.map((a) => `${a.controlId}:${a.userId}`));
    const conflicts = rAssignments
      .filter((r) => aSet.has(`${r.controlId}:${r.userId}`))
      .map((r) => ({ controlId: r.controlId, userId: r.userId }));

    return { conflicts, count: conflicts.length };
  }

  /**
   * Auto-seed RACI assignments from ComplianceResponsibility records.
   * SECURITY_LEAD → A on CC6.*, A.5.*, A.8.*
   * IT_ADMIN      → R on A.8.2, A.9.1, A.9.2, A.9.4
   * ENGINEERING_LEAD → R on CC7.*, CC8.*
   * HR_LEAD       → R on A.6.*
   * DPO           → A on A.5.34, GDPR controls
   */
  async bulkFromResponsibilities(orgId: string, actorId: string) {
    const responsibilities = await this.prisma.complianceResponsibility.findMany({
      where: { orgId },
    });

    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: { control: { select: { id: true, code: true } } },
    });

    const codeToControlId = new Map(orgControls.map((oc) => [oc.control.code, oc.controlId]));

    const RESPONSIBILITY_RACI_RULES: Record<string, Array<{ prefix: string; raci: RaciLetter }>> = {
      SECURITY_LEAD:    [{ prefix: 'CC6', raci: 'A' }, { prefix: 'A.5', raci: 'A' }, { prefix: 'A.8', raci: 'A' }],
      COMPLIANCE_LEAD:  [{ prefix: 'CC1', raci: 'A' }, { prefix: 'CC2', raci: 'A' }],
      IT_ADMIN:         [{ prefix: 'A.8.2', raci: 'R' }, { prefix: 'A.9', raci: 'R' }],
      ENGINEERING_LEAD: [{ prefix: 'CC7', raci: 'R' }, { prefix: 'CC8', raci: 'R' }],
      HR_LEAD:          [{ prefix: 'A.6', raci: 'R' }],
      DPO:              [{ prefix: 'A.5.34', raci: 'A' }],
      RISK_OWNER:       [{ prefix: 'CC9', raci: 'A' }],
    };

    let created = 0;
    const errors: string[] = [];

    for (const resp of responsibilities) {
      const rules = RESPONSIBILITY_RACI_RULES[resp.role];
      if (!rules) continue;

      for (const rule of rules) {
        // Find all controls matching this prefix
        const matchingControls = [...codeToControlId.entries()]
          .filter(([code]) => code.startsWith(rule.prefix))
          .map(([, controlId]) => controlId);

        for (const controlId of matchingControls) {
          try {
            await this.assign(orgId, controlId, resp.userId, rule.raci, actorId);
            created++;
          } catch (err: any) {
            // SoD violations are skipped with a warning
            if (err instanceof ForbiddenException) {
              errors.push(`Skipped SoD conflict: user=${resp.userId} control=${controlId} raci=${rule.raci}`);
            }
            // Duplicate upserts are fine (already assigned)
          }
        }
      }
    }

    this.logger.log(`Bulk RACI seeded: ${created} assignments, ${errors.length} SoD conflicts skipped`);
    return { created, sodConflictsSkipped: errors.length, errors };
  }
}
