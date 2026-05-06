/**
 * Integration Suggestions + SecretManager Tests
 *
 * IS01–IS05: IntegrationSuggestionsService deterministic logic
 * SM01–SM05: SecretManagerService encryption/decryption
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationSuggestionsService } from './integration-suggestions.service';
import { SecretManagerService } from './secret-manager.service';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { InferenceOutput } from '../inference/inference.types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeInferenceOutput(overrides: Partial<InferenceOutput> = {}): InferenceOutput {
  return {
    organization_id: 'org-001',
    onboarding_version: 1,
    risk_level: 'MEDIUM',
    risk_score: 5,
    risk_drivers: [],
    inferred_frameworks: [
      { framework: 'SOC2', applicability: 'REQUIRED', reason: 'Selected', triggered_by_rule_id: 'R-005' },
    ],
    data_classification: 'CONFIDENTIAL',
    required_controls: [],
    expected_integrations: [
      { provider: 'okta', category: 'identity', triggered_by: 'R-007' },
    ],
    system_flags: {
      requires_encryption: true,
      requires_mfa: true,
      requires_logging: true,
      requires_dpa: false,
      requires_vendor_review: false,
      requires_incident_response_plan: false,
    },
    computed_at: new Date().toISOString(),
    engine_version: '1.0.0',
    ...overrides,
  };
}

// ── SecretManager Tests ───────────────────────────────────────────────────────

describe('SecretManagerService', () => {
  let service: SecretManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretManagerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => key === 'LOCAL_SECRET_ENCRYPTION_KEY' ? 'test-key-32-chars-for-unit-tests!' : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(SecretManagerService);
  });

  it('SM01 — encrypts credentials and produces a non-plaintext string', () => {
    const creds = { apiKey: 'secret-token-abc', orgSlug: 'acme' };
    const encrypted = service.encrypt(creds);

    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toContain('secret-token-abc');
    expect(encrypted).not.toContain('apiKey');
  });

  it('SM02 — round-trip: encrypt then decrypt returns original', () => {
    const original = { apiKey: 'my-github-token', orgId: 'acme-corp', scopes: ['repo', 'org'] };
    const encrypted = service.encrypt(original);
    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toEqual(original);
  });

  it('SM03 — two encryptions of same input produce different ciphertexts (random IV)', () => {
    const creds = { token: 'abc123' };
    const enc1 = service.encrypt(creds);
    const enc2 = service.encrypt(creds);

    // Same plaintext, different IV → different ciphertext
    expect(enc1).not.toBe(enc2);
    // But both decrypt to the same value
    expect(service.decrypt(enc1)).toEqual(service.decrypt(enc2));
  });

  it('SM04 — tampered ciphertext throws on decrypt', () => {
    const creds = { token: 'abc123' };
    const encrypted = service.encrypt(creds);

    // Flip some bytes at the end of the base64 string
    const tampered = encrypted.slice(0, -4) + 'XXXX';
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('SM05 — isEncrypted returns true for encrypted, false for plain object', () => {
    const creds = { token: 'abc' };
    const encrypted = service.encrypt(creds);

    expect(service.isEncrypted(encrypted)).toBe(true);
    expect(service.isEncrypted({ token: 'abc' })).toBe(false);
    expect(service.isEncrypted('plain-string')).toBe(false);
    expect(service.isEncrypted(null)).toBe(false);
  });
});

// ── IntegrationSuggestions Tests ─────────────────────────────────────────────

describe('IntegrationSuggestionsService', () => {
  let service: IntegrationSuggestionsService;
  let prismaMock: { integrationSuggestion: { upsert: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock } };

  beforeEach(async () => {
    prismaMock = {
      integrationSuggestion: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationSuggestionsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(IntegrationSuggestionsService);
  });

  it('IS01 — buildSuggestions includes expected_integrations from inference', () => {
    const inference = makeInferenceOutput();
    const suggestions = service.buildSuggestions(inference);

    const okta = suggestions.find((s) => s.provider === 'okta');
    expect(okta).toBeDefined();
    expect(okta!.category).toBe('identity');
    expect(okta!.automatesControls).toContain('CC6.1');
  });

  it('IS02 — requires_mfa=true adds Okta if not already present', () => {
    const inference = makeInferenceOutput({
      expected_integrations: [], // no expected integrations
      system_flags: {
        requires_mfa: true,
        requires_encryption: false,
        requires_logging: false,
        requires_dpa: false,
        requires_vendor_review: false,
        requires_incident_response_plan: false,
      },
    });

    const suggestions = service.buildSuggestions(inference);
    const okta = suggestions.find((s) => s.provider === 'okta');
    expect(okta).toBeDefined();
    expect(okta!.relevanceScore).toBe(95);
  });

  it('IS03 — SOC2 selected adds GitHub (change management evidence)', () => {
    const inference = makeInferenceOutput({ expected_integrations: [] });
    const suggestions = service.buildSuggestions(inference);

    const github = suggestions.find((s) => s.provider === 'github');
    expect(github).toBeDefined();
    expect(github!.automatesControls).toContain('CC8.1');
  });

  it('IS04 — suggestions are sorted by relevanceScore descending', () => {
    const inference = makeInferenceOutput();
    const suggestions = service.buildSuggestions(inference);

    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].relevanceScore).toBeGreaterThanOrEqual(suggestions[i].relevanceScore);
    }
  });

  it('IS05 — no duplicate providers in suggestions', () => {
    const inference = makeInferenceOutput();
    const suggestions = service.buildSuggestions(inference);
    const providers = suggestions.map((s) => s.provider);
    const uniqueProviders = new Set(providers);

    expect(providers.length).toBe(uniqueProviders.size);
  });

  it('IS06 — persistSuggestions calls upsert for each suggestion', async () => {
    const inference = makeInferenceOutput();
    const suggestions = service.buildSuggestions(inference);
    await service.persistSuggestions('org-001', suggestions);

    expect(prismaMock.integrationSuggestion.upsert).toHaveBeenCalledTimes(suggestions.length);
  });
});
