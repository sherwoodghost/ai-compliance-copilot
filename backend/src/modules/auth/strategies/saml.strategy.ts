/**
 * @deprecated NOT REGISTERED — not imported by auth.module.ts.
 *
 * SAML validation is handled directly in SsoController.callback() using
 * the underlying @node-saml/node-saml SAML class, which allows per-org
 * dynamic config without the Passport Strategy startup crash caused by
 * an empty `cert` value in a shared strategy constructor.
 *
 * This file is kept for reference only. Delete if P24 cleanup sprint is scheduled.
 */

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as PassportSamlStrategy, Profile } from '@node-saml/passport-saml';
import { PrismaService } from '../../../database/prisma.service';
import { AuthService } from '../auth.service';

/**
 * SamlStrategy — REFERENCE ONLY (not registered in auth.module.ts)
 *
 * Passport strategy for SAML 2.0 SSO authentication.
 *
 * Flow:
 *  1. User visits GET /auth/sso/:orgSlug  → redirected to IdP
 *  2. IdP posts SAML assertion to POST /auth/sso/:orgSlug/callback
 *  3. Strategy validates assertion, extracts email, finds or creates User
 *  4. Returns user + issues JWT (same as local login)
 *
 * Configuration is loaded per-org from the `sso_configs` table.
 * Each org has its own SAML SP/IdP config keyed by org slug.
 */
@Injectable()
export class SamlStrategy extends PassportStrategy(PassportSamlStrategy, 'saml') {
  private readonly logger = new Logger(SamlStrategy.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly auth:    AuthService,
  ) {
    // Initialize with placeholder config — actual per-org config loaded in validate()
    super({
      callbackUrl:  process.env['APP_URL']
        ? `${process.env['APP_URL']}/api/v1/auth/sso/callback`
        : 'http://localhost:3001/api/v1/auth/sso/callback',
      entryPoint:   '',                   // overridden per-org in getStrategyOptions
      issuer:       '',                   // overridden per-org
      cert:         '',                   // overridden per-org
      wantAssertionsSigned: false,
      passReqToCallback: true,
    });
  }

  /**
   * Called by Passport after SAML assertion is validated.
   * Maps SAML attributes → finds/creates User → returns user.
   */
  async validate(req: any, profile: Profile): Promise<any> {
    const orgSlug = req.params?.orgSlug ?? req.query?.orgSlug ?? req.state?.orgSlug;

    const config = await this.prisma.ssoConfig.findFirst({
      where: { organization: { slug: orgSlug } },
      include: { organization: { select: { id: true, slug: true, name: true } } },
    });

    if (!config || !config.isVerified) {
      throw new UnauthorizedException('SSO not configured or not verified for this organization');
    }

    const orgId = config.organization.id;

    // Extract email from SAML profile
    const emailAttr = config.emailAttribute ?? 'email';
    const email = (profile as any)[emailAttr]
      ?? profile.nameID
      ?? profile.mail
      ?? (profile.attributes as any)?.[emailAttr];

    if (!email) {
      throw new UnauthorizedException('SAML assertion missing email attribute');
    }

    // Extract name
    const firstName = (profile as any)[config.firstNameAttribute ?? 'firstName']
      ?? (profile.attributes as any)?.[config.firstNameAttribute ?? 'firstName']
      ?? '';
    const lastName  = (profile as any)[config.lastNameAttribute  ?? 'lastName']
      ?? (profile.attributes as any)?.[config.lastNameAttribute  ?? 'lastName']
      ?? '';
    const fullName  = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

    // Find or create user for this org
    let user = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), orgId },
    });

    if (!user) {
      // JIT (Just-In-Time) provisioning — create user on first SSO login
      this.logger.log(`JIT provisioning SSO user ${email} for org ${config.organization.slug}`);
      user = await this.prisma.user.create({
        data: {
          orgId,
          email:        email.toLowerCase(),
          fullName,
          passwordHash: '',              // SSO users have no password
          role:         'member',
          platformRole: 'contributor',
          status:       'active',
        },
      });
    } else if ((user as any).status === 'suspended') {
      throw new UnauthorizedException('User account is suspended');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    });

    return user;
  }
}
