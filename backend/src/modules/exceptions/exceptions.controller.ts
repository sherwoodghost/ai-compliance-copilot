import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus, NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ExceptionsService, CreateExceptionDto, UpdateExceptionDto } from './exceptions.service';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('exceptions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('controls/exceptions')
export class ExceptionsController {
  constructor(
    private readonly svc: ExceptionsService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all control exceptions for the org' })
  findAll(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.findAll(user.orgId, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Exception counts by status' })
  stats(@CurrentUser() user: JwtPayload) {
    return this.svc.getStats(user.orgId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(user.orgId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Request a new control exception' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExceptionDto) {
    return this.svc.create(user.orgId, user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve, reject, or update a control exception' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExceptionDto,
  ) {
    return this.svc.update(user.orgId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.delete(user.orgId, id);
  }

  @Post('ai-draft')
  @ApiOperation({ summary: 'AI: draft exception justification and compensating control for a given control' })
  async aiDraft(@CurrentUser() user: JwtPayload, @Body() body: { controlId: string }) {
    const orgControl = await this.prisma.organizationControl.findFirst({
      where: { orgId: user.orgId, controlId: body.controlId },
      include: { control: true },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organisation');

    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const pd = (profile?.profileData as any) ?? {};
    const companyName = pd.companyName ?? 'our organisation';
    const industry = pd.industry ?? 'technology';
    const companySize = pd.companySize ?? 'small';
    const infra = (pd.infrastructure as any) ?? {};
    const cloudProviders = (infra.cloudProviders ?? []).join(', ') || 'standard cloud infrastructure';
    const mfaStatus = infra.mfaEnabled ? 'MFA is enforced' : 'MFA status unknown';

    const systemPrompt = `You are a compliance expert writing formal control exception documentation for a SOC 2 / ISO 27001 audit. Use precise, professional language that auditors find credible. Avoid generic filler — be specific.`;

    const userPrompt = `Draft a control exception request for:

Control: [${orgControl.control.code}] ${orgControl.control.title}
Description: ${(orgControl.control as any).description ?? (orgControl.control as any).guidance ?? 'N/A'}
Category: ${(orgControl.control as any).category ?? 'General'}
Current status: ${orgControl.status}

Organisation context:
- Company: ${companyName} (${industry}, ${companySize} employees)
- Infrastructure: ${cloudProviders}
- ${mfaStatus}

Return ONLY a JSON object (no markdown fences):
{
  "title": "Concise exception title under 80 chars (e.g. 'Vendor MFA Exception — Legacy SFTP Integration')",
  "justification": "3-4 sentences. Formal business justification explaining why full implementation is not currently feasible. Reference specific technical or contractual constraints. Write in first-person plural.",
  "compensatingControl": "2-3 sentences. Specific, measurable alternative controls that reduce the residual risk. Mention concrete mechanisms (e.g. enhanced monitoring, manual reviews, contractual obligations).",
  "residualRisk": "high|medium|low",
  "suggestedExpiryMonths": 6
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

    const validRisk = ['high', 'medium', 'low'];
    return {
      title: String(result.title ?? '').slice(0, 120),
      justification: String(result.justification ?? '').slice(0, 2000),
      compensatingControl: String(result.compensatingControl ?? '').slice(0, 1000),
      residualRisk: validRisk.includes(result.residualRisk) ? result.residualRisk : 'medium',
      suggestedExpiryMonths: Number.isFinite(result.suggestedExpiryMonths) ? result.suggestedExpiryMonths : 6,
    };
  }
}
