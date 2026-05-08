import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  AuditMemoryService,
  CreateAuditCycleDto,
  UpdateAuditCycleDto,
  CreateFindingDto,
  UpdateFindingDto,
} from './audit-memory.service';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('audit-memory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('audit-memory')
export class AuditMemoryController {
  constructor(
    private readonly service: AuditMemoryService,
    private readonly llm:     LlmService,
    private readonly prisma:  PrismaService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Audit memory summary stats' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.service.getStats(user.orgId);
  }

  // ─── Cycles ───────────────────────────────────────────────────────────────────

  @Get('cycles')
  listCycles(@CurrentUser() user: JwtPayload) {
    return this.service.listCycles(user.orgId);
  }

  @Get('cycles/:cycleId')
  getCycle(
    @CurrentUser() user: JwtPayload,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.service.getCycle(user.orgId, cycleId);
  }

  @Post('cycles')
  createCycle(@CurrentUser() user: JwtPayload, @Body() dto: CreateAuditCycleDto) {
    return this.service.createCycle(user.orgId, dto, user.sub);
  }

  @Patch('cycles/:cycleId')
  updateCycle(
    @CurrentUser() user: JwtPayload,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: UpdateAuditCycleDto,
  ) {
    return this.service.updateCycle(user.orgId, cycleId, dto);
  }

  // ─── Findings ─────────────────────────────────────────────────────────────────

  @Get('findings')
  listFindings(
    @CurrentUser() user: JwtPayload,
    @Query('cycleId') cycleId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listFindings(user.orgId, cycleId, status);
  }

  @Post('findings')
  createFinding(@CurrentUser() user: JwtPayload, @Body() dto: CreateFindingDto) {
    return this.service.createFinding(user.orgId, dto);
  }

  @Patch('findings/:findingId')
  updateFinding(
    @CurrentUser() user: JwtPayload,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.service.updateFinding(user.orgId, findingId, dto, user.sub);
  }

  @Post('findings/:findingId/ai-remediation')
  @ApiOperation({ summary: 'AI: generate remediation plan and lessons learned for an audit finding' })
  async aiRemediation(
    @CurrentUser() user: JwtPayload,
    @Param('findingId', ParseUUIDPipe) findingId: string,
  ) {
    const finding = await this.prisma.auditFinding.findFirst({
      where:   { id: findingId, auditCycle: { orgId: user.orgId } },
      include: {
        auditCycle: { select: { framework: true, label: true } },
        control:    { select: { code: true, title: true, description: true, category: true } },
      },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'the organisation';
    const industry    = pd.industry    ?? 'technology';

    const systemPrompt = `You are a compliance expert helping a team remediate audit findings. Provide specific, actionable guidance. Reference the exact control being assessed and the company's industry context.`;

    const userPrompt = `Generate a remediation plan for this audit finding:

Finding: ${finding.title}
Description: ${finding.description}
Severity: ${finding.severity}
Finding Type: ${finding.findingType}
Framework: ${finding.auditCycle.framework} (Audit: ${finding.auditCycle.label})
${finding.control ? `Control: [${finding.control.code}] ${finding.control.title}
Control Category: ${finding.control.category}` : ''}

Organisation: ${companyName} (${industry})

Return ONLY a JSON object (no markdown fences):
{
  "remediationSummary": "1-2 sentence summary of what needs to be done",
  "remediationSteps": [
    "Step 1 — specific action with owner role (e.g. CISO, DevOps)",
    "Step 2 ...",
    "Step 3 ..."
  ],
  "estimatedTimeline": "e.g. '2-3 weeks' or '1 day'",
  "evidenceRequired": ["Evidence type 1 to prove remediation (e.g. 'Screenshot of updated policy', 'Test results')"],
  "lessonLearned": "1-2 sentences on the root cause and what process change prevents recurrence",
  "preventionMeasure": "One specific ongoing control or process that prevents this finding from recurring next audit"
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.25 },
    );

    let result: any;
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    // Auto-save remediation + lessonLearned to the finding
    const remediation = [
      String(result.remediationSummary ?? ''),
      '',
      'Steps:',
      ...(Array.isArray(result.remediationSteps) ? result.remediationSteps : []).map((s: string) => `• ${s}`),
      '',
      `Timeline: ${result.estimatedTimeline ?? 'TBD'}`,
      '',
      'Evidence required:',
      ...(Array.isArray(result.evidenceRequired) ? result.evidenceRequired : []).map((e: string) => `• ${e}`),
    ].join('\n').slice(0, 3000);

    const lessonLearned = [
      String(result.lessonLearned ?? ''),
      result.preventionMeasure ? `\nPrevention: ${result.preventionMeasure}` : '',
    ].join('').slice(0, 1000);

    await this.prisma.auditFinding.update({
      where: { id: findingId },
      data: { remediation, lessonLearned },
    });

    return {
      findingId,
      remediationSummary:  String(result.remediationSummary ?? '').slice(0, 300),
      remediationSteps:    (Array.isArray(result.remediationSteps) ? result.remediationSteps : []).slice(0, 7).map(String),
      estimatedTimeline:   String(result.estimatedTimeline ?? '').slice(0, 40),
      evidenceRequired:    (Array.isArray(result.evidenceRequired) ? result.evidenceRequired : []).slice(0, 5).map(String),
      lessonLearned:       String(result.lessonLearned ?? '').slice(0, 300),
      preventionMeasure:   String(result.preventionMeasure ?? '').slice(0, 200),
      savedToFinding:      true,
    };
  }

  @Post('cycles/:cycleId/ai-debrief')
  @ApiOperation({ summary: 'AI: generate a cycle debrief document summarising findings, lessons learned, and next cycle recommendations' })
  async aiDebrief(
    @CurrentUser() user: JwtPayload,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    const cycle = await this.service.getCycle(user.orgId, cycleId);
    if (!cycle) throw new NotFoundException('Audit cycle not found');

    const findings = await this.service.listFindings(user.orgId, cycleId);
    const profile  = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'the organisation';

    const c = cycle as any;
    const f = findings as any[];

    const systemPrompt = `You are a compliance program manager writing a post-audit debrief for the executive team. Be specific, honest, and forward-looking. Identify patterns across findings.`;

    const userPrompt = `Write a debrief for this audit cycle:

Cycle: ${c.label}
Framework: ${c.framework}
Auditor: ${c.auditorName ?? 'Internal'} (${c.auditorFirm ?? 'Internal review'})
Period: ${new Date(c.startDate).toLocaleDateString()} — ${c.endDate ? new Date(c.endDate).toLocaleDateString() : 'Ongoing'}
Outcome: ${c.outcome ?? 'Not specified'}
Organisation: ${companyName}

FINDINGS (${f.length}):
${f.slice(0, 20).map((fi, i) => `${i + 1}. [${fi.severity?.toUpperCase() ?? 'MEDIUM'}] ${fi.title} — ${fi.findingType} — ${fi.status}
   ${fi.description?.slice(0, 100) ?? ''}${fi.lessonLearned ? `\n   Lesson: ${fi.lessonLearned.slice(0, 80)}` : ''}`).join('\n\n')}

Return ONLY a JSON object (no markdown fences):
{
  "executiveSummary": "3-4 sentences summarising the audit outcome",
  "strengths": ["What the org did well — 3 items"],
  "keyFindings": ["Top 3-4 most important findings with severity"],
  "remediationProgress": "Summary of what was/wasn't remediated",
  "lessonsLearned": ["Pattern 1 from findings", "Pattern 2"],
  "nextCycleRecommendations": ["Recommendation for next audit cycle — 3-4 items"],
  "priorityActions": ["#1 priority before next audit", "#2 priority"]
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
      cycleId,
      cycleLabel:                 c.label,
      framework:                  c.framework,
      executiveSummary:           String(result.executiveSummary ?? '').slice(0, 600),
      strengths:                  (Array.isArray(result.strengths) ? result.strengths : []).slice(0, 5).map(String),
      keyFindings:                (Array.isArray(result.keyFindings) ? result.keyFindings : []).slice(0, 5).map(String),
      remediationProgress:        String(result.remediationProgress ?? '').slice(0, 400),
      lessonsLearned:             (Array.isArray(result.lessonsLearned) ? result.lessonsLearned : []).slice(0, 5).map(String),
      nextCycleRecommendations:   (Array.isArray(result.nextCycleRecommendations) ? result.nextCycleRecommendations : []).slice(0, 5).map(String),
      priorityActions:            (Array.isArray(result.priorityActions) ? result.priorityActions : []).slice(0, 4).map(String),
      generatedAt:                new Date().toISOString(),
    };
  }
}
