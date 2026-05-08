import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, IntegrationProvider } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';

class ConnectIntegrationDto {
  @IsEnum(IntegrationProvider) provider: IntegrationProvider;
  @IsObject() credentials: Record<string, unknown>;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

@ApiTags('integrations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.findAll(user.orgId);
  }

  @Post('connect')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Connect a new integration (admin only)' })
  connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(user.orgId, dto.provider, dto.credentials, dto.settings);
  }

  @Post(':integrationId/test')
  @Roles(UserRole.admin)
  testConnection(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.testConnection(user.orgId, integrationId);
  }

  @Post(':integrationId/sync')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Manually trigger evidence sync for an integration' })
  sync(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.sync(user.orgId, integrationId);
  }

  @Delete(':integrationId')
  @Roles(UserRole.admin)
  disconnect(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.disconnect(user.orgId, integrationId);
  }

  @Post('ai-recommend')
  @Roles(UserRole.admin, UserRole.auditor, UserRole.member)
  @ApiOperation({ summary: 'AI: recommend which integrations to connect based on compliance gaps and infrastructure' })
  async aiRecommend(@CurrentUser() user: JwtPayload) {
    const orgId = user.orgId;

    const [connected, profile, controlGaps, vendors] = await Promise.all([
      this.integrationsService.findAll(orgId),
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.organizationControl.findMany({
        where: { orgId, status: { notIn: ['implemented', 'not_applicable'] } },
        include: { control: { select: { code: true, title: true, category: true } } },
        take: 40,
      }),
      this.prisma.vendorRisk.findMany({ where: { orgId }, take: 10 }),
    ]);

    const pd = (profile as any) ?? {};
    const frameworks      = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');
    const cloudProviders  = ((pd.infrastructure as any)?.cloudProviders ?? []).join(', ') || 'not specified';
    const hrSystem        = (pd.infrastructure as any)?.hrSystem ?? 'not specified';
    const mdmTool         = (pd.infrastructure as any)?.mdmTool ?? 'not specified';
    const ciCd            = (pd.infrastructure as any)?.ciCd ?? 'not specified';
    const companySize     = pd.companySize ?? 'small';

    const connectedKeys = (connected as any[]).map((i: any) => i.provider ?? i.key).join(', ') || 'none';

    const gapCategories = [...new Set(controlGaps.map((c) => c.control.category))].slice(0, 8).join(', ');

    // Full provider list for AI to choose from
    const allProviders = [
      'okta', 'google_workspace', 'azure_ad', 'jumpcloud',
      'github', 'gitlab', 'aws', 'gcp', 'azure',
      'crowdstrike', 'sentinelone', 'jamf', 'kandji',
      'jira', 'linear', 'datadog', 'new_relic', 'rippling', 'gusto',
      'cloudflare', 'snyk', 'qualys',
    ].join(', ');

    const systemPrompt = `You are a compliance engineer advising on which integrations to connect to automate evidence collection and satisfy compliance controls. Be specific and prioritize highest-impact integrations.`;

    const userPrompt = `Recommend the top 5-6 integrations for this organisation:

Company: ${companySize} employees, ${pd.industry ?? 'software'} industry
Compliance targets: ${frameworks}
Cloud infrastructure: ${cloudProviders}
HR system: ${hrSystem}
MDM tool: ${mdmTool}
CI/CD: ${ciCd}
Already connected: ${connectedKeys}
Control gaps in categories: ${gapCategories}
Notable vendors: ${vendors.slice(0, 5).map((v: any) => v.vendorName).join(', ') || 'none recorded'}

Available providers: ${allProviders}

Return ONLY a JSON array (no markdown):
[
  {
    "providerKey": "exact key from available providers list",
    "providerName": "Human-readable name",
    "priority": "critical|high|medium",
    "reason": "1 sentence why this integration is specifically important for this org",
    "controlsCovered": ["CC6.1", "CC6.2"],
    "estimatedEvidenceItems": 12,
    "category": "Identity|Cloud|MDM|SIEM|Code|HRIS|Ticketing|Security"
  }
]

Skip integrations already connected. Focus on highest compliance impact.`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.2 },
    );

    let recommendations: any[] = [];
    try {
      const match = raw.content.match(/\[[\s\S]*\]/);
      if (match) recommendations = JSON.parse(match[0]);
      if (!Array.isArray(recommendations)) recommendations = [];
    } catch {
      recommendations = [];
    }

    const validPriorities = ['critical', 'high', 'medium'];
    const validCategories = ['Identity', 'Cloud', 'MDM', 'SIEM', 'Code', 'HRIS', 'Ticketing', 'Security'];

    return {
      connectedCount:  (connected as any[]).length,
      gapCategories:   gapCategories.split(', ').filter(Boolean),
      recommendations: recommendations.slice(0, 6).map((r: any) => ({
        providerKey:           String(r.providerKey ?? '').slice(0, 50),
        providerName:          String(r.providerName ?? '').slice(0, 80),
        priority:              validPriorities.includes(r.priority) ? r.priority : 'medium',
        reason:                String(r.reason ?? '').slice(0, 300),
        controlsCovered:       (Array.isArray(r.controlsCovered) ? r.controlsCovered : []).slice(0, 8).map(String),
        estimatedEvidenceItems: Number(r.estimatedEvidenceItems ?? 0),
        category:              validCategories.includes(r.category) ? r.category : 'Security',
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
