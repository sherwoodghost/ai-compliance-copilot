import { Controller, Get, Param, Patch, Post, Body, UseGuards, Req } from '@nestjs/common'; // v2
import { ApiOperation } from '@nestjs/swagger';
import { ControlLibraryService } from '../../control-library/control-library.service';
import { ControlApplicabilityEngine } from '../../control-library/applicability-engine.service';
import { ApplicabilityReviewerService } from '../../control-library/applicability-reviewer.service';
import { CrosswalkService } from '../../control-library/crosswalk.service';
import { LlmService } from '../../llm/llm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('controls/library')
@UseGuards(JwtAuthGuard)
export class ControlLibraryController {
  constructor(
    private readonly library: ControlLibraryService,
    private readonly applicability: ControlApplicabilityEngine,
    private readonly applicabilityReviewer: ApplicabilityReviewerService,
    private readonly crosswalk: CrosswalkService,
    private readonly llm: LlmService,
  ) {}

  /** Public — used by external framework reference pages (/frameworks) */
  @Public()
  @Get()
  async getFullLibrary() {
    return this.library.getFullLibrary();
  }

  /** Must be declared BEFORE @Get(':framework') to avoid the parameterised route swallowing it */
  @Get('applicability')
  async getApplicabilityMatrix(@Req() req: any) {
    return this.applicability.getApplicabilityMatrix(req.user.orgId);
  }

  /** Public — used by external framework reference pages */
  @Public()
  @Get(':framework')
  async getByFramework(@Param('framework') framework: string) {
    const type = framework.toUpperCase();
    // Guard: only pass valid FrameworkType values to Prisma
    if (type !== 'SOC2' && type !== 'ISO27001') return [];
    return this.library.getControlsByFramework(type as 'SOC2' | 'ISO27001');
  }

  /** Public — used by external control detail pages and ControlChip popover */
  @Public()
  @Get('control/:code')
  async getByCode(@Param('code') code: string) {
    const control = await this.library.getControlByCode(code);
    if (!control) return null;

    // Transform raw Prisma crosswalk records → flat CrosswalkMapping shape expected by frontend
    const transformCrosswalks = (items: any[], currentCode: string) =>
      (items ?? []).map((m: any) => {
        // crosswalkSources: current control is the source, targetControl is the related one
        // crosswalkTargets: current control is the target, sourceControl is the related one
        const srcCode  = m.sourceControl?.code  ?? currentCode;
        const srcTitle = m.sourceControl?.title ?? '';
        const tgtCode  = m.targetControl?.code  ?? currentCode;
        const tgtTitle = m.targetControl?.title ?? '';
        return {
          sourceCode:      srcCode,
          sourceTitle:     srcTitle,
          targetCode:      tgtCode,
          targetTitle:     tgtTitle,
          mappingType:     m.mappingType,
          confidence:      m.confidence,
          sourceFramework: m.sourceControl?.framework?.name ?? '',
          targetFramework: m.targetControl?.framework?.name ?? '',
        };
      });

    return {
      ...control,
      crosswalkSources: transformCrosswalks(control.crosswalkSources ?? [], code),
      crosswalkTargets: transformCrosswalks(control.crosswalkTargets ?? [], code),
    };
  }

  /** Public — used by ControlChip popover to show related controls */
  @Public()
  @Get('control/:code/crosswalks')
  async getCrosswalks(@Param('code') code: string) {
    const raw = await this.crosswalk.getMappingsForCode(code);
    // Transform raw Prisma records → flat CrosswalkMapping shape expected by frontend
    return (raw as any[]).map((m) => ({
      sourceCode:      m.sourceControl?.code     ?? '',
      sourceTitle:     m.sourceControl?.title    ?? '',
      targetCode:      m.targetControl?.code     ?? '',
      targetTitle:     m.targetControl?.title    ?? '',
      mappingType:     m.mappingType,
      confidence:      m.confidence,
      sourceFramework: m.sourceControl?.framework?.name ?? '',
      targetFramework: m.targetControl?.framework?.name ?? '',
    }));
  }

