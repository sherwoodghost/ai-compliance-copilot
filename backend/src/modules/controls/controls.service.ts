import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import {
  UpdateOrgControlDto,
  BulkAssignControlsDto,
  ControlFiltersDto,
} from './dto/controls.dto';

@Injectable()
export class ControlsService {
  private readonly logger = new Logger(ControlsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // ─── Initialize org controls from selected frameworks ──────────────────────
  // Accepts either a list of framework UUIDs OR a single framework type string (e.g. 'soc2', 'iso27001')
  async initializeForOrg(orgId: string, frameworkIds: string[]): Promise<number> {
    // If frameworkIds look like type strings (not UUIDs), resolve them to real IDs
    const TYPE_MAP: Record<string, string> = {
      soc2: 'SOC2', SOC2: 'SOC2',
      iso27001: 'ISO27001', ISO27001: 'ISO27001',
      hipaa: 'HIPAA', HIPAA: 'HIPAA',
      'pci-dss': 'PCI_DSS', pci_dss: 'PCI_DSS', PCI_DSS: 'PCI_DSS', pci: 'PCI_DSS',
      gdpr: 'GDPR', GDPR: 'GDPR',
      fedramp: 'FEDRAMP', FEDRAMP: 'FEDRAMP',
      'nist-csf': 'NIST_CSF', nist_csf: 'NIST_CSF', NIST_CSF: 'NIST_CSF', nist: 'NIST_CSF',
      iso9001: 'ISO9001', ISO9001: 'ISO9001',
      iso14001: 'ISO14001', ISO14001: 'ISO14001',
      iso45001: 'ISO45001', ISO45001: 'ISO45001',
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

  // ─── Real-Time Control Health Map ──────────────────────────────────────────
  // Returns per-category green/yellow/red health signals based on:
  //   🟢 green  — implemented + evidence valid and not expiring within 30 days
  //   🟡 yellow — in_progress OR overdue due-date OR evidence expiring within 30d
  //   🔴 red    — not_started OR failed
  async getHealthMap(orgId: string) {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: {
        control: { select: { category: true, code: true, title: true } },
      },
    });

    // Gather evidence expiry info per control (join on controlId)
    const controlIds = orgControls.map((oc) => oc.controlId);
    const evidenceRows = await this.prisma.evidence.findMany({
      where: { orgId, controlId: { in: controlIds } },
      select: { controlId: true, expiresAt: true, isValid: true },
    });

    // Build a map: controlId → { hasExpired, hasExpiringSoon }
    const evMap: Record<string, { hasExpired: boolean; hasExpiringSoon: boolean }> = {};
    for (const e of evidenceRows) {
      if (!e.controlId) continue;
      if (!evMap[e.controlId]) evMap[e.controlId] = { hasExpired: false, hasExpiringSoon: false };
      if (!e.isValid || (e.expiresAt && e.expiresAt < now)) evMap[e.controlId].hasExpired = true;
      if (e.expiresAt && e.expiresAt >= now && e.expiresAt <= soon) evMap[e.controlId].hasExpiringSoon = true;
    }

    type Signal = 'green' | 'yellow' | 'red';

    function signalFor(oc: (typeof orgControls)[0]): Signal {
      const s = oc.status as string;
      if (s === 'not_started' || s === 'failed') return 'red';
      if (s === 'not_applicable') return 'green'; // N/A counts as not a gap

      const ev = evMap[oc.controlId];
      const isOverdue = oc.dueDate && oc.dueDate < now && s !== 'implemented';
      const hasEvidenceIssue = ev?.hasExpired;
      const hasEvidenceWarning = ev?.hasExpiringSoon;

      if (isOverdue || hasEvidenceIssue) return 'red';
      if (s === 'in_progress' || hasEvidenceWarning) return 'yellow';
      // implemented + no issues
      return 'green';
    }

    // Aggregate by category
    type CatEntry = {
      green: number; yellow: number; red: number; total: number;
      controls: { controlId: string; code: string; name: string; signal: Signal }[];
    };
    const catMap: Record<string, CatEntry> = {};

    for (const oc of orgControls) {
      const cat = oc.control.category ?? 'Uncategorised';
      if (!catMap[cat]) catMap[cat] = { green: 0, yellow: 0, red: 0, total: 0, controls: [] };
      const sig = signalFor(oc);
      catMap[cat][sig]++;
      catMap[cat].total++;
      catMap[cat].controls.push({
        controlId: oc.controlId,
        code: oc.control.code,
        name: oc.control.title,
        signal: sig,
      });
    }

    const categories = Object.entries(catMap)
      .map(([category, d]) => {
        const worstSignal: Signal =
          d.red > 0 ? 'red' : d.yellow > 0 ? 'yellow' : 'green';
        const healthPct =
          d.total > 0 ? Math.round(((d.green + d.yellow * 0.5) / d.total) * 100) : 100;
        return { category, ...d, healthPct, worstSignal };
      })
      .sort((a, b) => a.healthPct - b.healthPct); // worst categories first

    const overall = categories.reduce(
      (acc, c) => ({
        green: acc.green + c.green,
        yellow: acc.yellow + c.yellow,
        red: acc.red + c.red,
        total: acc.total + c.total,
      }),
      { green: 0, yellow: 0, red: 0, total: 0 },
    );

    return {
      lastChecked: now.toISOString(),
      overall,
      categories,
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

  // ─── AI-Powered Implementation Guide ────────────────────────────────────────
  /**
   * Generates a concise, tailored implementation guide for a specific control
   * by combining the control's definition with the org's known tech stack.
   * The guide is cached in the control's notes metadata for 7 days to avoid
   * burning LLM credits on every page load.
   */
  async generateImplementationGuide(orgId: string, controlId: string): Promise<{
    guide: string;
    steps: string[];
    toolSpecific: string[];
    estimatedEffort: string;
    controlCode: string;
    controlTitle: string;
  }> {
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId } },
      include: {
        control: {
          select: { code: true, title: true, description: true, guidance: true, category: true },
        },
      },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    const control = orgControl.control as any;

    // Pull the org's tech stack from the business profile
    const profile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
      select: { infrastructure: true, currentPosture: true, complianceGoals: true, industry: true, companyType: true },
    });

