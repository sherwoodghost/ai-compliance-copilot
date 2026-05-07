import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../../database/prisma.service';
import { SecretManagerService } from '../../../integrations/secret-manager.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL     = 'https://github.com/login/oauth/access_token';
const OAUTH_STATE_TTL_MS   = 10 * 60 * 1000; // 10 minutes

@Controller('integrations/oauth/github')
export class GithubOauthController {
  private readonly logger = new Logger(GithubOauthController.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly secretManager:  SecretManagerService,
  ) {}

  /**
   * Step 1 — redirect user to GitHub authorization page.
   * Accepts JWT via ?token= query param so the browser redirect works.
   */
  @Get()
  async initiateOAuth(
    @Query('token') token: string,
    @Res()          res:   Response,
  ) {
    if (!token) {
      throw new BadRequestException('Missing token query parameter');
    }

    // Manually verify JWT (same secret used by JwtStrategy)
    let user: JwtPayload;
    try {
      const secret = process.env['JWT_ACCESS_SECRET'] ?? '';
      user = jwt.verify(token, secret) as JwtPayload;
      if ((user as any)['type'] !== 'access') throw new Error('Wrong token type');
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const orgId = user.orgId;
    const clientId    = process.env['GITHUB_CLIENT_ID'];
    const redirectUri = this.callbackUrl();

    if (!clientId) {
      throw new BadRequestException('GitHub OAuth is not configured (missing GITHUB_CLIENT_ID)');
    }

    const state     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    // Persist state for CSRF validation in the callback
    await this.prisma.oAuthState.create({
      data: {
        state,
        orgId,
        userId:    user.sub,
        provider:  'github',
        expiresAt,
      },
    });

    const params = new URLSearchParams({
      client_id:    clientId,
      redirect_uri: redirectUri,
      scope:        'repo read:org admin:org',
      state,
    });

    return res.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
  }

  /**
   * Step 2 — GitHub redirects back here after the user authorizes.
   * Exchange code for token, store encrypted credential, redirect to frontend.
   */
  @Get('callback')
  async handleCallback(
    @Query('code')  code:  string,
    @Query('state') state: string,
    @Res()          res:   Response,
  ) {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/integrations?error=missing_params`);
    }

    // ── Validate CSRF state ───────────────────────────────────────────────
    const oauthState = await this.prisma.oAuthState.findUnique({ where: { state } });

    if (!oauthState) {
      this.logger.warn(`OAuth callback received unknown state: ${state}`);
      return res.redirect(`${frontendUrl}/integrations?error=invalid_state`);
    }

    // Delete immediately — single-use token
    await this.prisma.oAuthState.delete({ where: { state } });

    if (oauthState.expiresAt < new Date()) {
      return res.redirect(`${frontendUrl}/integrations?error=state_expired`);
    }

    const { orgId } = oauthState;

    // ── Exchange code for access token ────────────────────────────────────
    const clientId     = process.env['GITHUB_CLIENT_ID']     ?? '';
    const clientSecret = process.env['GITHUB_CLIENT_SECRET'] ?? '';

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept:          'application/json',
        'User-Agent':    'AI-Compliance-Copilot',
      },
      body: JSON.stringify({
        client_id:     clientId,
        client_secret: clientSecret,
        code,
        redirect_uri:  this.callbackUrl(),
      }),
    });

    if (!tokenRes.ok) {
      this.logger.error(`GitHub token exchange failed: ${tokenRes.status}`);
      return res.redirect(`${frontendUrl}/integrations?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json() as Record<string, string>;

    if (tokenData['error']) {
      this.logger.error(`GitHub token error: ${tokenData['error_description']}`);
      return res.redirect(`${frontendUrl}/integrations?error=${tokenData['error']}`);
    }

    const accessToken = tokenData['access_token'];

    // ── Fetch org name from GitHub user profile ───────────────────────────
    let org: string | undefined;
    try {
      const orgRes  = await fetch('https://api.github.com/user/orgs?per_page=1', {
        headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'AI-Compliance-Copilot' },
      });
      if (orgRes.ok) {
        const orgs = await orgRes.json() as any[];
        org = orgs[0]?.login;
      }
    } catch {
      // non-fatal — user can manually enter org name
    }

    // ── Encrypt & upsert integration ──────────────────────────────────────
    const credentials = await this.secretManager.encrypt({ accessToken, org: org ?? '' });

    await this.prisma.integration.upsert({
      where:  { orgId_provider: { orgId, provider: 'github' } },
      create: {
        orgId,
        provider:    'github',
        status:      'connected',
        credentials: credentials as any,
        settings:    { connectedVia: 'oauth' },
      },
      update: {
        status:      'connected',
        credentials: credentials as any,
        settings:    { connectedVia: 'oauth' },
        lastSyncedAt: null,
      },
    });

    this.logger.log(`GitHub OAuth connected for org ${orgId}${org ? ` (org: ${org})` : ''}`);

    return res.redirect(`${frontendUrl}/integrations?connected=github`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private callbackUrl(): string {
    const apiBase = process.env['API_BASE_URL'] ?? 'http://localhost:3001';
    return `${apiBase}/api/v1/integrations/oauth/github/callback`;
  }
}