  @Post('control/:code/ai-explain')
  @ApiOperation({ summary: 'AI: generate plain-English explanation of what a control means, how to implement it, evidence needed, and common pitfalls' })
  async aiExplainControl(@Param('code') code: string) {
    const control = await this.library.getControlByCode(code);
    if (!control) return { error: 'Control not found' };

    const evidenceList = (control.evidenceRequirements ?? [])
      .map((e: any) => `- ${e.evidenceType}${e.isMandatory ? ' (mandatory)' : ''}: ${e.description}`)
      .join('\n') || 'Not specified';

    const policyList = (control.policyRequirements ?? [])
      .map((p: any) => `- ${p.policyName}: ${p.description}`)
      .join('\n') || 'None listed';

    const systemPrompt = `You are a compliance expert helping engineering and security teams understand audit controls in plain English. Be practical, concrete, and focus on what teams actually need to do. Avoid jargon. Use short sentences.`;

    const userPrompt = `Explain this compliance control to a technical team:

Control: [${control.code}] ${control.title}
Framework: ${(control.framework as any)?.name ?? 'Unknown'} (${(control.framework as any)?.type ?? ''})
Category: ${control.category ?? 'General'}
Official Description: ${control.description ?? 'No description'}
${control.guidance ? `Implementation Guidance: ${control.guidance}` : ''}

Evidence Required:
${evidenceList}

Policies Required:
${policyList}

Return ONLY a JSON object (no markdown):
{
  "plainEnglish": "2-3 sentences explaining what this control actually means in plain language",
  "whyItMatters": "1-2 sentences on why auditors care about this control",
  "implementationSteps": [
    "Concrete step 1",
    "Concrete step 2",
    "Concrete step 3"
  ],
  "typicalEvidence": [
    "Evidence item 1 (e.g. screenshot of MFA enforcement in Okta)",
    "Evidence item 2"
  ],
  "commonMistakes": [
    "Common pitfall 1",
    "Common pitfall 2"
  ],
  "timeToImplement": "e.g. 1-2 days if tooling exists, 2-4 weeks if starting from scratch",
  "difficulty": "easy|medium|hard",
  "relatedTools": ["Tool or service name 1", "Tool 2"]
}`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'policy', temperature: 0.25 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validDifficulty = ['easy', 'medium', 'hard'];

    return {
      code,
      title: control.title,
      plainEnglish:       String(result.plainEnglish ?? '').slice(0, 600),
      whyItMatters:       String(result.whyItMatters ?? '').slice(0, 400),
      implementationSteps: (Array.isArray(result.implementationSteps) ? result.implementationSteps : []).slice(0, 8).map(String),
      typicalEvidence:    (Array.isArray(result.typicalEvidence) ? result.typicalEvidence : []).slice(0, 6).map(String),
      commonMistakes:     (Array.isArray(result.commonMistakes) ? result.commonMistakes : []).slice(0, 5).map(String),
      timeToImplement:    String(result.timeToImplement ?? '').slice(0, 100),
      difficulty:         validDifficulty.includes(result.difficulty) ? result.difficulty : 'medium',
      relatedTools:       (Array.isArray(result.relatedTools) ? result.relatedTools : []).slice(0, 6).map(String),
    };
  }

  @Patch('applicability/:controlId')
  async overrideApplicability(
    @Param('controlId') controlId: string,
    @Body() body: { applicable: boolean; rationale: string },
    @Req() req: any,
  ) {
    return this.applicability.overrideApplicability(
      req.user.orgId,
      controlId,
      body.applicable,
      body.rationale,
      req.user.id,
    );
  }

  @Post('applicability/re-evaluate')
  @ApiOperation({ summary: 'Re-run AI enrichment for all control applicability records (company-specific notes, priority, context)' })
  async reEvaluateApplicability(@Req() req: any) {
    return this.applicabilityReviewer.reEvaluate(req.user.orgId);
  }

  @Patch('applicability/:controlId/owner')
  @ApiOperation({ summary: 'Assign or unassign an owner to a control (updates OrganizationControl.assignedTo)' })
  async assignOwner(
    @Param('controlId') controlId: string,
    @Body() body: { ownerId: string | null },
    @Req() req: any,
  ) {
    await this.applicability.assignOwner(req.user.orgId, controlId, body.ownerId ?? null);
    return { success: true };
  }
}