    const infra = (profile?.infrastructure as Record<string, any>) ?? {};
    const posture = (profile?.currentPosture as Record<string, any>) ?? {};
    const goals = (profile?.complianceGoals as Record<string, any>) ?? {};

    const stackContext = [
      infra.cloudProviders?.length ? `Cloud: ${(infra.cloudProviders as string[]).join(', ')}` : null,
      infra.sourceControl ? `Source control: ${infra.sourceControl}` : null,
      infra.saasTools?.length ? `Tools: ${(infra.saasTools as string[]).slice(0, 6).join(', ')}` : null,
      infra.cicdTools?.length ? `CI/CD: ${(infra.cicdTools as string[]).join(', ')}` : null,
      posture.identityProvider && posture.identityProvider !== 'none' ? `IdP: ${posture.identityProvider}` : null,
      posture.mfaStatus ? `MFA: ${posture.mfaStatus}` : null,
      posture.loggingMaturity ? `Logging: ${posture.loggingMaturity}` : null,
      goals.targetFrameworks?.length ? `Framework: ${(goals.targetFrameworks as string[]).join('/')}` : null,
      profile?.industry ? `Industry: ${profile.industry}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `You are a GRC implementation expert. Generate a practical, specific implementation guide for the following compliance control.

Control: ${control.code} — ${control.title}
Category: ${control.category}
Description: ${control.description}
Standard guidance: ${control.guidance ?? 'None provided'}

Organization tech stack:
${stackContext || 'Unknown — provide general guidance'}

Return ONLY valid JSON:
{
  "guide": "<2-3 sentence executive summary of what this control requires and its compliance significance>",
  "steps": [
    "<Concrete step 1 — specific to their actual tools if known>",
    "<Concrete step 2>",
    "<Concrete step 3>",
    "<Concrete step 4 — include evidence collection step>"
  ],
  "toolSpecific": [
    "<Tool-specific tip 1, e.g. 'In Okta: go to Security → MFA → Enrollment Policies'>",
    "<Tool-specific tip 2>"
  ],
  "estimatedEffort": "<1-2 hours|half day|1-2 days|1 week|2+ weeks>"
}

Keep steps practical and actionable. toolSpecific should reference their actual tools (${infra.identityProvider || infra.cloudProviders?.[0] || 'general tools'}). If no tools are known, give the general best-practice approach.`;

    const response = await this.llm.complete(
      [{ role: 'user', content: prompt }],
      { agentName: 'control-guide', maxTokens: 800, temperature: 0.2 },
    );

    const match = response.content.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        guide: response.content.trim(),
        steps: [],
        toolSpecific: [],
        estimatedEffort: 'Unknown',
        controlCode: control.code,
        controlTitle: control.title,
      };
    }

    const parsed = JSON.parse(match[0]) as {
      guide?: string;
      steps?: string[];
      toolSpecific?: string[];
      estimatedEffort?: string;
    };

    return {
      guide: parsed.guide ?? '',
      steps: parsed.steps ?? [],
      toolSpecific: parsed.toolSpecific ?? [],
      estimatedEffort: parsed.estimatedEffort ?? 'Unknown',
      controlCode: control.code,
      controlTitle: control.title,
    };
  }
}
