import {
  Controller, Get, Patch, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TrustCenterService, UpdateTrustCenterDto, CreateAccessLinkDto } from './trust-center.service';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('trust-center')
@Controller('trust-center')
export class TrustCenterController {
  constructor(
    private readonly trustCenter: TrustCenterService,
    private readonly llm:         LlmService,
    private readonly prisma:      PrismaService,
  ) {}

  // ─── Authenticated (admin) endpoints ─────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get or initialise the org trust center' })
  async getOrCreate(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getOrCreate(user.orgId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update trust center branding and settings' })
  async update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTrustCenterDto) {
    return this.trustCenter.update(user.orgId, dto);
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish the trust center (make it publicly accessible)' })
  async publish(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.publish(user.orgId);
  }

  @Post('unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish the trust center (make it private)' })
  async unpublish(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.unpublish(user.orgId);
  }

  @Post('links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a shareable access link for auditors / customers' })
  async createLink(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccessLinkDto) {
    return this.trustCenter.createAccessLink(user.orgId, dto);
  }

  @Get('links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all access links for the org trust center' })
  async listLinks(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.listAccessLinks(user.orgId);
  }

  @Get('pass-rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor', 'member')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get control test pass rate summary for the org' })
  async passRate(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getControlPassRate(user.orgId);
  }

  @Get('checks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor', 'member')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get trust check items derived from control test results' })
  async getChecks(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getChecks(user.orgId);
  }

  @Post('ai-security-faq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor', 'member')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'AI: generate security FAQ for prospects and customers based on real compliance posture' })
  async generateSecurityFaq(@CurrentUser() user: JwtPayload) {
    const orgId = user.orgId;

    const [profile, controlStats, implementedControls, passRate, certifications] = await Promise.all([
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.organizationControl.groupBy({
        by:    ['status'],
        where: { orgId },
        _count: { id: true },
      }),
      this.prisma.organizationControl.findMany({
        where:   { orgId, status: 'implemented' },
        include: { control: { select: { code: true, title: true, category: true } } },
        take:    30,
      }),
      this.trustCenter.getControlPassRate(orgId),
      this.trustCenter.getOrCreate(orgId).then((tc) => (tc as any).certifications ?? []),
    ]);

    const pd = (profile?.profileData as any) ?? {};
    const companyName   = pd.companyName   ?? 'our company';
    const industry      = pd.industry      ?? 'technology';
    const companySize   = pd.companySize   ?? 'small';
    const frameworks    = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(' and ');
    const infra         = (pd.infrastructure as any) ?? {};
    const cloudProviders = (infra.cloudProviders ?? []).join(', ') || 'cloud infrastructure';
    const mfaEnabled    = infra.mfaEnabled ?? false;
    const dataTypes     = (pd.dataHandling?.dataTypes ?? []).join(', ') || 'customer data';

    const ctrlByStatus: Record<string, number> = {};
    for (const g of controlStats) ctrlByStatus[g.status] = (g._count as any).id ?? 0;
    const implemented = ctrlByStatus['implemented'] ?? 0;
    const total = Object.values(ctrlByStatus).reduce((a, b) => a + b, 0);

    const implementedCategories = [...new Set(implementedControls.map((c) => c.control.category))];

    const systemPrompt = `You are a security communication expert writing customer-facing security FAQ responses for a B2B SaaS company. Write in clear, confident language that builds trust. Avoid jargon. Be specific where possible. Do not overstate capabilities.`;

    const userPrompt = `Generate a security FAQ for ${companyName} (${industry}, ${companySize} employees) based on this compliance posture:

COMPLIANCE DATA:
- Target frameworks: ${frameworks}
- Controls: ${implemented}/${total} implemented (${Math.round((implemented / Math.max(total, 1)) * 100)}% complete)
- Implemented categories: ${implementedCategories.join(', ')}
- Certifications/in-progress: ${certifications.join(', ') || 'SOC 2 Type II (in progress)'}
- Infrastructure: ${cloudProviders}
- MFA enforced: ${mfaEnabled}
- Data handled: ${dataTypes}
- Test pass rate: ${(passRate as any)?.passRate ?? 'N/A'}%

Generate 7-8 questions that prospects, customers, and enterprise buyers commonly ask during security reviews. For each, write a direct, confident answer based on the data above.

Categories to cover: data security, access control, incident response, compliance/certifications, vendor risk, data retention/deletion, penetration testing, employee security training.

Return ONLY a JSON array (no markdown fences):
[
  {
    "category": "Data Security|Access Control|Compliance|Incident Response|Vendor Risk|Data Management|Employee Security",
    "question": "The actual question a customer would ask",
    "answer": "2-4 sentence confident, factual answer. Reference specific controls/certifications where applicable. If still in progress, acknowledge it honestly.",
    "strength": "high|medium"
  }
]`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.3 },
    );

    let faqs: any[];
    try {
      faqs = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
      if (!Array.isArray(faqs)) faqs = [];
    } catch {
      faqs = [];
    }

    const validStrength = ['high', 'medium'];
    const validCategories = ['Data Security', 'Access Control', 'Compliance', 'Incident Response', 'Vendor Risk', 'Data Management', 'Employee Security'];

    return {
      companyName,
      frameworks,
      faqs: faqs.slice(0, 8).map((f: any) => ({
        category: validCategories.includes(f.category) ? f.category : 'Compliance',
        question: String(f.question ?? '').slice(0, 200),
        answer:   String(f.answer ?? '').slice(0, 800),
        strength: validStrength.includes(f.strength) ? f.strength : 'medium',
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}

// ─── Public controller (no auth guard) ─────────────────────────────────────

@ApiTags('public')
@Controller('public/trust')
export class PublicTrustCenterController {
  constructor(private readonly trustCenter: TrustCenterService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Public trust center page data (no auth required)' })
  async getPublic(
    @Param('slug')   slug:  string,
    @Query('token')  token?: string,
  ) {
    return this.trustCenter.getPublicBySlug(slug, token);
  }
}
