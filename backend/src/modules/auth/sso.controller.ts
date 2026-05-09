import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SsoService, SsoConfigDto } from './sso.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a SSO redirect response into a browser redirect */
function ssoRedirect(res: Response, redirectUrl: string, params: Record<string, string>): void {
  const url = new URL(redirectUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  res.redirect(url.toString());
}

// ── Controller ────────────────────────────────────────────────────────────────

@ApiTags('sso')
@Controller('auth/sso')
export class SsoController {
  private readonly logger = new Logger(SsoController.name);

  constructor(
    private readonly ssoService:  SsoService,
    private readonly prisma:       PrismaService,
    private readonly config:       ConfigService,
  ) {}

  // ── SP Metadata (public — IdP needs this) ────────────────────────────────

  @Get(':orgSlug/metadata')
  @Public()
  @ApiOperation({ summary: 'Return SAML SP metadata XML for the specified organization' })
  @ApiResponse({ status: 200, description: 'SP metadata XML' })
  async getMetadata(@Param('orgSlug') orgSlug: string, @Res() res: Response) {
    const config = await this.prisma.ssoConfig.findFirst({
      where: { organization: { slug: orgSlug } },
      select: { spEntityId: true, acsUrl: true },
    }).catch(() => null);

    if (!config) {
      throw new NotFoundException('SSO not configured for this organization');
    }

    const xml = this.ssoService.generateMetadataXml(orgSlug, config);
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  }

  // ── SAML Login Initiation ─────────────────────────────────────────────────

  /**
   * GET /auth/sso/:orgSlug
   * Redirects to the IdP SSO URL (initiates SAML flow).
   * For now we do a simple redirect to the IdP SSO URL stored in config,
   * since node-saml's PassportStrategy redirect only works in traditional
   * middleware stacks. For a full SP-initiated flow, clients would POST
   * to the IdP with the SAMLRequest — this endpoint provides the URL.
   */
  @Get(':orgSlug')
  @Public()
  @ApiOperation({ summary: 'Initiate SAML SSO login for the organization' })
  async initiateLogin(
    @Param('orgSlug') orgSlug: string,
    @Res() res: Response,
  ) {
    const config = await this.prisma.ssoConfig.findFirst({
      where: { organization: { slug: orgSlug } },
      include: { organization: { select: { ssoEnabled: true } } },
    }).catch(() => null);

    if (!config?.organization?.ssoEnabled) {
      throw new NotFoundException('SSO not enabled for this organization');
    }

    if (!config.idpSsoUrl) {
      throw new BadRequestException('IdP SSO URL not configured');
    }

    // Redirect directly to the IdP SSO URL — IdP will redirect back to ACS
    res.redirect(config.idpSsoUrl);
  }

  // ── ACS Callback (IdP posts SAML response here) ───────────────────────────

  /**
   * POST /auth/sso/:orgSlug/callback
   * The IdP POSTs the SAML assertion to this endpoint after authentication.
   * We validate the assertion, find/create the user (JIT provisioning),
   * issue JWT tokens, and redirect to the frontend with the token.
   */
  @Post(':orgSlug/callback')
  @Public()
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'SAML ACS callback — processes IdP assertion and issues JWT' })
  async callback(
    @Param('orgSlug') orgSlug: string,
    @Body() body: any,
    @Req()  req: Request,
    @Res()  res: Response,
  ) {
    const frontendUrl = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
    const callbackPath = '/auth/sso-callback';

    try {
      // Load config for this org
      const ssoConfig = await this.prisma.ssoConfig.findFirst({
        where: { organization: { slug: orgSlug } },
        include: { organization: { select: { id: true, slug: true, ssoEnabled: true } } },
      });

      if (!ssoConfig?.organization?.ssoEnabled) {
        return ssoRedirect(res, frontendUrl + callbackPath, {
          error: 'SSO not enabled for this organization',
        });
      }

      if (!ssoConfig.idpCertificate || !ssoConfig.idpSsoUrl) {
        return ssoRedirect(res, frontendUrl + callbackPath, {
          error: 'SSO not fully configured',
        });
      }

      // Extract SAMLResponse from POST body
      const samlResponse = body?.SAMLResponse;
      if (!samlResponse) {
        return ssoRedirect(res, frontendUrl + callbackPath, {
          error: 'Missing SAML response',
        });
      }

      // Parse and validate the SAML assertion using node-saml
      const { SAML } = await import('@node-saml/node-saml').catch(() => {
        throw new Error('@node-saml/node-saml not available');
      });

      const samlInstance = new SAML({
        callbackUrl:          ssoConfig.acsUrl ?? `${frontendUrl}/api/v1/auth/sso/${orgSlug}/callback`,
        entryPoint:           ssoConfig.idpSsoUrl!,
        issuer:               ssoConfig.spEntityId ?? `sp:${orgSlug}`,
        idpCert:              ssoConfig.idpCertificate!,
        wantAssertionsSigned: false,
        audience:             false,
        validateInResponseTo: 'never' as const,
      } as any);

      const { profile } = await samlInstance.validatePostResponseAsync({ SAMLResponse: samlResponse });

      if (!profile) {
        return ssoRedirect(res, frontendUrl + callbackPath, { error: 'Invalid SAML assertion' });
      }

      // Extract email
      const emailAttr = ssoConfig.emailAttribute ?? 'email';
      const email = (profile as any)[emailAttr]
        ?? (profile as any).nameID
        ?? (profile as any).mail
        ?? (profile as any).attributes?.[emailAttr];

      if (!email) {
        return ssoRedirect(res, frontendUrl + callbackPath, { error: 'SAML assertion missing email' });
      }

      const orgId = ssoConfig.organization.id;

      // JIT: find or create user
      let user = await this.prisma.user.findFirst({
        where: { email: email.toLowerCase(), orgId },
      });

      if (!user) {
        const firstName = (profile as any)[ssoConfig.firstNameAttribute ?? 'firstName'] ?? '';
        const lastName  = (profile as any)[ssoConfig.lastNameAttribute  ?? 'lastName']  ?? '';
        const fullName  = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

        this.logger.log('JIT provisioning SSO user ' + email + ' for org ' + orgSlug);
        user = await this.prisma.user.create({
          data: {
            orgId,
            email:        email.toLowerCase(),
            fullName,
            passwordHash: '',
            role:         'member',
            platformRole: 'contributor',
            status:       'active',
          },
        });
      } else if ((user as any).status === 'suspended' || (user as any).status === 'deactivated') {
        return ssoRedirect(res, frontendUrl + callbackPath, { error: 'User account is suspended' });
      }

      // Update last login
      await this.prisma.user.update({
        where: { id: user.id },
        data:  { lastLoginAt: new Date() },
      });

      // Issue JWT tokens
      const tokens = await this.ssoService.issueSsoTokens(user);

      // Redirect to frontend with tokens as query params
      // Frontend picks these up and stores them in local storage
      return ssoRedirect(res, frontendUrl + callbackPath, {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        userId:       user.id,
        orgId:        user.orgId,
      });
    } catch (err: any) {
      this.logger.error('SSO callback error: ' + err.message);
      return ssoRedirect(res, frontendUrl + callbackPath, {
        error: 'SSO authentication failed',
      });
    }
  }

  // ── Authenticated SSO Config Endpoints ───────────────────────────────────

  @Get('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get SSO configuration for the current organization' })
  async getConfig(@CurrentUser() user: any) {
    return this.ssoService.getConfig(user.orgId);
  }

  @Post('config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update SSO configuration' })
  async upsertConfig(@CurrentUser() user: any, @Body() dto: SsoConfigDto) {
    return this.ssoService.upsertConfig(user.orgId, dto);
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test SSO configuration by checking IdP URL reachability' })
  async testConfig(@CurrentUser() user: any): Promise<{ ok: boolean; error?: string }> {
    return this.ssoService.testConfig(user.orgId);
  }

  @Patch('toggle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable SSO for the organization' })
  async toggleSso(
    @CurrentUser() user: any,
    @Body('enabled') enabled: boolean,
  ) {
    return this.ssoService.toggleSso(user.orgId, enabled);
  }
}
