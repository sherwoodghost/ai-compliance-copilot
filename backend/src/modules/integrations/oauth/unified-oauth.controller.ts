/**
 * Unified OAuth controller for all supported OAuth integrations.
 * Handles: Google Workspace, Slack, Azure AD, GitLab, Atlassian (Jira/Confluence),
 *          Linear, Bitbucket, Dropbox, Box, HubSpot, GitHub (handled by dedicated controller too).
 *
 * Flow:
 *   GET /integrations/oauth/:provider?token=<jwt>  → redirect to provider
 *   GET /integrations/oauth/:provider/callback      → exchange code, store credentials, redirect frontend
 */

import {
  Controller,
  Get,
  Param,
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

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Provider OAuth Configuration ────────────────────────────────────────────

interface OAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra params to include in the authorization URL */
  extraAuthParams?: Record<string, string>;
  /** Extract meaningful credentials from the token response */
  extractCredentials?: (tokenData: Record<string, unknown>, meta?: Record<string, unknown>) => Record<string, unknown>;
  /** Optional: fetch additional user/org info after token exchange */
  fetchMetadata?: (tokenData: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

const OAUTH_CONFIGS: Record<string, OAuthProviderConfig> = {

  // ── Google Workspace ────────────────────────────────────────────────────────
  google_workspace: {
    authorizeUrl:  'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl:      'https://oauth2.googleapis.com/token',
    scope:         'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly',
    clientIdEnv:   'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
      expiresIn:    t['expires_in'],
    }),
    fetchMetadata: async (t) => {
      try {
        const res = await fetch('https://www.googleapis.com/admin/directory/v1/customers/my_customer',
          { headers: { Authorization: `Bearer ${t['access_token']}` } });
        if (res.ok) {
          const data = await res.json() as any;
          return { customerId: data.id, domain: data.customerDomain };
        }
      } catch { /* non-fatal */ }
      return {};
    },
  },

  // ── Slack ───────────────────────────────────────────────────────────────────
  slack: {
    authorizeUrl:  'https://slack.com/oauth/v2/authorize',
    tokenUrl:      'https://slack.com/api/oauth.v2.access',
    scope:         'auditlogs:read channels:read files:read team:read users:read',
    clientIdEnv:   'SLACK_CLIENT_ID',
    clientSecretEnv: 'SLACK_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken: (t['access_token'] as string) || (t['authed_user'] as any)?.['access_token'],
      teamId:      (t['team'] as any)?.['id'],
      teamName:    (t['team'] as any)?.['name'],
    }),
  },

  // ── Azure AD ────────────────────────────────────────────────────────────────
  azure: {
    authorizeUrl:  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl:      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope:         'openid profile email User.Read.All Group.Read.All AuditLog.Read.All',
    clientIdEnv:   'AZURE_CLIENT_ID',
    clientSecretEnv: 'AZURE_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
      expiresIn:    t['expires_in'],
    }),
    fetchMetadata: async (t) => {
      try {
        const res = await fetch('https://graph.microsoft.com/v1.0/organization',
          { headers: { Authorization: `Bearer ${t['access_token']}` } });
        if (res.ok) {
          const data = await res.json() as any;
          return { tenantId: data.value?.[0]?.id, tenantName: data.value?.[0]?.displayName };
        }
      } catch { /* non-fatal */ }
      return {};
    },
  },

  // ── GitLab ──────────────────────────────────────────────────────────────────
  gitlab: {
    authorizeUrl:  'https://gitlab.com/oauth/authorize',
    tokenUrl:      'https://gitlab.com/oauth/token',
    scope:         'read_api read_user read_repository',
    clientIdEnv:   'GITLAB_CLIENT_ID',
    clientSecretEnv: 'GITLAB_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
    fetchMetadata: async (t) => {
      try {
        const res = await fetch('https://gitlab.com/api/v4/user',
          { headers: { Authorization: `Bearer ${t['access_token']}` } });
        if (res.ok) {
          const data = await res.json() as any;
          return { username: data.username, namespace: data.username };
        }
      } catch { /* non-fatal */ }
      return {};
    },
  },

  // ── Atlassian (Jira / Confluence) ───────────────────────────────────────────
  jira: {
    authorizeUrl:  'https://auth.atlassian.com/authorize',
    tokenUrl:      'https://auth.atlassian.com/oauth/token',
    scope:         'read:jira-user read:jira-work read:me offline_access',
    clientIdEnv:   'ATLASSIAN_CLIENT_ID',
    clientSecretEnv: 'ATLASSIAN_CLIENT_SECRET',
    extraAuthParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
    fetchMetadata: async (t) => {
      try {
        const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources',
          { headers: { Authorization: `Bearer ${t['access_token']}` } });
        if (res.ok) {
          const sites = await res.json() as any[];
          return { cloudId: sites[0]?.id, siteUrl: sites[0]?.url, siteName: sites[0]?.name };
        }
      } catch { /* non-fatal */ }
      return {};
    },
  },

  // ── Bitbucket ───────────────────────────────────────────────────────────────
  bitbucket: {
    authorizeUrl:  'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl:      'https://bitbucket.org/site/oauth2/access_token',
    scope:         'repository account pullrequest',
    clientIdEnv:   'BITBUCKET_CLIENT_ID',
    clientSecretEnv: 'BITBUCKET_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
    fetchMetadata: async (t) => {
      try {
        const res = await fetch('https://api.bitbucket.org/2.0/user',
          { headers: { Authorization: `Bearer ${t['access_token']}` } });
        if (res.ok) {
          const u = await res.json() as any;
          return { username: u.username, accountId: u.account_id };
        }
      } catch { /* non-fatal */ }
      return {};
    },
  },

  // ── Linear ──────────────────────────────────────────────────────────────────
  linear: {
    authorizeUrl:  'https://linear.app/oauth/authorize',
    tokenUrl:      'https://api.linear.app/oauth/token',
    scope:         'read',
    clientIdEnv:   'LINEAR_CLIENT_ID',
    clientSecretEnv: 'LINEAR_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken: t['access_token'],
    }),
  },

  // ── Dropbox ─────────────────────────────────────────────────────────────────
  dropbox: {
    authorizeUrl:  'https://www.dropbox.com/oauth2/authorize',
    tokenUrl:      'https://api.dropboxapi.com/oauth2/token',
    scope:         'account_info.read files.metadata.read team_info.read',
    clientIdEnv:   'DROPBOX_CLIENT_ID',
    clientSecretEnv: 'DROPBOX_CLIENT_SECRET',
    extraAuthParams: { token_access_type: 'offline' },
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },

  // ── Box ─────────────────────────────────────────────────────────────────────
  box: {
    authorizeUrl:  'https://account.box.com/api/oauth2/authorize',
    tokenUrl:      'https://api.box.com/oauth2/token',
    scope:         'root_readwrite manage_enterprise',
    clientIdEnv:   'BOX_CLIENT_ID',
    clientSecretEnv: 'BOX_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },

  // ── HubSpot ─────────────────────────────────────────────────────────────────
  hubspot: {
    authorizeUrl:  'https://app.hubspot.com/oauth/authorize',
    tokenUrl:      'https://api.hubapi.com/oauth/v1/token',
    scope:         'crm.objects.contacts.read settings.users.read oauth',
    clientIdEnv:   'HUBSPOT_CLIENT_ID',
    clientSecretEnv: 'HUBSPOT_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },

  // ── Gusto ───────────────────────────────────────────────────────────────────
  gusto: {
    authorizeUrl:  'https://app.gusto.com/oauth/authorize',
    tokenUrl:      'https://api.gusto.com/oauth/token',
    scope:         'public',
    clientIdEnv:   'GUSTO_CLIENT_ID',
    clientSecretEnv: 'GUSTO_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },

  // ── Salesforce ───────────────────────────────────────────────────────────────
  salesforce: {
    authorizeUrl:  'https://login.salesforce.com/services/oauth2/authorize',
    tokenUrl:      'https://login.salesforce.com/services/oauth2/token',
    scope:         'api refresh_token',
    clientIdEnv:   'SALESFORCE_CLIENT_ID',
    clientSecretEnv: 'SALESFORCE_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
      instanceUrl:  t['instance_url'],
    }),
  },

  // ── Notion ──────────────────────────────────────────────────────────────────
  notion: {
    authorizeUrl:  'https://api.notion.com/v1/oauth/authorize',
    tokenUrl:      'https://api.notion.com/v1/oauth/token',
    scope:         '',
    clientIdEnv:   'NOTION_CLIENT_ID',
    clientSecretEnv: 'NOTION_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken: t['access_token'],
      workspaceId: (t['workspace_id'] as string),
    }),
  },

  // ── Asana ───────────────────────────────────────────────────────────────────
  asana: {
    authorizeUrl:  'https://app.asana.com/-/oauth_authorize',
    tokenUrl:      'https://app.asana.com/-/oauth_token',
    scope:         'default',
    clientIdEnv:   'ASANA_CLIENT_ID',
    clientSecretEnv: 'ASANA_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },

  // ── ClickUp ──────────────────────────────────────────────────────────────────
  clickup: {
    authorizeUrl:  'https://app.clickup.com/api',
    tokenUrl:      'https://api.clickup.com/api/v2/oauth/token',
    scope:         '',
    clientIdEnv:   'CLICKUP_CLIENT_ID',
    clientSecretEnv: 'CLICKUP_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken: t['access_token'],
    }),
  },

  // ── Sentry ──────────────────────────────────────────────────────────────────
  sentry: {
    authorizeUrl:  'https://sentry.io/oauth/authorize/',
    tokenUrl:      'https://sentry.io/oauth/token/',
    scope:         'project:read org:read event:read',
    clientIdEnv:   'SENTRY_CLIENT_ID',
    clientSecretEnv: 'SENTRY_CLIENT_SECRET',
    extractCredentials: (t) => ({
      accessToken:  t['access_token'],
      refreshToken: t['refresh_token'],
    }),
  },
};

