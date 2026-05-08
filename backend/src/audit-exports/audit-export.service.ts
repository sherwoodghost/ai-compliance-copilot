import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import archiver from 'archiver';
import { PassThrough } from 'stream';

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

  /**
   * Generate a complete Audit Package ZIP containing:
   * - COVER_SHEET.txt
   * - control-matrix.json
   * - policies/ (all approved policies as markdown)
   * - evidence/evidence-index.json
   * - risks/risk-register.json
   * - management-reviews/ (if any)
   * - DISCLAIMER.txt
   */
  async generateAuditPackageZip(orgId: string, generatedBy?: string): Promise<Buffer> {
    const [profile, controls, policies, evidence, risks, readinessScore, reviews] = await Promise.all([
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { include: { framework: true } } },
        orderBy: { control: { code: 'asc' } },
      }),
      this.prisma.policy.findMany({
        where: { orgId, status: 'approved' },
        orderBy: { title: 'asc' },
      }),
      this.prisma.evidence.findMany({
        where: { orgId, isValid: true },
        orderBy: { collectedAt: 'desc' },
        take: 500,
      }),
      this.prisma.riskItem.findMany({
        where: { orgId },
        orderBy: { riskScore: 'desc' },
        take: 100,
      }),
      this.prisma.readinessScore.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: 'desc' },
      }),
      this.prisma.managementReview.findMany({
        where: { orgId },
        orderBy: { scheduledAt: 'desc' },
        take: 10,
      }).catch(() => []),
    ]);

    const pd = (profile as any) ?? {};
    const companyName = pd.companyName ?? 'Your Organization';
    const frameworks  = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');
    const score       = (readinessScore as any)?.overallScore ?? 0;
    const generatedAt = new Date().toISOString();

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const pass    = new PassThrough();
      const chunks: Buffer[] = [];

      pass.on('data', (chunk) => chunks.push(chunk));
      pass.on('end',  () => resolve(Buffer.concat(chunks)));
      pass.on('error', reject);
      archive.on('error', reject);
      archive.pipe(pass);

      // ── COVER_SHEET.txt ─────────────────────────────────────────────────────
      const coverSheet = [
        '═══════════════════════════════════════════════════════════════════',
        `  AUDIT PREPARATION PACKAGE`,
        '═══════════════════════════════════════════════════════════════════',
        `  Organization:  ${companyName}`,
        `  Frameworks:    ${frameworks}`,
        `  Readiness:     ${score}%`,
        `  Generated:     ${generatedAt}`,
        `  Generated by:  AI Compliance Copilot`,
        '',
        '  CONTENTS',
        '  ─────────────────────────────────────────────────────────────────',
        '  • COVER_SHEET.txt         This file',
        '  • DISCLAIMER.txt          Important legal notice',
        '  • control-matrix.json     Full control status matrix',
        `  • policies/               ${policies.length} approved compliance policies`,
        `  • evidence/               ${evidence.length} valid evidence records (index)`,
        '  • risks/                  Risk register snapshot',
        `  • management-reviews/     ${(reviews as any[]).length} management review records`,
        '',
        AUDIT_DISCLAIMER.trim(),
      ].join('\n');
      archive.append(coverSheet, { name: 'COVER_SHEET.txt' });

      // ── DISCLAIMER.txt ──────────────────────────────────────────────────────
      archive.append(AUDIT_DISCLAIMER.trim(), { name: 'DISCLAIMER.txt' });

      // ── control-matrix.json ─────────────────────────────────────────────────
      const matrix = {
        generatedAt,
        organization: companyName,
        totalControls: controls.length,
        implemented: controls.filter((c) => c.status === 'implemented').length,
        inProgress:  controls.filter((c) => c.status === 'in_progress').length,
        notStarted:  controls.filter((c) => c.status === 'not_started').length,
        controls: controls.map((oc) => ({
          framework: (oc.control as any).framework?.type ?? 'unknown',
          code:       oc.control.code,
          title:      oc.control.title,
          status:     oc.status,
          score:      oc.score,
          assignedTo: oc.assignedTo,
          dueDate:    oc.dueDate,
        })),
      };
      archive.append(JSON.stringify(matrix, null, 2), { name: 'control-matrix.json' });

      // ── policies/ ──────────────────────────────────────────────────────────
      for (const policy of policies) {
        const safeTitle = policy.title.replace(/[^a-z0-9\-_\s]/gi, '').replace(/\s+/g, '-').toLowerCase().slice(0, 60);
        const md = [
          `# ${policy.title}`,
          '',
          `**Status:** ${policy.status}`,
          `**Version:** ${policy.version}`,
          `**Approved:** ${policy.approvedAt?.toISOString() ?? 'N/A'}`,
          `**Framework:** ${(policy as any).framework ?? 'N/A'}`,
          '',
          '---',
          '',
          (policy as any).content ?? '',
        ].join('\n');
        archive.append(md, { name: `policies/${safeTitle}.md` });
      }

      // ── evidence/evidence-index.json ───────────────────────────────────────
      const evidenceIndex = {
        generatedAt,
        totalRecords: evidence.length,
        records: evidence.map((e) => ({
          id:          e.id,
          title:       e.title,
          type:        e.type,
          source:      e.source,
          controlId:   e.controlId,
          collectedAt: e.collectedAt,
          expiresAt:   e.expiresAt,
          isValid:     e.isValid,
        })),
      };
      archive.append(JSON.stringify(evidenceIndex, null, 2), { name: 'evidence/evidence-index.json' });

      // ── risks/risk-register.json ────────────────────────────────────────────
      const riskRegister = {
        generatedAt,
        totalRisks: risks.length,
        openRisks:  risks.filter((r) => r.status === 'open').length,
        risks: risks.map((r) => ({
          id:          r.id,
          title:       r.title,
          severity:    r.severity,
          status:      r.status,
          likelihood:  r.likelihood,
          impact:      r.impact,
          riskScore:   r.riskScore,
          category:    (r as any).category ?? null,
        })),
      };
      archive.append(JSON.stringify(riskRegister, null, 2), { name: 'risks/risk-register.json' });

      // ── management-reviews/ ─────────────────────────────────────────────────
      for (const review of reviews as any[]) {
        const dateStr = (review.scheduledAt ?? review.createdAt)?.toISOString?.()?.split('T')[0] ?? 'unknown';
        archive.append(JSON.stringify(review, null, 2), { name: `management-reviews/review-${dateStr}.json` });
      }

      archive.finalize();
    });
  }
}
