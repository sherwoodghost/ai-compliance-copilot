import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from './auth.service';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SsoConfigDto {
  provider?:           string;
  idpEntityId?:        string;
  idpSsoUrl?:          string;
  idpCertificate?:     string;
  emailAttribute?:     string;
  firstNameAttribute?: string;
  lastNameAttribute?:  string;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SsoService {
  private readonly logger = new Logger(SsoService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
    private readonly auth:    AuthService,
  ) {}

  /** Get or create SSO config for an org */
  async getConfig(orgId: string) {
    const config = await this.prisma.ssoConfig.findUnique({
      where:   { orgId },
      include: { organization: { select: { id: true, slug: true, name: true, ssoEnabled: true } } },
    });
    if (!config) throw new NotFoundException('SSO not configured for this organization');
    // Never return the IdP certificate in API responses (too large + sensitive)
    return {
      ...config,
      idpCertificate: config.idpCertificate ? '[configured]' : null,
    };
  }

  /** Upsert SSO config */
  async upsertConfig(orgId: string, dto: SsoConfigDto) {
    const appUrl  = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:3001';
    const apiBase = this.config.get<string>('app.apiBase')     ?? 'http://localhost:3001/api/v1';

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, slug: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const spEntityId = `${apiBase}/auth/sso/${org.slug}/metadata`;
    const acsUrl     = `${apiBase}/auth/sso/${org.slug}/callback`;

    const config = await this.prisma.ssoConfig.upsert({
      where:  { orgId },
      create: {
        orgId,
        provider:           dto.provider           ?? 'saml',
        idpEntityId:        dto.idpEntityId,
        idpSsoUrl:          dto.idpSsoUrl,
        idpCertificate:     dto.idpCertificate,
        emailAttribute:     dto.emailAttribute      ?? 'email',
        firstNameAttribute: dto.firstNameAttribute  ?? 'firstName',
        lastNameAttribute:  dto.lastNameAttribute   ?? 'lastName',
        spEntityId,
        acsUrl,
        isVerified:         false,
      },
      update: {
        ...(dto.provider           && { provider:           dto.provider }),
        ...(dto.idpEntityId        && { idpEntityId:        dto.idpEntityId }),
        ...(dto.idpSsoUrl          && { idpSsoUrl:          dto.idpSsoUrl }),
        ...(dto.idpCertificate     && { idpCertificate:     dto.idpCertificate }),
        ...(dto.emailAttribute     && { emailAttribute:     dto.emailAttribute }),
        ...(dto.firstNameAttribute && { firstNameAttribute: dto.firstNameAttribute }),
        ...(dto.lastNameAttribute  && { lastNameAttribute:  dto.lastNameAttribute }),
        spEntityId,
        acsUrl,
        isVerified: false,  // reset verification on config change
      },
    });

    return { ...config, idpCertificate: config.idpCertificate ? '[configured]' : null };
  }

  /** Generate SP metadata XML for the IdP to consume */
  generateMetadataXml(orgSlug: string, config: { spEntityId?: string | null; acsUrl?: string | null }): string {
    const spEntityId = config.spEntityId ?? `https://app.aicompliance.io/sso/${orgSlug}`;
    const acsUrl     = config.acsUrl     ?? `https://app.aicompliance.io/api/v1/auth/sso/${orgSlug}/callback`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${spEntityId}">
  <md:SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="1"/>
    <md:NameIDFormat>
      urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress
    </md:NameIDFormat>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /** Test SSO configuration — verify the IdP URL is reachable */
  async testConfig(orgId: string): Promise<{ ok: boolean; error?: string }> {
    const config = await this.prisma.ssoConfig.findUnique({ where: { orgId } });
    if (!config?.idpSsoUrl) return { ok: false, error: 'IdP SSO URL not configured' };
    if (!config.idpCertificate) return { ok: false, error: 'IdP certificate not configured' };

    try {
      const res = await fetch(config.idpSsoUrl, { method: 'HEAD' }).catch(() =>
        fetch(config.idpSsoUrl!, { method: 'GET' })
      );
      const ok = res.status < 500;

      if (ok) {
        await this.prisma.ssoConfig.update({
          where: { orgId },
          data:  { isVerified: true, lastTestedAt: new Date() },
        });
        await this.prisma.organization.update({
          where: { id: orgId },
          data:  { ssoEnabled: true },
        });
      }

      return { ok, error: ok ? undefined : `IdP returned HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /** Issue JWT tokens for a user who authenticated via SAML */
  async issueSsoTokens(user: any): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    const jwtSecret  = this.config.get<string>('jwt.secret') ?? 'dev-secret';
    const expiresIn  = this.config.get<string>('jwt.expiresIn') ?? '15m';

    const payload = {
      sub:    user.id,
      userId: user.id,
      orgId:  user.orgId,
      role:   user.role,
      email:  user.email,
    };

    const accessToken  = jwt.sign(payload, jwtSecret, { expiresIn });
    const refreshToken = jwt.sign({ sub: user.id, type: 'refresh' }, jwtSecret, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: {
        id:       user.id,
        email:    user.email,
        fullName: user.fullName,
        role:     user.role,
        orgId:    user.orgId,
      },
    };
  }

  /** Enable/disable SSO for an org */
  async toggleSso(orgId: string, enabled: boolean) {
    if (enabled) {
      // Verify config exists and is valid before enabling
      const config = await this.prisma.ssoConfig.findUnique({ where: { orgId } });
      if (!config?.idpSsoUrl || !config.idpCertificate) {
        throw new BadRequestException('Complete SSO configuration before enabling');
      }
    }
    return this.prisma.organization.update({
      where: { id: orgId },
      data:  { ssoEnabled: enabled },
      select: { id: true, ssoEnabled: true },
    });
  }
}
