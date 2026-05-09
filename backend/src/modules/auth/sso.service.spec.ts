/**
 * SSO Service Unit Tests (P23)
 *
 * Covers:
 * - getConfig: returns config; masks certificate; throws 404 if not found
 * - upsertConfig: creates/updates SSO config with computed SP metadata URLs
 * - generateMetadataXml: returns valid XML with ACS URL and entity ID
 * - testConfig: marks config verified on reachable IdP; returns error on unreachable
 * - issueSsoTokens: returns signed JWT access + refresh tokens
 * - toggleSso: enables/disables SSO; rejects incomplete config
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SsoService, SsoConfigDto } from './sso.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID   = 'org-test-001';
const ORG_SLUG = 'acme';

const BASE_CONFIG = {
  id:                 'sso-cfg-001',
  orgId:              ORG_ID,
  provider:           'saml',
  idpEntityId:        'https://idp.example.com/issuer',
  idpSsoUrl:          'https://idp.example.com/sso/saml',
  idpCertificate:     '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
  emailAttribute:     'email',
  firstNameAttribute: 'firstName',
  lastNameAttribute:  'lastName',
  spEntityId:         'https://app.example.com/api/v1/auth/sso/acme/metadata',
  acsUrl:             'https://app.example.com/api/v1/auth/sso/acme/callback',
  isVerified:         true,
  lastTestedAt:       new Date('2026-05-01'),
  organization:       { id: ORG_ID, slug: ORG_SLUG, name: 'Acme Corp', ssoEnabled: true },
};

const USER = {
  id:       'user-001',
  email:    'alice@acme.com',
  fullName: 'Alice Smith',
  role:     'member',
  orgId:    ORG_ID,
};

// ── Mock factory ──────────────────────────────────────────────────────────────

function makePrisma(overrides?: Partial<{
  ssoConfig: Partial<typeof BASE_CONFIG> | null;
  org:       { id: string; slug: string } | null;
}>) {
  const cfg = overrides?.ssoConfig !== undefined
    ? overrides.ssoConfig
    : BASE_CONFIG;

  const org = overrides?.org !== undefined
    ? overrides.org
    : { id: ORG_ID, slug: ORG_SLUG };

  return {
    ssoConfig: {
      findUnique: jest.fn(async () => cfg),
      upsert:     jest.fn(async ({ create }: any) => ({ ...BASE_CONFIG, ...create })),
      update:     jest.fn(async ({ data }: any) => ({ ...BASE_CONFIG, ...data })),
    },
    organization: {
      findUnique: jest.fn(async () => org),
      update:     jest.fn(async ({ data }: any) => ({ id: ORG_ID, ssoEnabled: data.ssoEnabled })),
    },
  };
}

function makeConfig(overrides?: Record<string, string>) {
  const vals: Record<string, string> = {
    'app.frontendUrl': 'http://localhost:3000',
    'app.apiBase':     'http://localhost:3001/api/v1',
    'jwt.secret':      'test-secret-at-least-32-chars-long!!',
    'jwt.expiresIn':   '15m',
    ...overrides,
  };
  return { get: jest.fn((key: string) => vals[key] ?? null) };
}

function makeService(prismaOverrides?: Parameters<typeof makePrisma>[0]) {
  const prisma   = makePrisma(prismaOverrides);
  const config   = makeConfig();
  const auth     = {} as any;
  return { service: new SsoService(prisma as any, config as any, auth), prisma, config };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SsoService', () => {

  // ── getConfig ──────────────────────────────────────────────────────────────

  describe('getConfig', () => {
    it('returns config with certificate masked as [configured]', async () => {
      const { service } = makeService();
      const result = await service.getConfig(ORG_ID);
      expect(result.idpCertificate).toBe('[configured]');
      expect(result.idpSsoUrl).toBe(BASE_CONFIG.idpSsoUrl);
    });

    it('returns null certificate when not set', async () => {
      const { service } = makeService({
        ssoConfig: { ...BASE_CONFIG, idpCertificate: null as any },
      });
      const result = await service.getConfig(ORG_ID);
      expect(result.idpCertificate).toBeNull();
    });

    it('throws NotFoundException when SSO config does not exist', async () => {
      const { service } = makeService({ ssoConfig: null });
      await expect(service.getConfig(ORG_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── upsertConfig ──────────────────────────────────────────────────────────

  describe('upsertConfig', () => {
    it('sets computed spEntityId and acsUrl on create', async () => {
      const { service, prisma } = makeService();
      const dto: SsoConfigDto = {
        idpEntityId: 'https://idp.example.com/issuer',
        idpSsoUrl:   'https://idp.example.com/sso/saml',
      };
      await service.upsertConfig(ORG_ID, dto);

      const upsertCall = (prisma.ssoConfig.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.create.spEntityId).toContain('/auth/sso/');
      expect(upsertCall.create.spEntityId).toContain('/metadata');
      expect(upsertCall.create.acsUrl).toContain('/callback');
    });

    it('resets isVerified to false when config is updated', async () => {
      const { service, prisma } = makeService();
      await service.upsertConfig(ORG_ID, { idpSsoUrl: 'https://new-idp.example.com/sso' });

      const upsertCall = (prisma.ssoConfig.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.update.isVerified).toBe(false);
    });

    it('throws NotFoundException when org does not exist', async () => {
      const { service } = makeService({ org: null });
      await expect(service.upsertConfig(ORG_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('masks certificate in returned config', async () => {
      const { service } = makeService();
      const result = await service.upsertConfig(ORG_ID, { idpCertificate: '-----BEGIN CERT-----\nXXX\n-----END CERT-----' });
      expect(result.idpCertificate).toBe('[configured]');
    });
  });

  // ── generateMetadataXml ───────────────────────────────────────────────────

  describe('generateMetadataXml', () => {
    it('generates valid XML with EntityDescriptor', () => {
      const { service } = makeService();
      const xml = service.generateMetadataXml(ORG_SLUG, {
        spEntityId: 'https://app.example.com/sp',
        acsUrl:     'https://app.example.com/api/v1/auth/sso/acme/callback',
      });
      expect(xml).toContain('<?xml version="1.0"');
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain('https://app.example.com/sp');
      expect(xml).toContain('AssertionConsumerService');
      expect(xml).toContain('https://app.example.com/api/v1/auth/sso/acme/callback');
    });

    it('uses fallback URLs when config values are not provided', () => {
      const { service } = makeService();
      const xml = service.generateMetadataXml(ORG_SLUG, {});
      expect(xml).toContain('EntityDescriptor');
      expect(xml).toContain(ORG_SLUG);
    });
  });

  // ── testConfig ────────────────────────────────────────────────────────────

  describe('testConfig', () => {
    it('returns error when SSO config not found', async () => {
      const { service } = makeService({ ssoConfig: null });
      const result = await service.testConfig(ORG_ID);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('IdP SSO URL not configured');
    });

    it('returns error when idpSsoUrl is missing', async () => {
      const { service } = makeService({
        ssoConfig: { ...BASE_CONFIG, idpSsoUrl: null as any },
      });
      const result = await service.testConfig(ORG_ID);
      expect(result.ok).toBe(false);
    });

    it('returns error when certificate is missing', async () => {
      const { service } = makeService({
        ssoConfig: { ...BASE_CONFIG, idpCertificate: null as any },
      });
      const result = await service.testConfig(ORG_ID);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('certificate');
    });

    it('returns ok:false and error message on network failure', async () => {
      const { service } = makeService();
      // Mock global fetch to throw a network error
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const result = await service.testConfig(ORG_ID);
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('marks config verified and returns ok:true on reachable IdP', async () => {
      const { service, prisma } = makeService();
      global.fetch = jest.fn().mockResolvedValue({ status: 200 });
      const result = await service.testConfig(ORG_ID);
      expect(result.ok).toBe(true);
      expect(prisma.ssoConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orgId: ORG_ID },
          data:  expect.objectContaining({ isVerified: true }),
        }),
      );
    });
  });

  // ── issueSsoTokens ────────────────────────────────────────────────────────

  describe('issueSsoTokens', () => {
    it('returns accessToken and refreshToken', async () => {
      const { service } = makeService();
      const result = await service.issueSsoTokens(USER);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('includes user email and orgId in the returned user object', async () => {
      const { service } = makeService();
      const result = await service.issueSsoTokens(USER);
      expect(result.user.email).toBe(USER.email);
      expect(result.user.orgId).toBe(USER.orgId);
    });

    it('does not include passwordHash or sensitive fields in returned user', async () => {
      const { service } = makeService();
      const result = await service.issueSsoTokens({ ...USER, passwordHash: 'secret' });
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it('JWT payload contains sub matching user id', async () => {
      const { service } = makeService();
      const result = await service.issueSsoTokens(USER);
      // Decode without verifying (just parse the payload)
      const payloadB64 = result.accessToken.split('.')[1];
      const payload    = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      expect(payload.sub).toBe(USER.id);
      expect(payload.orgId).toBe(USER.orgId);
    });
  });

  // ── toggleSso ─────────────────────────────────────────────────────────────

  describe('toggleSso', () => {
    it('enables SSO when config is complete', async () => {
      const { service, prisma } = makeService();
      const result = await service.toggleSso(ORG_ID, true);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ssoEnabled: true },
        }),
      );
    });

    it('throws BadRequestException when enabling SSO with incomplete config', async () => {
      const { service } = makeService({
        ssoConfig: { ...BASE_CONFIG, idpSsoUrl: null as any },
      });
      await expect(service.toggleSso(ORG_ID, true)).rejects.toThrow(BadRequestException);
    });

    it('disables SSO without checking config completeness', async () => {
      const { service, prisma } = makeService({
        ssoConfig: { ...BASE_CONFIG, idpSsoUrl: null as any },
      });
      // Disabling should always work regardless of config state
      await service.toggleSso(ORG_ID, false);
      expect(prisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { ssoEnabled: false },
        }),
      );
    });
  });
});
