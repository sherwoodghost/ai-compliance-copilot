import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuditExportService } from '../../audit-exports/audit-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';
import { ReadinessService } from '../../readiness/readiness.service';

@Controller('audit-exports')
@UseGuards(JwtAuthGuard)
export class AuditExportsController {
  constructor(
    private readonly auditExportService: AuditExportService,
    private readonly llm:                LlmService,
    private readonly prisma:             PrismaService,
    private readonly readiness:          ReadinessService,
  ) {}

  @Get()
  async listExports(@Req() req: any) {
    return this.auditExportService.listExports(req.user.orgId);
  }

  @Get(':id')
  async getExport(@Param('id') id: string) {
    return this.auditExportService.getExport(id);
  }

  @Post('soc2-readiness')
  async generateSoc2Report(@Req() req: any) {
    return this.auditExportService.generateSoc2ReadinessReport(req.user.orgId, req.user.id);
  }

  @Post('iso-soa')
  async generateIsoSoa(@Req() req: any) {
    return this.auditExportService.generateIsoSoa(req.user.orgId, req.user.id);
  }

  @Post('control-matrix')
  async generateControlMatrix(@Req() req: any) {
    return this.auditExportService.generateControlMatrix(req.user.orgId, req.user.id);
  }

  @Post('ai-executive-summary')
  async generateExecutiveSummary(@Req() req: any) {
    const orgId = req.user.orgId;

    const [readiness, openHighRisks, overdueTasks, expiringEvidence, pendingExceptions, controlStats] = await Promise.all([
      this.readiness.getLatest(orgId),
      this.prisma.riskItem.findMany({
        where: { orgId, status: 'open', severity: { in: ['critical', 'high'] } },
        select: { title: true, severity: true, riskScore: true },
        orderBy: { riskScore: 'desc' },
        take: 5,
      }),
      this.prisma.task.count({ where: { orgId, status: { not: 'done' }, dueDate: { lt: new Date() } } }),
      this.prisma.evidence.count({
        where: { orgId, expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.controlException.count({ where: { orgId, status: 'pending' } }).catch(() => 0),
      this.prisma.organizationControl.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { id: true },
      }),
    ]);

    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'the organization';
    const industry = pd.industry ?? 'technology';
    const frameworks = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(' and ');
    const auditDate = pd.complianceGoals?.targetAuditDate ?? 'upcoming';

    const ctrlByStatus: Record<string, number> = {};
    for (const g of controlStats) {
      ctrlByStatus[g.status] = (g._count as any).id ?? 0;
    }
    const implemented = ctrlByStatus['implemented'] ?? 0;
    const inProgress  = ctrlByStatus['in_progress'] ?? 0;
    const notStarted  = ctrlByStatus['not_started'] ?? 0;
    const total = implemented + inProgress + notStarted + (ctrlByStatus['failed'] ?? 0);

    const score = (readiness as any)?.overallScore ?? 'N/A';

    const systemPrompt = `You are a senior compliance program manager writing a formal executive summary for an audit preparation package. Write in professional, authoritative language appropriate for a Board-level or C-suite audience. Be honest about gaps while maintaining a forward-looking tone.`;

    const userPrompt = `Write an executive summary for ${companyName}'s ${frameworks} audit preparation package.

COMPLIANCE POSTURE:
- Target frameworks: ${frameworks}
- Target audit: ${auditDate}
- Industry: ${industry}
- Overall readiness score: ${score}%
- Controls: ${implemented} implemented / ${inProgress} in progress / ${notStarted} not started (${total} total)
- Open high/critical risks: ${openHighRisks.length}
  ${openHighRisks.map((r) => `  • [${r.severity.toUpperCase()}] ${r.title}`).join('\n')}
- Overdue tasks: ${overdueTasks}
- Evidence expiring in 30 days: ${expiringEvidence}
- Pending exceptions: ${pendingExceptions}

Return a JSON object (no markdown fences):
{
  "headline": "One-sentence status (e.g. '${companyName} is on track for SOC 2 Type I audit in Q3 2026 with 74% readiness achieved')",
  "executiveSummary": "3-4 paragraphs of formal narrative covering: current posture, key accomplishments, open items, and path forward. Use formal language. No bullet points — flowing prose.",
  "auditReadinessStatement": "1-2 sentence formal statement of audit readiness suitable for inclusion in the cover page",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "keyRisks": ["Risk 1", "Risk 2"],
  "managementAttestation": "One paragraph management attestation statement to be signed by the CISO/CEO",
  "nextSteps": ["Action 1 with owner and deadline", "Action 2", "Action 3"]
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.3 },
    );

    let result: any;
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    return {
      headline:                  String(result.headline ?? '').slice(0, 300),
      executiveSummary:          String(result.executiveSummary ?? '').slice(0, 5000),
      auditReadinessStatement:   String(result.auditReadinessStatement ?? '').slice(0, 500),
      keyStrengths:              (Array.isArray(result.keyStrengths) ? result.keyStrengths : []).slice(0, 5).map(String),
      keyRisks:                  (Array.isArray(result.keyRisks) ? result.keyRisks : []).slice(0, 5).map(String),
      managementAttestation:     String(result.managementAttestation ?? '').slice(0, 1000),
      nextSteps:                 (Array.isArray(result.nextSteps) ? result.nextSteps : []).slice(0, 5).map(String),
      metadata: { score, implemented, total, openHighRisks: openHighRisks.length, overdueTasks },
      generatedAt: new Date().toISOString(),
    };
  }
}
