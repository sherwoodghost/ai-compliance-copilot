import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// Numeric values for risk score calculation
const LIKELIHOOD_SCORES: Record<string, number> = {
  rare: 1, unlikely: 2, possible: 3, likely: 4, almost_certain: 5,
};
const IMPACT_SCORES: Record<string, number> = {
  negligible: 1, minor: 2, moderate: 3, major: 4, catastrophic: 5,
};

function deriveSeverity(score: number): string {
  if (score >= 17) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5)  return 'medium';
  return 'low';
}

class CreateRiskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ enum: ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'] })
  @IsEnum(['rare', 'unlikely', 'possible', 'likely', 'almost_certain'])
  likelihood: string;

  @ApiProperty({ enum: ['negligible', 'minor', 'moderate', 'major', 'catastrophic'] })
  @IsEnum(['negligible', 'minor', 'moderate', 'major', 'catastrophic'])
  impact: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mitigationAdvice?: string;
}

class UpdateRiskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mitigationAdvice?: string;
}

class CreateTreatmentDto {
  @ApiProperty({ enum: ['mitigate', 'accept', 'transfer', 'avoid'] })
  @IsEnum(['mitigate', 'accept', 'transfer', 'avoid'])
  treatmentType: string;

  @ApiProperty()
  @IsString()
  treatmentDescription: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  ownerRole?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  targetCompletionDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  residualRiskAfter?: string;
}

class AcceptTreatmentDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  acceptanceNote?: string;
}