// ─── Controller ───────────────────────────────────────────────────────────────

@Controller('integrations/oauth')
export class UnifiedOAuthController {
  private readonly logger = new Logger(UnifiedOAuthController.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly secretManager: SecretManagerService,
  ) {}

  // ── Step 1: Initiate ─────────────────────────────────────────────────────────

  @Get(':provider')
  async initiateOAuth(
    @Param('provider') provider: string,
    @Query('token')    token:    string,
    @Res()             res:      Response,
  ) {
    if (!token) throw new BadRequestException('Missing token query parameter');

    const config = OAUTH_CONFIGS[provider];
    if (!config) throw new BadRequestException(`OAuth not supported for provider: ${provider}`);

    // Verify JWT
    let user: JwtPayload;
    try {
      const secret = process.env['JWT_ACCESS_SECRET'] ?? '';
      user = jwt.verify(token, secret) as JwtPayload;
      if ((user as any)['type'] !== 'access') throw new Error('Wrong token type');
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const clientId = process.env[config.clientIdEnv];
    if (!clientId) {
      throw new BadRequestException(`OAuth not configured for ${provider} (missing ${config.clientIdEnv})`);
    }

    const state     = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS);

    await this.prisma.oAuthState.create({
      data: { state, orgId: user.orgId, userId: user.sub, provider, expiresAt },
    });

    const apiBase = process.env['API_BASE_URL'] ?? 'http://localhost:3001';
    const redirectUri = `${apiBase}/api/v1/integrations/oauth/${provider}/callback`;

    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      state,
      ...(config.scope ? { scope: config.scope } : {}),
      ...(config.extraAuthParams ?? {}),
    });

    return res.redirect(`${config.authorizeUrl}?${params.toString()}`);
  }

  // ── Step 2: Callback ─────────────────────────────────────────────────────────

  @Get(':provider/callback')
  async handleCallback(
    @Param('provider') provider: string,
    @Query('code')     code:     string,
    @Query('state')    state:    string,
    @Query('error')    error:    string,
    @Res()             res:      Response,
  ) {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

    if (error) {
      this.logger.warn(`OAuth error from ${provider}: ${error}`);
      return res.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return res.redirect(`${frontendUrl}/integrations?error=missing_params`);
    }

    const config = OAUTH_CONFIGS[provider];
    if (!config) {
      return res.redirect(`${frontendUrl}/integrations?error=unknown_provider`);
    }

    // Validate CSRF state
    const oauthState = await this.prisma.oAuthState.findUnique({ where: { state } });
    if (!oauthState) {
      this.logger.warn(`Unknown OAuth state for ${provider}: ${state}`);
      return res.redirect(`${frontendUrl}/integrations?error=invalid_state`);
    }

    await this.prisma.oAuthState.delete({ where: { state } });

    if (oauthState.expiresAt < new Date()) {
      return res.redirect(`${frontendUrl}/integrations?error=state_expired`);
    }

    const { orgId } = oauthState;
    const clientId     = process.env[config.clientIdEnv]     ?? '';
    const clientSecret = process.env[config.clientSecretEnv] ?? '';

    const apiBase    = process.env['API_BASE_URL'] ?? 'http://localhost:3001';
    const redirectUri = `${apiBase}/api/v1/integrations/oauth/${provider}/callback`;

    // Exchange code for access token
    let tokenData: Record<string, unknown>;
    try {
      const body = new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      });

      const tokenRes = await fetch(config.tokenUrl, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept:          'application/json',
          'User-Agent':    'AI-Compliance-Copilot',
          // Some providers require Basic auth for token exchange
          Authorization:   `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: body.toString(),
      });

      tokenData = await tokenRes.json() as Record<string, unknown>;

      if (!tokenRes.ok || tokenData['error']) {
        this.logger.error(`${provider} token exchange failed:`, tokenData);
        return res.redirect(`${frontendUrl}/integrations?error=token_exchange_failed`);
      }
    } catch (e: any) {
      this.logger.error(`${provider} token fetch error: ${e.message}`);
      return res.redirect(`${frontendUrl}/integrations?error=token_fetch_failed`);
    }

    // Fetch additional metadata (org info, workspace ID, etc.)
    let metadata: Record<string, unknown> = {};
    if (config.fetchMetadata) {
      metadata = await config.fetchMetadata(tokenData).catch(() => ({}));
    }

    // Extract credentials using provider-specific extractor or fall back
    const extractedCreds = config.extractCredentials
      ? config.extractCredentials(tokenData, metadata)
      : { accessToken: tokenData['access_token'], refreshToken: tokenData['refresh_token'] };

    const credentials = await this.secretManager.encrypt({ ...extractedCreds, ...metadata });

    await this.prisma.integration.upsert({
      where:  { orgId_provider: { orgId, provider: provider as any } },
      create: {
        orgId,
        provider:    provider as any,
        status:      'connected',
        credentials: credentials as any,
        settings:    { connectedVia: 'oauth', ...metadata },
      },
      update: {
        status:      'connected',
        credentials: credentials as any,
        settings:    { connectedVia: 'oauth', ...metadata },
        lastSyncedAt: null,
      },
    });

    this.logger.log(`OAuth connected: ${provider} for org ${orgId}`);
    return res.redirect(`${frontendUrl}/integrations?connected=${encodeURIComponent(provider)}`);
  }
}
