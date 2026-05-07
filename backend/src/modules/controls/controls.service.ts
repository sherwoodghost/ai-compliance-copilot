import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  UpdateOrgControlDto,
  BulkAssignControlsDto,
  ControlFiltersDto,
} from './dto/controls.dto';

@Injectable()
export class ControlsService {
  private readonly logger = new Logger(ControlsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Initialize org controls from selected frameworks ──────────────────────
  // Accepts either a list of framework UUIDs OR a single framework type string (e.g. 'soc2', 'iso27001')
  async initializeForOrg(orgId: string, frameworkIds: string[]): Promise<number> {
    // If frameworkIds look like type strings (not UUIDs), resolve them to real IDs
    const TYPE_MAP: Record<string, string> = {
      soc2: 'SOC2', SOC2: 'SOC2',
      iso27001: 'ISO27001', ISO27001: 'ISO27001',
      hipaa: 'HIPAA', HIPAA: 'HIPAA',
      pci_dss: 'PCI_DSS', PCI_DSS: 'PCI_DSS',
      gdpr: 'GDPR', GDPR: 'GDPR',
      fedramp: 'FEDRAMP', FEDRAMP: 'FEDRAMP',
    };
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const resolvedIds = await Promise.all(
      frameworkIds.map(async (id) => {
        if (uuidRegex.test(id)) return id;
        // Treat as a type string — map to enum value and look up
        const enumVal = TYPE_MAP[id.toLowerCase()] ?? TYPE_MAP[id] ?? id.toUpperCase();
        const fw = await this.prisma.framework.findFirst({
          where: { type: enumVal as any },
          select: { id: true },
        });
        return fw?.id ?? null;
      }),
    );
    const validIds = resolvedIds.filter((id): id is string => id !== null);

    const controls = await this.prisma.control.findMany({
      where: { frameworkId: { in: validIds } },
    });

    let created = 0;
    for (const control of controls) {
      const existing = await this.prisma.organizationControl.findUnique({
        where: { orgId_controlId: { orgId, controlId: control.id } },
      });
      if (!existing) {
        await this.prisma.organizationControl.create({
          data: { orgId, controlId: control.id },
        });
        created++;
      }
    }

    this.logger.log(`Initialized ${created} controls for org: ${orgId}`);
    return created;
  }

  // ─── List org controls with full joins ─────────────────────────────────────
  async findAll(orgId: string, filters: ControlFiltersDto) {
    const orgControls = await this.prisma.organizationControl.findMany({
      where: {
        orgId,
        ...(filters.status && { status: filters.status }),
        ...(filters.assignedTo && { assignedTo: filters.assignedTo }),
        control: {
          ...(filters.frameworkId && { frameworkId: filters.frameworkId }),
          ...(filters.category && { category: filters.category }),
        },
      },
      include: {
        control: {
          include: { framework: { select: { id: true, name: true, type: true } } },
        },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [
        { control: { category: 'asc' } },
        { control: { code: 'asc' } },
      ],
    });

    // Enrich with counts via separate queries (Evidence/Policy/Task link to Control, not OrgControl)
    const controlIds = orgControls.map((oc) => oc.controlId);
    const [evidenceCounts, policyCounts, taskCounts] = await Promise.all([
      this.prisma.evidence.groupBy({ by: ['controlId'], where: { orgId, controlId: { in: controlIds } }, _count: true }),
      this.prisma.policy.groupBy({ by: ['controlId'], where: { orgId, controlId: { in: controlIds } }, _count: true }),
      this.prisma.task.groupBy({ by: ['controlId'], where: { orgId, controlId: { in: controlIds } }, _count: true }),
    ]);

    const evMap = Object.fromEntries(evidenceCounts.map((e) => [e.controlId, e._count]));
    const polMap = Object.fromEntries(policyCounts.map((p) => [p.controlId, p._count]));
    const taskMap = Object.fromEntries(taskCounts.filter((t) => t.controlId).map((t) => [t.controlId!, t._count]));

    return orgControls.map((oc) => ({
      ...oc,
      _count: {
        evidence: evMap[oc.controlId] ?? 0,
        policies: polMap[oc.controlId] ?? 0,
        tasks: taskMap[oc.controlId] ?? 0,
      },
    }));
  }

  // ─── Single control with all evidence + policies ────────────────────────────
  async findOne(orgId: string, controlId: string) {
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId } },
      include: {
        control: { include: { framework: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    // Fetch related records by controlId (they link to Control, not OrgControl)
    const [evidence, policies, tasks, riskItems] = await Promise.all([
      this.prisma.evidence.findMany({
        where: { orgId, controlId },
        orderBy: { collectedAt: 'desc' },
        take: 20,
      }),
      this.prisma.policy.findMany({
        where: { orgId, controlId, status: { not: 'archived' as any } },
        orderBy: [{ version: 'desc' }],
      }),
      this.prisma.task.findMany({
        where: { orgId, controlId, status: { not: 'done' as any } },
        orderBy: { priority: 'asc' },
        include: { assignee: { select: { id: true, fullName: true } } },
      }),
      this.prisma.riskItem.findMany({
        where: { orgId, controlId, status: 'open' as any },
      }),
    ]);

    return { ...orgControl, evidence, policies, tasks, riskItems };
  }

  // ─── Update control status / score / assignment ─────────────────────────────
  async update(orgId: string, controlId: string, dto: UpdateOrgControlDto) {
    const existing = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId } },
    });
    if (!existing) throw new NotFoundException('Control not found');

