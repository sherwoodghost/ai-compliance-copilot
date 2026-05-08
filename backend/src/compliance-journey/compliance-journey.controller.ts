import { Controller, Get, Post, Patch, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplianceJourneyService } from './compliance-journey.service';
import { LlmService } from '../llm/llm.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

class ResolveCheckpointDto {
  @IsEnum(['approved', 'rejected', 'override']) decision: 'approved' | 'rejected' | 'override';
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsString() overrideReason?: string;
}

@ApiTags('compliance-journey')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('compliance-journey')
export class ComplianceJourneyController {
  constructor(
    private readonly journeyService: ComplianceJourneyService,
    private readonly llm: LlmService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all compliance journeys for the org' })
  listJourneys(@CurrentUser() user: JwtPayload) {
    return this.journeyService.listJourneys(user.orgId);
  }

  @Get('checkpoints/pending')
  @ApiOperation({ summary: 'Get all pending human checkpoints' })
  getPendingCheckpoints(@CurrentUser() user: JwtPayload) {
    return this.journeyService.getPendingCheckpoints(user.orgId);
  }

  @Get(':journeyId')
  @ApiOperation({ summary: 'Get full journey state with checkpoints and history' })
  getJourneyDetail(
    @CurrentUser() user: JwtPayload,
    @Param('journeyId', ParseUUIDPipe) journeyId: string,
  ) {
    return this.journeyService.getJourneyDetail(user.orgId, journeyId);
  }

  @Post(':journeyId/ai-brief')
  @ApiOperation({ summary: 'AI: generate a plain-English executive brief of this compliance journey — what was done, key findings, and next steps' })
  async aiJourneyBrief(
    @CurrentUser() user: JwtPayload,
    @Param('journeyId', ParseUUIDPipe) journeyId: string,
  ) {
    const journey = await this.journeyService.getJourneyDetail(user.orgId, journeyId);
    if (!journey) return { error: 'Journey not found' };

    const j = journey as any;
    const history: any[] = j.history ?? [];
    const checkpoints: any[] = j.checkpoints ?? [];

    // Summarise each stage from history
    const stagesSummary = history.slice(0, 20).map((h: any) =>
      `- ${h.stage}: ${h.status ?? 'completed'}${h.summary ? ` — ${String(h.summary).slice(0, 150)}` : ''}`,
    ).join('\n') || 'No stage history yet';

    const checkpointSummary = checkpoints.map((c: any) =>
      `- ${c.stage}: ${c.status}${c.comments ? ` (${String(c.comments).slice(0, 80)})` : ''}`,
    ).join('\n') || 'No checkpoints';

    const outputs = j.agentOutputs ?? {};
    const stageKeys = Object.keys(outputs).slice(0, 10);
    const outputHighlights = stageKeys.map((k) => {
      const v = outputs[k];
      const snippet = typeof v === 'object' ? JSON.stringify(v).slice(0, 200) : String(v).slice(0, 200);
      return `${k}: ${snippet}`;
    }).join('\n') || 'No agent outputs recorded';

    const systemPrompt = `You are a compliance program manager writing a clear executive brief about a compliance automation run. Write in plain English for a non-technical audience. Focus on business outcomes, not technical details.`;

    const userPrompt = `Write a brief about this compliance journey run:

Current stage: ${j.currentStage ?? 'unknown'}
Status: ${j.status ?? 'active'}
Started: ${j.createdAt ? new Date(j.createdAt).toLocaleDateString() : 'unknown'}

Stages completed:
${stagesSummary}

Human checkpoints:
${checkpointSummary}

Agent output highlights:
${outputHighlights}

Return ONLY a JSON object (no markdown):
{
  "headline": "One sentence summarizing what this compliance run achieved",
  "statusNarrative": "2-3 sentences on where the journey currently stands and what's been accomplished",
  "stageHighlights": [
    {
      "stage": "stage name",
      "achievement": "What was accomplished in this stage (1 sentence)"
    }
  ],
  "keyFindings": ["Important finding or decision made during this run"],
  "pendingItems": ["What still needs to happen before this journey completes"],
  "estimatedCompletion": "e.g. 2-3 more sessions | pending human review | complete",
  "executiveOneLiner": "One sentence suitable for sharing with a CEO or board"
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.3 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    return {
      journeyId,
      currentStage:     j.currentStage ?? '',
      status:           j.status ?? '',
      headline:         String(result.headline ?? '').slice(0, 200),
      statusNarrative:  String(result.statusNarrative ?? '').slice(0, 500),
      stageHighlights:  (Array.isArray(result.stageHighlights) ? result.stageHighlights : []).slice(0, 10).map((s: any) => ({
        stage:       String(s.stage ?? '').slice(0, 60),
        achievement: String(s.achievement ?? '').slice(0, 200),
      })),
      keyFindings:          (Array.isArray(result.keyFindings) ? result.keyFindings : []).slice(0, 5).map(String),
      pendingItems:         (Array.isArray(result.pendingItems) ? result.pendingItems : []).slice(0, 5).map(String),
      estimatedCompletion:  String(result.estimatedCompletion ?? '').slice(0, 100),
      executiveOneLiner:    String(result.executiveOneLiner ?? '').slice(0, 200),
      generatedAt:          new Date().toISOString(),
    };
  }

  @Patch('checkpoints/:checkpointId/resolve')
  @ApiOperation({ summary: 'Resolve a human checkpoint (approve/reject/override)' })
  resolveCheckpoint(
    @CurrentUser() user: JwtPayload,
    @Param('checkpointId', ParseUUIDPipe) checkpointId: string,
    @Body() dto: ResolveCheckpointDto,
  ) {
    return this.journeyService.resolveCheckpoint(
      user.orgId,
      checkpointId,
      user.sub,
      dto.decision,
      dto.comments,
      dto.overrideReason,
    );
  }
}
