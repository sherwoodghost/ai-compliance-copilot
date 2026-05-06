import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface Soc2ScopeInput {
  trustServiceCategories: string[];
  auditType: 'type_i' | 'type_ii';
  systemsInScope: Array<{ name: string; description: string; rationale: string }>;
  systemsOutOfScope: Array<{ name: string; reason: string }>;
  dataInScope: Array<{ type: string; description: string }>;
  ambiguousItems: Array<{ item: string; question: string }>;
}

export interface IsoScopeInput {
  ismsScope: string;
  boundaries: string;
  interestedParties: Array<{ party: string; interest: string; needs: string }>;
  internalIssues: string[];
  externalIssues: string[];
  exclusions: Array<{ control: string; rationale: string }>;
  exclusionRationale: string;
}

@Injectable()
export class ScopingService {
  private readonly logger = new Logger(ScopingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── SOC 2 Scope ──────────────────────────────────────────────────────────────

  async createSoc2Scope(orgId: string, workflowId: string | undefined, input: Soc2ScopeInput) {
    // Supersede any existing draft
    await this.prisma.soc2Scope.updateMany({
      where: { orgId, status: 'draft' },
      data: { status: 'superseded' },
    });

    const latest = await this.prisma.soc2Scope.findFirst({
      where: { orgId },
      orderBy: { version: 'desc' },
    });

    return this.prisma.soc2Scope.create({
      data: {
        orgId,
        workflowId: workflowId ?? null,
        trustServiceCategories: input.trustServiceCategories as any,
        auditType: input.auditType,
        systemsInScope: input.systemsInScope as any,
        systemsOutOfScope: input.systemsOutOfScope as any,
        dataInScope: input.dataInScope as any,
        ambiguousItems: input.ambiguousItems as any,
        status: 'draft',
        version: (latest?.version ?? 0) + 1,
      },
    });
  }

  async approveSoc2Scope(scopeId: string, approvedBy: string) {
    return this.prisma.soc2Scope.update({
      where: { id: scopeId },
      data: { status: 'approved', approvedBy, approvedAt: new Date() },
    });
  }

  async getCurrentSoc2Scope(orgId: string) {
    return this.prisma.soc2Scope.findFirst({
      where: { orgId, status: { not: 'superseded' } },
      orderBy: [{ status: 'asc' }, { version: 'desc' }], // approved first, then draft
    });
  }

  // ── ISO 27001 Scope ──────────────────────────────────────────────────────────

  async createIsoScope(orgId: string, input: IsoScopeInput) {
    await this.prisma.iso27001Scope.updateMany({
      where: { orgId, status: 'draft' },
      data: { status: 'superseded' },
    });

    const latest = await this.prisma.iso27001Scope.findFirst({
      where: { orgId },
      orderBy: { version: 'desc' },
    });

    return this.prisma.iso27001Scope.create({
      data: {
        orgId,
        ismsScope: input.ismsScope,
        boundaries: input.boundaries,
        interestedParties: input.interestedParties as any,
        internalIssues: input.internalIssues as any,
        externalIssues: input.externalIssues as any,
        exclusions: input.exclusions as any,
        exclusionRationale: input.exclusionRationale,
        status: 'draft',
        version: (latest?.version ?? 0) + 1,
      },
    });
  }

  async approveIsoScope(scopeId: string, approvedBy: string) {
    return this.prisma.iso27001Scope.update({
      where: { id: scopeId },
      data: { status: 'approved', approvedBy, approvedAt: new Date() },
    });
  }

  async getCurrentIsoScope(orgId: string) {
    return this.prisma.iso27001Scope.findFirst({
      where: { orgId, status: { not: 'superseded' } },
      orderBy: [{ status: 'asc' }, { version: 'desc' }],
    });
  }

  // ── Statement of Applicability ────────────────────────────────────────────────

  async generateSoa(orgId: string) {
    const isoScope = await this.getCurrentIsoScope(orgId);
    if (!isoScope) throw new Error('No ISO 27001 scope defined for org');

    const applicability = await this.prisma.controlApplicability.findMany({
      where: { orgId },
      include: { control: { include: { framework: { select: { type: true } } } } },
    });

    const isoApplicability = applicability.filter((a) => a.control.framework.type === 'ISO27001');

    // Upsert SoA entries
    for (const item of isoApplicability) {
      await this.prisma.isoStatementOfApplicability.upsert({
        where: {
          isoScopeId_controlId: { isoScopeId: isoScope.id, controlId: item.controlId },
        },
        create: {
          orgId,
          isoScopeId: isoScope.id,
          controlId: item.controlId,
          applicable: item.applicable,
          applicabilityRationale: item.rationale ?? null,
          implementationStatus: item.applicabilityStatus,
          evidenceReferences: [],
          version: 1,
        },
        update: {
          applicable: item.applicable,
          applicabilityRationale: item.rationale ?? null,
          implementationStatus: item.applicabilityStatus,
        },
      });
    }

    this.logger.log(`Generated SoA for org ${orgId} with ${isoApplicability.length} entries`);

    return this.prisma.isoStatementOfApplicability.findMany({
      where: { orgId, isoScopeId: isoScope.id },
      include: { control: { include: { framework: true } } },
      orderBy: { control: { code: 'asc' } },
    });
  }

  async getSoa(orgId: string) {
    const isoScope = await this.getCurrentIsoScope(orgId);
    if (!isoScope) return [];

    return this.prisma.isoStatementOfApplicability.findMany({
      where: { orgId, isoScopeId: isoScope.id },
      include: { control: { include: { framework: true } } },
      orderBy: { control: { code: 'asc' } },
    });
  }
}