    if (dto.assignedTo) {
      const user = await this.prisma.user.findFirst({
        where: { id: dto.assignedTo, orgId, isActive: true },
      });
      if (!user) throw new BadRequestException('Assigned user not found in this organization');
    }

    const updated = await this.prisma.organizationControl.update({
      where: { orgId_controlId: { orgId, controlId } },
      data: {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        lastReviewedAt: new Date(),
      },
      include: {
        control: true,
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });

    // Auto-apply crosswalk credits when a control is implemented
    if (dto.status === 'implemented') {
      this.applyCrosswalk(orgId, controlId).catch((err) =>
        this.logger.warn(`Crosswalk failed for control ${controlId}: ${err.message}`),
      );
    }

    return updated;
  }

  // ─── Auto Multi-Framework Crosswalk ────────────────────────────────────────
  private async applyCrosswalk(orgId: string, sourceControlId: string) {
    const crosswalks = await this.prisma.frameworkCrosswalk.findMany({
      where: {
        sourceControlId,
        mappingType: { in: ['equivalent', 'partial'] },
      },
      select: { targetControlId: true, mappingType: true },
    });

    if (!crosswalks.length) return;

    let credited = 0;
    for (const cw of crosswalks) {
      const orgControl = await this.prisma.organizationControl.findUnique({
        where: { orgId_controlId: { orgId, controlId: cw.targetControlId } },
      });

      if (orgControl && (orgControl.status as string) !== 'implemented') {
        const newStatus = cw.mappingType === 'equivalent' ? 'implemented' : 'in_progress';
        await this.prisma.organizationControl.update({
          where: { orgId_controlId: { orgId, controlId: cw.targetControlId } },
          data: {
            status: newStatus as any,
            notes: `Auto-credited via framework crosswalk (${cw.mappingType}) from control ${sourceControlId}`,
            lastReviewedAt: new Date(),
          },
        });
        credited++;
      }
    }

    if (credited > 0) {
      this.logger.log(`Crosswalk: credited ${credited} controls for org ${orgId} from source ${sourceControlId}`);
    }
  }

  // ─── Bulk assign controls to a user ────────────────────────────────────────
  async bulkAssign(orgId: string, dto: BulkAssignControlsDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.assignedTo, orgId, isActive: true },
    });
    if (!user) throw new BadRequestException('Assigned user not found');

    await this.prisma.organizationControl.updateMany({
      where: { orgId, controlId: { in: dto.controlIds } },
      data: { assignedTo: dto.assignedTo },
    });

    return { updated: dto.controlIds.length };
  }

  // ─── Compliance dashboard stats ─────────────────────────────────────────────
  async getStats(orgId: string, frameworkId?: string) {
    const baseWhere = {
      orgId,
      ...(frameworkId && { control: { frameworkId } }),
    };

    const [total, byStatus, scoreAgg, overdue] = await Promise.all([
      this.prisma.organizationControl.count({ where: baseWhere }),
      this.prisma.organizationControl.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { status: true },
      }),
      this.prisma.organizationControl.aggregate({
        where: baseWhere,
        _avg: { score: true },
        _sum: { score: true },
      }),
      this.prisma.organizationControl.count({
        where: {
          ...baseWhere,
          dueDate: { lt: new Date() },
          status: { notIn: ['implemented'] },
        },
      }),
    ]);

    const statusMap = Object.fromEntries(
      byStatus.map((s) => [s.status, s._count.status]),
    );

    return {
      total,
      byStatus: {
        not_started: statusMap['not_started'] ?? 0,
        in_progress: statusMap['in_progress'] ?? 0,
        implemented: statusMap['implemented'] ?? 0,
        failed: statusMap['failed'] ?? 0,
        not_applicable: statusMap['not_applicable'] ?? 0,
      },
      averageScore: Math.round(scoreAgg._avg.score ?? 0),
      overdue,
      compliancePercentage:
        total > 0
          ? Math.round(((statusMap['implemented'] ?? 0) / total) * 100)
          : 0,
    };
  }

  // ─── Get controls by category for heat-map view ─────────────────────────────
  async getHeatmap(orgId: string, frameworkId: string) {
    const controls = await this.prisma.organizationControl.findMany({
      where: { orgId, control: { frameworkId } },
      select: {
        status: true,
        score: true,
        control: { select: { category: true, weight: true } },
      },
    });

    const categoryMap: Record<string, { total: number; implemented: number; avgScore: number; scores: number[] }> = {};

    for (const c of controls) {
      const cat = c.control.category;
      if (!categoryMap[cat]) categoryMap[cat] = { total: 0, implemented: 0, avgScore: 0, scores: [] };
      categoryMap[cat].total++;
      if (c.status === 'implemented') categoryMap[cat].implemented++;
      categoryMap[cat].scores.push(c.score);
    }

    return Object.entries(categoryMap).map(([category, data]) => ({
      category,
      total: data.total,
      implemented: data.implemented,
      completionRate: Math.round((data.implemented / data.total) * 100),
      averageScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length),
    }));
  }
}
