import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

const AUDIT_DISCLAIMER = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISCLAIMER
This report reflects an internal readiness assessment only.
It does NOT constitute an official SOC 2 audit opinion, ISO 27001
certification, or any other form of external attestation.
Certification requires engagement with an accredited third-party auditor.
This document has not been reviewed or approved by any auditing body.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

@Injectable()
export class AuditExportService {
  private readonly logger = new Logger(AuditExportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate SOC 2 readiness report (structured JSON + markdown).
   */
  async generateSoc2ReadinessReport(orgId: string, generatedBy?: string) {
    const [profile, controls, policies, evidence, risks, readinessScore, scope] = await Promise.all([
      this.prisma.businessProfile.findUnique({ where: { orgId } }),
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { include: { framework: true, evidenceRequirements: true, policyRequirements: true } } },
        orderBy: { control: { code: 'asc' } },
      }),
      this.prisma.policy.findMany({
        where: { orgId, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.evidence.findMany({
        where: { orgId },
        orderBy: { collectedAt: 'desc' },
      }),
      this.prisma.riskItem.findMany({
        where: { orgId },
        orderBy: { riskScore: 'desc' },
        take: 50,
      }),
      this.prisma.readinessScore.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: 'desc' },
      }),
      this.prisma.soc2Scope.findFirst({
        where: { orgId, status: { not: 'superseded' } },
        orderBy: { version: 'desc' },
      }),
    ]);

    const soc2Controls = controls.filter((c) => c.control.framework.type === 'SOC2');

    const content = {
      disclaimer: AUDIT_DISCLAIMER.trim(),
      generatedAt: new Date().toISOString(),
      organization: {
        name: profile?.companyName ?? 'Unknown',
        industry: profile?.industry,
        framework: 'SOC 2',
        auditType: scope?.auditType ?? 'type_ii',
        trustServiceCategories: scope?.trustServiceCategories ?? ['security'],
      },
      readinessScore: readinessScore?.overallScore ?? 0,
      controlMatrix: soc2Controls.map((oc) => ({
        code: oc.control.code,
        title: oc.control.title,
        status: oc.status,
        score: oc.score,
        dueDate: oc.dueDate,
        hasPolicies: policies.some((p) => p.controlId === oc.controlId && p.status === 'approved'),
        hasEvidence: evidence.some((e) => e.controlId === oc.controlId && e.isValid),
      })),
      policyInventory: policies.map((p) => ({
        title: p.title,
        status: p.status,
        version: p.version,
        approvedAt: p.approvedAt,
      })),
      evidenceIndex: evidence.map((e) => ({
        title: e.title,
        type: e.type,
        source: e.source,
        collectedAt: e.collectedAt,
        expiresAt: e.expiresAt,
        isValid: e.isValid,
      })),
      riskSummary: {
        total: risks.length,
        open: risks.filter((r) => r.status === 'open').length,
        highCritical: risks.filter((r) => ['high', 'critical'].includes(r.severity ?? '')).length,
      },
    };

    const record = await this.prisma.auditExport.create({
      data: {
        orgId,
        exportType: 'soc2_readiness',
        framework: 'SOC2',
        status: 'draft',
        content: content as any,
        disclaimerIncluded: true,
        generatedBy: generatedBy ?? null,
        dataSnapshotAt: new Date(),
      },
    });

    this.logger.log(`Generated SOC 2 readiness report for org ${orgId}: export ${record.id}`);
    return record;
  }

  /**
   * Generate ISO 27001 Statement of Applicability export.
   */
  async generateIsoSoa(orgId: string, generatedBy?: string) {
    const [profile, soaEntries, isoScope] = await Promise.all([
      this.prisma.businessProfile.findUnique({ where: { orgId } }),
      this.prisma.isoStatementOfApplicability.findMany({
        where: { orgId },
        include: { control: { include: { framework: true } } },
        orderBy: { control: { code: 'asc' } },
      }),
      this.prisma.iso27001Scope.findFirst({
        where: { orgId, status: { not: 'superseded' } },
        orderBy: { version: 'desc' },
      }),
    ]);

    const content = {
      disclaimer: AUDIT_DISCLAIMER.trim(),
      generatedAt: new Date().toISOString(),
      organization: { name: profile?.companyName ?? 'Unknown', framework: 'ISO 27001:2022' },
      ismsScope: isoScope?.ismsScope ?? 'Not defined',
      statementOfApplicability: soaEntries.map((entry) => ({
        controlCode: entry.control.code,
        controlTitle: entry.control.title,
        applicable: entry.applicable,
        rationale: entry.applicabilityRationale,
        implementationStatus: entry.implementationStatus,
        evidenceReferences: entry.evidenceReferences,
      })),
      totals: {
        total: soaEntries.length,
        applicable: soaEntries.filter((e) => e.applicable).length,
        notApplicable: soaEntries.filter((e) => !e.applicable).length,
      },
    };

    const record = await this.prisma.auditExport.create({
      data: {
        orgId,
        exportType: 'iso_soa',
        framework: 'ISO27001',
        status: 'draft',
        content: content as any,
        disclaimerIncluded: true,
        generatedBy: generatedBy ?? null,
        dataSnapshotAt: new Date(),
      },
    });

    return record;
  }

  /**
   * Generate a control matrix export (both frameworks).
   */
  async generateControlMatrix(orgId: string, generatedBy?: string) {
    const controls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: {
        control: { include: { framework: true } },
      },
      orderBy: [{ control: { framework: { type: 'asc' } } }, { control: { code: 'asc' } }],
    });

    const content = {
      disclaimer: AUDIT_DISCLAIMER.trim(),
      generatedAt: new Date().toISOString(),
      controls: controls.map((oc) => ({
        framework: oc.control.framework.type,
        code: oc.control.code,
        title: oc.control.title,
        status: oc.status,
        score: oc.score,
        assignedTo: oc.assignedTo,
        dueDate: oc.dueDate,
        notes: oc.notes,
      })),
    };

    return this.prisma.auditExport.create({
      data: {
        orgId,
        exportType: 'control_matrix',
        framework: 'BOTH',
        status: 'draft',
        content: content as any,
        disclaimerIncluded: true,
        generatedBy: generatedBy ?? null,
        dataSnapshotAt: new Date(),
      },
    });
  }

  async listExports(orgId: string) {
    return this.prisma.auditExport.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getExport(id: string) {
    return this.prisma.auditExport.findUnique({ where: { id } });
  }
}
