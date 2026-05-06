/**
 * FILE 5: ControlApplicabilityEngine Tests
 * Tests the deterministic applicability rules without hitting a real DB.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ControlApplicabilityEngine, BusinessProfileSnapshot } from './applicability-engine.service';
import { PrismaService } from '../database/prisma.service';
import { ControlLibraryService } from './control-library.service';

// ─── Mock factory helpers ─────────────────────────────────────────────────────

function makeSoc2Controls(codes: string[]) {
  return codes.map((code, idx) => ({
    id: `ctrl-${idx}`,
    code,
    title: `Control ${code}`,
    description: `Description for ${code}`,
  }));
}

function makeIsoControls(codes: string[]) {
  return codes.map((code, idx) => ({
    id: `iso-ctrl-${idx}`,
    code,
    title: `ISO Control ${code}`,
    description: `ISO Description for ${code}`,
  }));
}

// Sample CC controls (SOC 2 Security — always applicable)
const CC_CONTROLS = makeSoc2Controls([
  'CC1.1', 'CC1.2',
  'CC2.1', 'CC3.1',
  'CC4.1', 'CC5.1',
  'CC6.1', 'CC6.2', 'CC6.3',
  'CC7.1', 'CC8.1', 'CC9.1',
]);

// Availability controls
const A1_CONTROLS = makeSoc2Controls(['A1.1', 'A1.2', 'A1.3']);

// Confidentiality controls
const C1_CONTROLS = makeSoc2Controls(['C1.1', 'C1.2']);

// Privacy controls
const PRIVACY_CONTROLS = makeSoc2Controls([
  'P1.1', 'P2.1', 'P3.1', 'P4.1', 'P5.1', 'P6.1', 'P7.1', 'P8.1',
]);

const ALL_SOC2_CONTROLS = [...CC_CONTROLS, ...A1_CONTROLS, ...C1_CONTROLS, ...PRIVACY_CONTROLS];

// ISO controls
const ISO_CONTROLS = makeIsoControls([
  'A.5.1', 'A.5.2', 'A.5.34',
  'A.6.1', 'A.6.3',
  'A.7.1', 'A.7.2', 'A.7.3', // physical controls
  'A.8.1', 'A.8.2',
]);

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  controlApplicability: {
    upsert: jest.fn().mockResolvedValue({}),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
  },
  organizationControl: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockLibrary = {
  getControlsByFramework: jest.fn(),
  validateControlIds: jest.fn(() => ({ valid: [], invalid: [] })),
  getControlId: jest.fn(),
  getFrameworkCodes: jest.fn(),
};

// ─── Base profiles ────────────────────────────────────────────────────────────

function soc2OnlyProfile(overrides: Partial<BusinessProfileSnapshot> = {}): BusinessProfileSnapshot {
  return {
    frameworks: ['soc2'],
    soc2TrustServiceCategories: ['security'],
    industry: 'SaaS',
    dataTypes: [],
    cloudProviders: ['aws'],
    hasPhysicalOffice: false,
    ...overrides,
  };
}

function isoOnlyProfile(overrides: Partial<BusinessProfileSnapshot> = {}): BusinessProfileSnapshot {
  return {
    frameworks: ['iso27001'],
    industry: 'SaaS',
    dataTypes: [],
    cloudProviders: ['aws'],
    hasPhysicalOffice: false,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ControlApplicabilityEngine', () => {
  let engine: ControlApplicabilityEngine;

  beforeEach(async () => {
    mockLibrary.getControlsByFramework.mockReset();
    mockPrisma.controlApplicability.upsert.mockReset();
    mockPrisma.organizationControl.findUnique.mockReset();
    mockPrisma.organizationControl.create.mockReset();

    mockPrisma.controlApplicability.upsert.mockResolvedValue({});
    mockPrisma.organizationControl.findUnique.mockResolvedValue(null);
    mockPrisma.organizationControl.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ControlApplicabilityEngine,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ControlLibraryService, useValue: mockLibrary },
      ],
    }).compile();

    engine = module.get<ControlApplicabilityEngine>(ControlApplicabilityEngine);
  });

  // ─── SOC 2 CC Controls: always applicable ───────────────────────────────

  it('CC1-CC9 controls are always applicable when SOC 2 is selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(CC_CONTROLS);

    const profile = soc2OnlyProfile({ soc2TrustServiceCategories: ['security'] });
    const results = await engine.runForOrg('org-1', profile, 1);

    const ccResults = results.filter((r) => r.controlCode.startsWith('CC'));
    expect(ccResults.length).toBeGreaterThan(0);
    ccResults.forEach((r) => {
      expect(r.applicable).toBe(true);
      expect(r.applicabilityStatus).toBe('applicable');
    });
  });

  it('CC controls have high confidence and require no human review', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(CC_CONTROLS);

    const profile = soc2OnlyProfile();
    const results = await engine.runForOrg('org-2', profile, 1);

    results.forEach((r) => {
      expect(r.confidence).toBe('high');
      expect(r.requiresHumanReview).toBe(false);
    });
  });

  // ─── Availability controls: only applicable when availability TSC selected ─

  it('A1 controls are applicable when availability TSC is selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...A1_CONTROLS]);

    const profile = soc2OnlyProfile({
      soc2TrustServiceCategories: ['security', 'availability'],
    });
    const results = await engine.runForOrg('org-3', profile, 1);

    const a1Results = results.filter((r) => r.controlCode.startsWith('A1'));
    expect(a1Results.length).toBeGreaterThan(0);
    a1Results.forEach((r) => {
      expect(r.applicable).toBe(true);
      expect(r.applicabilityStatus).toBe('applicable');
    });
  });

  it('A1 controls are NOT applicable when availability TSC is not selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...A1_CONTROLS]);

    const profile = soc2OnlyProfile({ soc2TrustServiceCategories: ['security'] });
    const results = await engine.runForOrg('org-4', profile, 1);

    const a1Results = results.filter((r) => r.controlCode.startsWith('A1'));
    expect(a1Results.length).toBeGreaterThan(0);
    a1Results.forEach((r) => {
      expect(r.applicable).toBe(false);
      expect(r.applicabilityStatus).toBe('not_applicable');
    });
  });

  // ─── Privacy controls: applicable when org handles PII ───────────────────

  it('Privacy controls are applicable when org handles PII', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...PRIVACY_CONTROLS]);

    const profile = soc2OnlyProfile({
      soc2TrustServiceCategories: ['security'],
      dataTypes: ['pii'],
    });
    const results = await engine.runForOrg('org-5', profile, 1);

    const privacyResults = results.filter((r) => r.controlCode.startsWith('P'));
    expect(privacyResults.length).toBeGreaterThan(0);
    privacyResults.forEach((r) => {
      expect(r.applicable).toBe(true);
    });
  });

  it('Privacy controls are NOT applicable when no PII or privacy TSC selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...PRIVACY_CONTROLS]);

    const profile = soc2OnlyProfile({
      soc2TrustServiceCategories: ['security'],
      dataTypes: [],
      operatesIn: [],
    });
    const results = await engine.runForOrg('org-6', profile, 1);

    const privacyResults = results.filter((r) => r.controlCode.startsWith('P'));
    expect(privacyResults.length).toBeGreaterThan(0);
    privacyResults.forEach((r) => {
      expect(r.applicable).toBe(false);
      expect(r.applicabilityStatus).toBe('not_applicable');
    });
  });

  // ─── Confidentiality controls ─────────────────────────────────────────────

  it('C1 controls are applicable when confidentiality TSC is selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...C1_CONTROLS]);

    const profile = soc2OnlyProfile({
      soc2TrustServiceCategories: ['security', 'confidentiality'],
    });
    const results = await engine.runForOrg('org-7', profile, 1);

    const c1Results = results.filter((r) => r.controlCode.startsWith('C1'));
    expect(c1Results.length).toBeGreaterThan(0);
    c1Results.forEach((r) => {
      expect(r.applicable).toBe(true);
      expect(r.applicabilityStatus).toBe('applicable');
    });
  });

  it('C1 controls are NOT applicable when confidentiality TSC is not selected', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue([...CC_CONTROLS, ...C1_CONTROLS]);

    const profile = soc2OnlyProfile({ soc2TrustServiceCategories: ['security'] });
    const results = await engine.runForOrg('org-8', profile, 1);

    const c1Results = results.filter((r) => r.controlCode.startsWith('C1'));
    expect(c1Results.length).toBeGreaterThan(0);
    c1Results.forEach((r) => {
      expect(r.applicable).toBe(false);
    });
  });

  // ─── Determinism ─────────────────────────────────────────────────────────

  it('is deterministic: same input returns same result twice', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(ALL_SOC2_CONTROLS);

    const profile = soc2OnlyProfile({
      soc2TrustServiceCategories: ['security', 'availability', 'privacy'],
      dataTypes: ['pii'],
    });

    const results1 = await engine.runForOrg('org-det', profile, 1);
    const results2 = await engine.runForOrg('org-det', profile, 1);

    expect(results1.length).toBe(results2.length);
    results1.forEach((r, idx) => {
      expect(r.applicable).toBe(results2[idx].applicable);
      expect(r.applicabilityStatus).toBe(results2[idx].applicabilityStatus);
      expect(r.controlCode).toBe(results2[idx].controlCode);
    });
  });

  // ─── Engine never invents control IDs ────────────────────────────────────

  it('engine never invents control IDs — output IDs come from library controls', async () => {
    const seededControls = makeSoc2Controls(['CC1.1', 'CC2.1', 'CC6.3']);
    mockLibrary.getControlsByFramework.mockResolvedValue(seededControls);

    const profile = soc2OnlyProfile();
    const results = await engine.runForOrg('org-inv', profile, 1);

    const seededIds = new Set(seededControls.map((c) => c.id));
    results.forEach((r) => {
      expect(seededIds.has(r.controlId)).toBe(true);
    });
  });

  // ─── ISO 27001: physical controls ────────────────────────────────────────

  it('ISO A.7 physical controls get needs_review for cloud-only orgs', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(ISO_CONTROLS);

    const profile = isoOnlyProfile({
      cloudProviders: ['aws'],
      hasPhysicalOffice: false,
    });
    const results = await engine.runForOrg('org-iso-1', profile, 1);

    const physicalResults = results.filter((r) =>
      ['A.7.1', 'A.7.2', 'A.7.3'].includes(r.controlCode),
    );
    expect(physicalResults.length).toBeGreaterThan(0);
    physicalResults.forEach((r) => {
      expect(r.applicabilityStatus).toBe('needs_review');
      expect(r.requiresHumanReview).toBe(true);
    });
  });

  it('ISO A.5.34 is applicable when org handles PII', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(ISO_CONTROLS);

    const profile = isoOnlyProfile({ dataTypes: ['pii'] });
    const results = await engine.runForOrg('org-iso-2', profile, 1);

    const piiControl = results.find((r) => r.controlCode === 'A.5.34');
    expect(piiControl).toBeDefined();
    expect(piiControl!.applicable).toBe(true);
    expect(piiControl!.applicabilityStatus).toBe('applicable');
  });

  it('ISO A.5.34 is not applicable when org does not handle PII', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(ISO_CONTROLS);

    const profile = isoOnlyProfile({ dataTypes: [] });
    const results = await engine.runForOrg('org-iso-3', profile, 1);

    const piiControl = results.find((r) => r.controlCode === 'A.5.34');
    expect(piiControl).toBeDefined();
    expect(piiControl!.applicable).toBe(false);
    expect(piiControl!.applicabilityStatus).toBe('not_applicable');
  });

  it('ISO controls return applicable/not_applicable/needs_review status only', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(ISO_CONTROLS);

    const profile = isoOnlyProfile({
      cloudProviders: ['aws'],
      hasPhysicalOffice: false,
      dataTypes: ['pii'],
    });
    const results = await engine.runForOrg('org-iso-4', profile, 1);

    const validStatuses = new Set(['applicable', 'not_applicable', 'needs_review']);
    results.forEach((r) => {
      expect(validStatuses.has(r.applicabilityStatus)).toBe(true);
    });
  });

  // ─── Persistence calls ────────────────────────────────────────────────────

  it('persists results to controlApplicability table', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(CC_CONTROLS);

    await engine.runForOrg('org-persist', soc2OnlyProfile(), 1);

    expect(mockPrisma.controlApplicability.upsert).toHaveBeenCalled();
  });

  it('creates organizationControl rows for applicable controls', async () => {
    mockLibrary.getControlsByFramework.mockResolvedValue(CC_CONTROLS);

    await engine.runForOrg('org-oc', soc2OnlyProfile(), 1);

    // All CC controls are applicable, so organizationControl.create should be called
    expect(mockPrisma.organizationControl.create).toHaveBeenCalled();
  });
});
