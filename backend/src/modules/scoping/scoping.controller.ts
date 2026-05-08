import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { ScopingService } from '../../scoping/scoping.service';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scoping')
@UseGuards(JwtAuthGuard)
export class ScopingController {
  constructor(
    private readonly scopingService: ScopingService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  // ── SOC 2 ─────────────────────────────────────────────────────────────────

  @Get('soc2/current')
  async getCurrentSoc2Scope(@Req() req: any) {
    return this.scopingService.getCurrentSoc2Scope(req.user.orgId);
  }

  @Post('soc2/generate')
  async createSoc2Scope(@Req() req: any, @Body() body: any) {
    return this.scopingService.createSoc2Scope(req.user.orgId, body.workflowId, body);
  }

  @Patch('soc2/:id/approve')
  async approveSoc2Scope(@Param('id') id: string, @Req() req: any) {
    return this.scopingService.approveSoc2Scope(id, req.user.id);
  }

  // ── ISO 27001 ─────────────────────────────────────────────────────────────

  @Get('iso/current')
  async getCurrentIsoScope(@Req() req: any) {
    return this.scopingService.getCurrentIsoScope(req.user.orgId);
  }

  @Post('iso/generate')
  async createIsoScope(@Req() req: any, @Body() body: any) {
    return this.scopingService.createIsoScope(req.user.orgId, body);
  }

  @Patch('iso/:id/approve')
  async approveIsoScope(@Param('id') id: string, @Req() req: any) {
    return this.scopingService.approveIsoScope(id, req.user.id);
  }

  // ── Statement of Applicability ─────────────────────────────────────────────

  @Get('iso/soa')
  async getSoa(@Req() req: any) {
    return this.scopingService.getSoa(req.user.orgId);
  }

  @Post('iso/soa/generate')
  async generateSoa(@Req() req: any) {
    return this.scopingService.generateSoa(req.user.orgId);
  }

  // ── AI Scope Review ────────────────────────────────────────────────────────

  @Post('ai-scope-review')
  @ApiOperation({ summary: 'AI: review current SOC 2 scope for auditor risks, misclassifications, and TSC coverage gaps' })
  async aiScopeReview(@Req() req: any) {
    const orgId = req.user.orgId;

    const [scope, profile] = await Promise.all([
      this.scopingService.getCurrentSoc2Scope(orgId),
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const pd = (profile?.profileData as any) ?? {};

    if (!scope) {
      return { message: 'No SOC 2 scope defined yet. Run an assessment first.' };
    }

    const s = scope as any;
    const inScope = (s.systemsInScope ?? []).map((x: any) => `- ${x.name}: ${x.description ?? ''}`).join('\n') || 'None';
    const outScope = (s.systemsOutOfScope ?? []).map((x: any) => `- ${x.name}: ${x.reason ?? ''}`).join('\n') || 'None';
    const ambiguous = (s.ambiguousItems ?? []).map((x: any) => `- ${x.item}: ${x.question ?? ''}`).join('\n') || 'None';
    const tscs = (s.trustServiceCategories ?? []).join(', ') || 'security only';
    const dataTypes = (pd.dataHandling?.dataTypes ?? []).join(', ') || 'customer data';

    const systemPrompt = `You are a SOC 2 audit expert reviewing an organization's system scope definition before an audit. Identify scope creep risks, exclusion risks, TSC selection issues, and questions auditors commonly ask about scope.`;

    const userPrompt = `Review this SOC 2 scope definition:

Company: ${pd.companyName ?? 'Unknown'}
Industry: ${pd.industry ?? 'technology'}
Data handled: ${dataTypes}
Audit type: ${s.auditType ?? 'Type II'}
Trust Service Categories selected: ${tscs}

SYSTEMS IN SCOPE:
${inScope}

SYSTEMS OUT OF SCOPE:
${outScope}

AMBIGUOUS ITEMS:
${ambiguous}

Identify risks and provide advisory. Return ONLY a JSON object (no markdown):
{
  "overallRisk": "low|medium|high",
  "riskSummary": "1-2 sentence overall assessment",
  "exclusionRisks": [
    {
      "system": "system name from out-of-scope list",
      "risk": "why an auditor might challenge this exclusion",
      "recommendation": "how to defend or reconsider it"
    }
  ],
  "tscAdvisory": {
    "selectedTscs": ["security", "..."],
    "missingRecommended": ["availability"],
    "rationale": "Why the missing TSCs might be required for this org"
  },
  "auditFAQ": [
    {
      "question": "Question an auditor will likely ask about this scope",
      "suggestedAnswer": "How the organization should answer"
    }
  ],
  "scopeGaps": ["Specific system or data flow that should be in scope but isn't"],
  "strengths": ["What the scope definition does well"]
}

Focus on practical, actionable advice. Be specific to the systems listed.`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'policy', temperature: 0.2 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validRisk = ['low', 'medium', 'high'];

    return {
      overallRisk:   validRisk.includes(result.overallRisk) ? result.overallRisk : 'medium',
      riskSummary:   String(result.riskSummary ?? '').slice(0, 400),
      exclusionRisks: (Array.isArray(result.exclusionRisks) ? result.exclusionRisks : []).slice(0, 6).map((e: any) => ({
        system:         String(e.system ?? '').slice(0, 80),
        risk:           String(e.risk ?? '').slice(0, 200),
        recommendation: String(e.recommendation ?? '').slice(0, 200),
      })),
      tscAdvisory: {
        selectedTscs:        Array.isArray(result.tscAdvisory?.selectedTscs) ? result.tscAdvisory.selectedTscs.map(String) : [],
        missingRecommended:  Array.isArray(result.tscAdvisory?.missingRecommended) ? result.tscAdvisory.missingRecommended.map(String) : [],
        rationale:           String(result.tscAdvisory?.rationale ?? '').slice(0, 300),
      },
      auditFAQ: (Array.isArray(result.auditFAQ) ? result.auditFAQ : []).slice(0, 5).map((q: any) => ({
        question:       String(q.question ?? '').slice(0, 200),
        suggestedAnswer: String(q.suggestedAnswer ?? '').slice(0, 300),
      })),
      scopeGaps: (Array.isArray(result.scopeGaps) ? result.scopeGaps : []).slice(0, 5).map(String),
      strengths:  (Array.isArray(result.strengths) ? result.strengths : []).slice(0, 4).map(String),
      generatedAt: new Date().toISOString(),
    };
  }
}