@ApiTags('risks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('risks')
export class RisksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // ── Risk Items ────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Manually create a new risk item' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRiskDto) {
    if (dto.controlId) {
      const control = await this.prisma.organizationControl.findUnique({
        where: { orgId_controlId: { orgId: user.orgId, controlId: dto.controlId } },
      });
      if (!control) throw new BadRequestException('Control not found in this organization');
    }

    const lScore = LIKELIHOOD_SCORES[dto.likelihood];
    const iScore = IMPACT_SCORES[dto.impact];
    const riskScore = lScore * iScore;
    const severity = deriveSeverity(riskScore);

    return this.prisma.riskItem.create({
      data: {
        orgId: user.orgId,
        title: dto.title,
        description: dto.description ?? null,
        likelihood: dto.likelihood as any,
        impact: dto.impact as any,
        riskScore,
        severity,
        mitigationAdvice: dto.mitigationAdvice ?? null,
        owner: dto.owner ?? null,
        controlId: dto.controlId ?? null,
        identifiedBy: 'human' as any,
        status: 'open' as any,
      },
      include: { riskTreatments: true },
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all risk items for the org' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.prisma.riskItem.findMany({
      where: {
        orgId: user.orgId,
        ...(status && { status: status as any }),
        ...(severity && { severity }),
      },
      include: {
        riskTreatments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Risk summary stats' })
  async getStats(@CurrentUser() user: JwtPayload) {
    const [total, open, mitigated, accepted, highRisks] = await Promise.all([
      this.prisma.riskItem.count({ where: { orgId: user.orgId } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'open' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'mitigated' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'accepted' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'open', severity: { in: ['critical', 'high'] } } }),
    ]);

    const bySeverity = await this.prisma.riskItem.groupBy({
      by: ['severity'] as any,
      where: { orgId: user.orgId, status: 'open' as any },
      _count: true,
    });

    const severityMap = Object.fromEntries(
      (bySeverity as any[]).map((r: any) => [r.severity, r._count]),
    );

    return { total, open, mitigated, accepted, highRisks, bySeverity: severityMap };
  }

  @Get(':riskId')
  @ApiOperation({ summary: 'Get a specific risk with full treatment history' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
      include: {
        control: { include: { framework: true } },
        riskTreatments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!risk) throw new NotFoundException('Risk not found');
    return risk;
  }

  @Patch(':riskId')
  @ApiOperation({ summary: 'Update a risk item status or mitigation advice' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: UpdateRiskDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    return this.prisma.riskItem.update({
      where: { id: riskId },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.mitigationAdvice !== undefined && { mitigationAdvice: dto.mitigationAdvice }),
      },
    });
  }

  // ── AI Risk Generation from Gaps ──────────────────────────────────────────

  @Post('generate-from-gaps')
  @ApiOperation({ summary: 'AI: identify and create risks from not-implemented controls' })
  async generateFromGaps(
    @CurrentUser() user: JwtPayload,
  ) {
    // 1. Find not-started/in-progress controls (these represent compliance gaps and implied risks)
    const gapControls = await this.prisma.organizationControl.findMany({
      where: { orgId: user.orgId, status: { in: ['not_started', 'in_progress'] } },
      include: {
        control: { select: { code: true, title: true, description: true, category: true } },
      },
      orderBy: [{ control: { category: 'asc' } }],
      take: 30,
    });

    if (gapControls.length === 0) {
      return { created: 0, risks: [] };
    }

    // 2. Find existing open risk titles to avoid duplicates
    const existingRisks = await this.prisma.riskItem.findMany({
      where: { orgId: user.orgId, status: { in: ['open', 'in_progress'] } },
      select: { title: true, controlId: true },
    });
    const existingControlIds = new Set(existingRisks.map((r) => r.controlId).filter(Boolean));

    const needsRisks = gapControls.filter((gc) => !existingControlIds.has(gc.id));
    if (needsRisks.length === 0) return { created: 0, risks: [] };

    // 3. Build gap list for prompt
    const gapList = needsRisks
      .map((gc) => `[${gc.control.code}] ${gc.control.title} (${gc.control.category})`)
      .join('\n');

    // 4. Get org context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const profileData = (profile?.profileData as any) ?? {};

    const systemPrompt = `You are a compliance risk analyst. Given a list of unimplemented compliance controls, identify the actual business and security risks that arise from those gaps. Return ONLY valid JSON.`;

    const userPrompt = `For a ${profileData.industry ?? 'software'} company, identify the top risks from these unimplemented compliance controls:

${gapList}

For each control gap, describe ONE key risk. Return a JSON array of risk objects:
[
  {
    "title": "Concise risk title (max 80 chars)",
    "description": "What could go wrong and why (max 200 chars)",
    "likelihood": "rare" | "unlikely" | "possible" | "likely" | "almost_certain",
    "impact": "negligible" | "minor" | "moderate" | "major" | "catastrophic",
    "controlCode": "the control code from the list above",
    "mitigationAdvice": "one-sentence quick mitigation tip"
  }
]

Limit to the top ${Math.min(needsRisks.length, 20)} risks by priority. Assess realistically for a ${profileData.industry ?? 'SaaS'} company. Return only the JSON array.`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'risk-scoring', temperature: 0.2 },
    );

    let aiRisks: Array<{
      title: string;
      description: string;
      likelihood: string;
      impact: string;
      controlCode: string;
      mitigationAdvice: string;
    }> = [];

    try {
      const raw = response.content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      aiRisks = JSON.parse(raw);
      if (!Array.isArray(aiRisks)) aiRisks = [];
    } catch {
      aiRisks = [];
    }

    if (aiRisks.length === 0) return { created: 0, risks: [] };

    // 5. Build lookup: controlCode → orgControlId
    const codeToControlId = new Map(needsRisks.map((gc) => [gc.control.code, gc.id]));

    const validLikelihoods = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'];
    const validImpacts     = ['negligible', 'minor', 'moderate', 'major', 'catastrophic'];

    const createdRisks: any[] = [];
    for (const r of aiRisks) {
      const likelihood = validLikelihoods.includes(r.likelihood) ? r.likelihood : 'possible';
      const impact     = validImpacts.includes(r.impact) ? r.impact : 'moderate';
      const lScore = LIKELIHOOD_SCORES[likelihood] ?? 3;
      const iScore = IMPACT_SCORES[impact] ?? 3;
      const riskScore = lScore * iScore;
      const severity  = deriveSeverity(riskScore);
      const controlId = codeToControlId.get(r.controlCode) ?? null;

      const risk = await this.prisma.riskItem.create({
        data: {
          orgId:           user.orgId,
          title:           r.title?.slice(0, 200) ?? 'Compliance gap risk',
          description:     r.description?.slice(0, 500) ?? null,
          likelihood:      likelihood as any,
          impact:          impact as any,
          riskScore,
          severity,
          mitigationAdvice: r.mitigationAdvice?.slice(0, 500) ?? null,
          controlId,
          identifiedBy:    'ai' as any,
          status:          'open' as any,
        },
      });
      createdRisks.push(risk);
    }

    return { created: createdRisks.length, risks: createdRisks };
  }

  // ── AI Advice ─────────────────────────────────────────────────────────────

  @Post(':riskId/ai-advice')
  @ApiOperation({ summary: 'AI: generate mitigation strategies and residual risk assessment' })
  async getAiAdvice(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
      include: {
        control: { select: { code: true, title: true, category: true } },
      },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    // Get org profile for context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const profileData = (profile?.profileData as any) ?? {};

    const systemPrompt = `You are a compliance and information security risk expert. Provide concrete, actionable mitigation strategies for identified risks. Return ONLY valid JSON.`;
    const userPrompt = `Generate mitigation advice for this risk:

Risk: ${risk.title}
${risk.description ? `Description: ${risk.description}` : ''}
Likelihood: ${risk.likelihood} (score: ${LIKELIHOOD_SCORES[risk.likelihood as string] ?? '?'}/5)
Impact: ${risk.impact} (score: ${IMPACT_SCORES[risk.impact as string] ?? '?'}/5)
Risk Score: ${risk.riskScore}/25 — Severity: ${risk.severity}
${risk.control ? `Linked Control: [${risk.control.code}] ${risk.control.title} (${risk.control.category})` : ''}

Organization context:
- Industry: ${profileData.industry ?? 'software/SaaS'}
- Cloud: ${(profileData.infrastructure?.cloudProviders ?? []).join(', ') || 'cloud-based'}
- Frameworks: ${(profileData.complianceGoals?.targetFrameworks ?? []).join(', ') || 'SOC 2'}

Return JSON:
{
  "executiveSummary": "2-sentence summary of this risk and why it matters",
  "mitigationStrategies": [
    { "type": "mitigate" | "transfer" | "avoid" | "accept", "title": "short action", "description": "how to do it", "effort": "low" | "medium" | "high", "timeframe": "1 week" | "1 month" | "3 months" | "6 months" }
  ],
  "residualRiskAfterMitigation": "low" | "medium" | "high",
  "quickWin": "the fastest, easiest action that reduces this risk today",
  "relatedControls": ["CC6.1", ...]
}`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'risk-scoring', temperature: 0.2 },
    );

    let advice: any = {};
    try {
      const raw = response.content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      advice = JSON.parse(raw);
    } catch {
      advice = { executiveSummary: response.content, mitigationStrategies: [] };
    }

    // Persist the AI advice as mitigationAdvice on the risk
    if (advice.executiveSummary || advice.quickWin) {
      const advisoryText = [
        advice.executiveSummary,
        advice.quickWin ? `Quick win: ${advice.quickWin}` : '',
      ].filter(Boolean).join(' | ');

      await this.prisma.riskItem.update({
        where: { id: riskId },
        data: { mitigationAdvice: advisoryText },
      });
    }

    return { riskId, ...advice };
  }

  // ── Risk Treatments ────────────────────────────────────────────────────────

  @Get(':riskId/treatments')
  @ApiOperation({ summary: 'List all treatment decisions for a risk' })
  async listTreatments(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    return this.prisma.riskTreatment.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' as any },
    });
  }

  @Post(':riskId/treatments')
  @ApiOperation({ summary: 'Create a risk treatment decision (mitigate/accept/transfer/avoid)' })
  async createTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: CreateTreatmentDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.create({
      data: {
        riskId,
        orgId: user.orgId,
        treatmentType: dto.treatmentType as any,
        treatmentDescription: dto.treatmentDescription,
        targetCompletionDate: dto.targetCompletionDate ? new Date(dto.targetCompletionDate) : null,
        residualRiskAfter: dto.residualRiskAfter ?? null,
        status: 'open',
      },
    });

    return treatment;
  }

  @Patch(':riskId/treatments/:treatmentId/accept')
  @ApiOperation({ summary: 'Accept/sign-off on a risk treatment decision' })
  async acceptTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('treatmentId', ParseUUIDPipe) treatmentId: string,
    @Body() dto: AcceptTreatmentDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.findFirst({
      where: { id: treatmentId, riskId },
    });
    if (!treatment) throw new NotFoundException('Treatment not found');

    const updated = await this.prisma.riskTreatment.update({
      where: { id: treatmentId },
      data: {
        status: 'accepted',
        acceptedBy: user.sub,
        acceptedAt: new Date(),
      },
    });

    // If the treatment type is 'accept', close the risk as accepted
    // If 'avoid' or 'transfer', mark the risk as resolved
    if (treatment.treatmentType === 'accept') {
      await this.prisma.riskItem.update({
        where: { id: riskId },
        data: { status: 'accepted' as any },
      });
    } else if (treatment.treatmentType === 'avoid' || treatment.treatmentType === 'transfer') {
      await this.prisma.riskItem.update({
        where: { id: riskId },
        data: { status: 'mitigated' as any },
      });
    }

    return updated;
  }

  @Patch(':riskId/treatments/:treatmentId/complete')
  @ApiOperation({ summary: 'Mark a mitigation treatment as completed' })
  async completeTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('treatmentId', ParseUUIDPipe) treatmentId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.findFirst({
      where: { id: treatmentId, riskId },
    });
    if (!treatment) throw new NotFoundException('Treatment not found');

    if (treatment.treatmentType !== 'mitigate') {
      throw new BadRequestException('Only mitigate treatments can be marked complete');
    }

    await this.prisma.riskTreatment.update({
      where: { id: treatmentId },
      data: { status: 'completed' },
    });

    return this.prisma.riskItem.update({
      where: { id: riskId },
      data: { status: 'mitigated' as any },
    });
  }

  // ── AI Risk Portfolio Analysis ─────────────────────────────────────────────

  @Post('ai-portfolio-analysis')
  @ApiOperation({ summary: 'AI: strategic risk portfolio analysis — patterns, exposure areas, board-ready summary' })
  async aiPortfolioAnalysis(@CurrentUser() user: JwtPayload) {
    const orgId = user.orgId;

    const [risks, profile] = await Promise.all([
      this.prisma.riskItem.findMany({
        where: { orgId },
        include: {
          treatments: { select: { treatmentType: true, status: true } },
        },
        orderBy: { riskScore: 'desc' as any },
        take: 50,
      }),
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
    ]);

    if (risks.length === 0) {
      return { message: 'No risks found — add risks to generate a portfolio analysis.' };
    }

    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'the organisation';
    const industry    = pd.industry    ?? 'technology';
    const frameworks  = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');

    const stats = {
      total:     risks.length,
      critical:  risks.filter((r) => r.severity === 'critical').length,
      high:      risks.filter((r) => r.severity === 'high').length,
      open:      risks.filter((r) => r.status === 'open').length,
      mitigated: risks.filter((r) => r.status === 'mitigated').length,
      accepted:  risks.filter((r) => r.status === 'accepted').length,
      unowned:   risks.filter((r) => !r.owner).length,
    };

    const topRisks = risks.slice(0, 15).map((r) => ({
      title:    r.title,
      severity: r.severity,
      category: r.category ?? 'Uncategorized',
      status:   r.status,
      score:    r.riskScore,
      owner:    r.owner ?? 'Unassigned',
    }));

    const systemPrompt = `You are a Chief Risk Officer preparing a strategic risk portfolio analysis for a board presentation. Be concise, specific, and actionable. Identify patterns and systemic issues.`;

    const userPrompt = `Analyse this risk portfolio for ${companyName} (${industry}) targeting ${frameworks}:

STATS: ${stats.total} risks total — ${stats.critical} critical, ${stats.high} high, ${stats.open} open, ${stats.mitigated} mitigated, ${stats.accepted} accepted, ${stats.unowned} unassigned

TOP RISKS (by score):
${topRisks.map((r, i) => `${i + 1}. [${r.severity?.toUpperCase()}] ${r.title} | ${r.category} | ${r.status} | Owner: ${r.owner}`).join('\n')}

Return ONLY a JSON object (no markdown):
{
  "executiveSummary": "3-4 sentence board-level risk posture summary",
  "overallRiskRating": "Low|Medium|High|Critical",
  "topExposureAreas": [
    { "area": "category name", "riskCount": 3, "concern": "1 sentence on the specific concern" }
  ],
  "systemicPatterns": ["Pattern 1 observed across multiple risks", "Pattern 2"],
  "criticalUntreated": ["Risk title 1 with no treatment that poses highest exposure"],
  "quickWins": ["Specific action that would immediately reduce portfolio risk"],
  "boardRecommendations": ["Recommendation 1 for board action", "Recommendation 2"],
  "riskAppetiteAssessment": "1-2 sentences on whether current risk levels are within acceptable bounds for this industry"
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

    const validRatings = ['Low', 'Medium', 'High', 'Critical'];

    return {
      stats,
      overallRiskRating:       validRatings.includes(result.overallRiskRating) ? result.overallRiskRating : 'High',
      executiveSummary:        String(result.executiveSummary ?? '').slice(0, 600),
      topExposureAreas:        (Array.isArray(result.topExposureAreas) ? result.topExposureAreas : []).slice(0, 5).map((a: any) => ({
        area:      String(a.area ?? '').slice(0, 60),
        riskCount: Number(a.riskCount ?? 0),
        concern:   String(a.concern ?? '').slice(0, 200),
      })),
      systemicPatterns:        (Array.isArray(result.systemicPatterns) ? result.systemicPatterns : []).slice(0, 4).map(String),
      criticalUntreated:       (Array.isArray(result.criticalUntreated) ? result.criticalUntreated : []).slice(0, 4).map(String),
      quickWins:               (Array.isArray(result.quickWins) ? result.quickWins : []).slice(0, 3).map(String),
      boardRecommendations:    (Array.isArray(result.boardRecommendations) ? result.boardRecommendations : []).slice(0, 4).map(String),
      riskAppetiteAssessment:  String(result.riskAppetiteAssessment ?? '').slice(0, 300),
      generatedAt:             new Date().toISOString(),
    };
  }
}
