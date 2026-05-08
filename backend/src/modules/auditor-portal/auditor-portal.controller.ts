import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  Headers, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';
import {
  AuditorPortalService, CreateAuditorSessionDto, CreateRfiDto, RespondRfiDto,
} from './auditor-portal.service';

@ApiTags('auditor-portal')
@Controller('auditor-portal')
export class AuditorPortalController {
  constructor(
    private readonly svc: AuditorPortalService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Org admin endpoints (JWT-protected) ────────────────────────────────────

  @Post('sessions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create an auditor access token' })
  createSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateAuditorSessionDto) {
    return this.svc.createSession(user.orgId, user.sub, dto);
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all auditor sessions for the org' })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.svc.listSessions(user.orgId);
  }

  @Patch('sessions/:id/revoke')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.revokeSession(user.orgId, id);
  }

  @Get('rfis')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all RFIs from auditors' })
  listRfis(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listRfis(user.orgId, status);
  }

  @Post('rfis/:id/respond')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Respond to an auditor RFI' })
  respondRfi(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondRfiDto,
  ) {
    return this.svc.respondRfi(user.orgId, user.sub, id, dto);
  }

  // ─── AI Audit Briefing Pack ──────────────────────────────────────────────────

  @Post('ai-briefing')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'AI: generate a professional audit briefing pack for external auditors' })
  async aiBriefing(@CurrentUser() user: JwtPayload) {
    const orgId = user.orgId;

    const [profile, readiness, controls, policies, evidence, risks] = await Promise.all([
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.readinessScore.findFirst({ where: { orgId }, orderBy: { calculatedAt: 'desc' } }),
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: { control: { select: { code: true, title: true, category: true } } },
      }),
      this.prisma.policy.findMany({
        where: { orgId, status: { in: ['approved', 'draft'] } },
        select: { title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
      this.prisma.evidence.findMany({
        where: { orgId },
        select: { title: true, controlId: true, status: true, expiresAt: true },
        take: 30,
      }),
      this.prisma.risk.findMany({
        where: { orgId, status: { not: 'mitigated' } },
        select: { title: true, severity: true, status: true },
        take: 10,
      }),
    ]);

    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'the organization';
    const industry = pd.industry ?? 'technology';
    const frameworks = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');
    const dataTypes = (pd.dataHandling?.dataTypes ?? []).join(', ') || 'customer data';
    const cloudProviders = (pd.infrastructure?.cloudProviders ?? []).join(', ') || 'cloud infrastructure';

    const implemented = controls.filter((c) => c.status === 'implemented').length;
    const inProgress = controls.filter((c) => c.status === 'in_progress').length;
    const notStarted = controls.filter((c) => c.status === 'not_started').length;
    const overallScore = (readiness as any)?.overallScore ?? 0;
    const approvedPolicies = policies.filter((p) => p.status === 'approved');

    const controlsByCategory = controls.reduce((acc: Record<string, number>, c) => {
      const cat = c.control.category ?? 'General';
      acc[cat] = (acc[cat] ?? 0) + 1;
      return acc;
    }, {});

    const systemPrompt = `You are a compliance manager preparing a professional briefing document for an external auditor. Write in formal, professional prose. Be factual and specific. This document will be shared directly with the auditing firm.`;

    const userPrompt = `Generate an audit briefing pack for ${companyName}.

Organisation: ${companyName} | Industry: ${industry}
Target frameworks: ${frameworks}
Data types handled: ${dataTypes}
Infrastructure: ${cloudProviders}

Compliance posture:
- Overall readiness score: ${overallScore}%
- Controls implemented: ${implemented} / ${controls.length}
- Controls in-progress: ${inProgress} | Not started: ${notStarted}
- Approved policies: ${approvedPolicies.length}
- Open risks: ${risks.length}

Control coverage by category:
${Object.entries(controlsByCategory).map(([k, v]) => `  ${k}: ${v} controls`).join('\n')}

Approved policies: ${approvedPolicies.slice(0, 8).map((p) => p.title).join(', ') || 'None'}
Open risks: ${risks.slice(0, 5).map((r) => `${r.title} (${r.severity}/${r.status})`).join(', ') || 'None'}

Return ONLY a JSON object (no markdown):
{
  "executiveSummary": "3-4 sentences professional intro for the auditing firm",
  "complianceOverview": "2-3 sentences on our current compliance posture",
  "scopeStatement": "2 sentences on what systems and data are in scope",
  "keyControlAreas": [
    {
      "category": "Access Controls",
      "status": "strong|adequate|needs_attention",
      "notes": "1 sentence"
    }
  ],
  "policiesInPlace": ["Policy title 1", "Policy title 2"],
  "openItems": ["Item auditor should know upfront"],
  "keyContacts": ["CISO / Compliance Lead", "Engineering Lead", "Legal"],
  "auditReadinessStatement": "Confident paragraph on our readiness"
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.25 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validStatus = ['strong', 'adequate', 'needs_attention'];

    return {
      companyName,
      frameworks,
      overallScore,
      generatedAt:             new Date().toISOString(),
      executiveSummary:        String(result.executiveSummary ?? '').slice(0, 600),
      complianceOverview:      String(result.complianceOverview ?? '').slice(0, 400),
      scopeStatement:          String(result.scopeStatement ?? '').slice(0, 300),
      keyControlAreas: (Array.isArray(result.keyControlAreas) ? result.keyControlAreas : []).slice(0, 8).map((k: any) => ({
        category: String(k.category ?? '').slice(0, 60),
        status:   validStatus.includes(k.status) ? k.status : 'adequate',
        notes:    String(k.notes ?? '').slice(0, 150),
      })),
      policiesInPlace:         (Array.isArray(result.policiesInPlace) ? result.policiesInPlace : []).slice(0, 12).map(String),
      openItems:               (Array.isArray(result.openItems) ? result.openItems : []).slice(0, 6).map(String),
      keyContacts:             (Array.isArray(result.keyContacts) ? result.keyContacts : []).slice(0, 5).map(String),
      auditReadinessStatement: String(result.auditReadinessStatement ?? '').slice(0, 500),
      stats: { implemented, inProgress, notStarted, totalControls: controls.length, approvedPolicies: approvedPolicies.length },
    };
  }

  // ─── AI RFI Response suggestion ─────────────────────────────────────────────

  @Post('rfis/:id/ai-suggest-response')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'AI: suggest a professional response to an auditor RFI based on available compliance data' })
  async aiSuggestRfiResponse(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const orgId = user.orgId;
    const rfis = await this.svc.listRfis(orgId);
    const rfi = (rfis as any[]).find((r) => r.id === id);
    if (!rfi) return { error: 'RFI not found' };

    const [profile, readiness, relevantControls, relevantPolicies, relevantEvidence] = await Promise.all([
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.readinessScore.findFirst({ where: { orgId }, orderBy: { calculatedAt: 'desc' } }),
      this.prisma.organizationControl.findMany({
        where: { orgId, status: { in: ['implemented', 'in_progress'] } },
        include: { control: { select: { code: true, title: true, category: true } } },
        take: 20,
      }),
      this.prisma.policy.findMany({
        where: { orgId, status: 'approved' },
        select: { title: true },
        take: 5,
      }),
      this.prisma.evidence.findMany({
        where: { orgId, status: { in: ['collected', 'validated'] } },
        select: { title: true, evidenceType: true },
        take: 15,
      }),
    ]);

    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'our organisation';
    const controlList = relevantControls.map((c) => `${c.control.code}: ${c.control.title} (${c.status})`).join('\n') || 'None';
    const policyList = relevantPolicies.map((p) => p.title).join(', ') || 'None';
    const evidenceList = relevantEvidence.map((e) => `${e.evidenceType}: ${e.title}`).join('\n') || 'None';

    const systemPrompt = `You are a compliance manager responding professionally to an auditor's Request for Information (RFI). Write clear, factual, professional responses. Reference specific controls, policies, and evidence.`;

    const userPrompt = `Respond to this auditor RFI for ${companyName}:

RFI Question: "${rfi.question}"
Category: ${rfi.category ?? 'General'}

Available data:
Implemented Controls:\n${controlList}
Approved Policies: ${policyList}
Collected Evidence:\n${evidenceList}
Readiness: ${(readiness as any)?.overallScore ?? 'N/A'}%

Return ONLY a JSON object (no markdown):
{
  "suggestedResponse": "Professional 2-4 paragraph response referencing specific controls, policies, and evidence.",
  "supportingEvidence": ["Evidence item 1"],
  "referencedControls": ["CC6.1"],
  "confidenceLevel": "high|medium|low",
  "caveats": ["Any important caveats"]
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.2 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validConfidence = ['high', 'medium', 'low'];

    return {
      rfiId:              id,
      question:           rfi.question,
      suggestedResponse:  String(result.suggestedResponse ?? '').slice(0, 2000),
      supportingEvidence: (Array.isArray(result.supportingEvidence) ? result.supportingEvidence : []).slice(0, 5).map(String),
      referencedControls: (Array.isArray(result.referencedControls) ? result.referencedControls : []).slice(0, 6).map(String),
      confidenceLevel:    validConfidence.includes(result.confidenceLevel) ? result.confidenceLevel : 'medium',
      caveats:            (Array.isArray(result.caveats) ? result.caveats : []).slice(0, 3).map(String),
      generatedAt:        new Date().toISOString(),
    };
  }

  // ─── Token-gated portal endpoints (public, token in header) ─────────────────

  @Get('portal')
  @Public()
  @ApiOperation({ summary: 'Get all portal data for the auditor (token-gated)' })
  @ApiHeader({ name: 'x-auditor-token', description: 'Auditor access token' })
  getPortalData(@Headers('x-auditor-token') token: string) {
    return this.svc.getPortalData(token);
  }

  @Post('portal/rfi')
  @Public()
  @ApiOperation({ summary: 'Create an RFI from the auditor portal' })
  @ApiHeader({ name: 'x-auditor-token', description: 'Auditor access token' })
  createRfi(@Headers('x-auditor-token') token: string, @Body() dto: CreateRfiDto) {
    return this.svc.createRfi(token, dto);
  }
}
