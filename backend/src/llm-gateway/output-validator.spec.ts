/**
 * FILE 3: OutputValidatorService Tests
 * Tests the forbidden language checker without hitting real LLM or DB.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutputValidatorService } from './output-validator.service';
import { ControlLibraryService } from '../control-library/control-library.service';

// ─── Mock ControlLibraryService ───────────────────────────────────────────────

const mockValidateControlIds = jest.fn(
  (_codes: string[]): { valid: string[]; invalid: string[] } => ({ valid: [], invalid: [] }),
);

const mockControlLibrary = {
  validateControlIds: mockValidateControlIds,
  getControlsByFramework: jest.fn(),
  getControlByCode: jest.fn(),
  getControlId: jest.fn(),
  getFrameworkCodes: jest.fn(),
};

describe('OutputValidatorService', () => {
  let service: OutputValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutputValidatorService,
        {
          provide: ControlLibraryService,
          useValue: mockControlLibrary,
        },
      ],
    }).compile();

    service = module.get<OutputValidatorService>(OutputValidatorService);
    jest.clearAllMocks();
  });

  // ─── Forbidden language detection ─────────────────────────────────────────

  it('flags "certified" in output as forbidden language', async () => {
    const result = await service.validate('Your organization is now certified for SOC 2.');
    expect(result.forbiddenLanguageDetected).toBe(true);
    expect(result.issues.some((i) => i.toLowerCase().includes('forbidden'))).toBe(true);
  });

  it('flags "guaranteed compliance" in output as forbidden', async () => {
    const result = await service.validate('We provide guaranteed compliance for all your needs.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  it('flags "passed SOC 2" variant via pattern match', async () => {
    // The service uses /\bpassed\s*(the\s*)?audit\b/i pattern for "passed audit"
    // and /\bsoc\s*2\s*certified\b/i for SOC2 certified
    const result = await service.validate('Your company passed the audit last quarter.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  it('flags "ISO certified" in output as forbidden', async () => {
    const result = await service.validate('The system is ISO certified.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  it('flags "SOC 2 certified" in output as forbidden', async () => {
    const result = await service.validate('You are SOC 2 certified now.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  it('flags "fully compliant" as forbidden', async () => {
    const result = await service.validate('Your organization is fully compliant.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  it('flags "guaranteed audit success" as forbidden', async () => {
    const result = await service.validate('We offer guaranteed audit success.');
    expect(result.forbiddenLanguageDetected).toBe(true);
  });

  // ─── Clean output passes ──────────────────────────────────────────────────

  it('clean output passes validation with no forbidden language', async () => {
    const result = await service.validate(
      'Your current readiness score is 72%. Focus on completing evidence collection.',
    );
    expect(result.forbiddenLanguageDetected).toBe(false);
    expect(result.issues.filter((i) => i.toLowerCase().includes('forbidden'))).toHaveLength(0);
  });

  it('output containing "audit-ready" passes validation', async () => {
    const result = await service.validate(
      'You are approaching audit-ready status. Keep up the good work.',
    );
    expect(result.forbiddenLanguageDetected).toBe(false);
  });

  it('output containing "readiness" passes validation', async () => {
    const result = await service.validate(
      'This readiness assessment shows strong progress in CC6 controls.',
    );
    expect(result.forbiddenLanguageDetected).toBe(false);
  });

  it('output containing "requires human review" passes validation', async () => {
    const result = await service.validate(
      'This section requires human review before proceeding.',
    );
    expect(result.forbiddenLanguageDetected).toBe(false);
  });

  // ─── Sanitization ─────────────────────────────────────────────────────────

  it('sanitizes forbidden phrases when detected', async () => {
    const result = await service.validate('You are now certified for compliance.');
    expect(result.sanitizedContent).toBeDefined();
    expect(result.sanitizedContent).toContain('[REMOVED');
    expect(result.sanitizedContent).not.toMatch(/\bcertified\b/i);
  });

  it('returns original content as sanitizedContent when no forbidden phrases', async () => {
    const content = 'Your readiness score is improving steadily.';
    const result = await service.validate(content);
    expect(result.sanitizedContent).toBe(content);
  });

  // ─── ValidationResult structure ───────────────────────────────────────────

  it('returns a ValidationResult with all required fields', async () => {
    const result = await service.validate('Clean output here.');
    expect(typeof result.schemaValid).toBe('boolean');
    expect(typeof result.controlIdsValid).toBe('boolean');
    expect(typeof result.forbiddenLanguageDetected).toBe('boolean');
    expect(typeof result.hallucinationDetected).toBe('boolean');
    expect(typeof result.citationsValid).toBe('boolean');
    expect(Array.isArray(result.issues)).toBe(true);
  });

  // ─── Control ID validation (when enabled) ─────────────────────────────────

  it('does not call validateControlIds when requiresControlValidation is false', async () => {
    await service.validate('Content with CC6.1 mentioned.', { requiresControlValidation: false });
    expect(mockControlLibrary.validateControlIds).not.toHaveBeenCalled();
  });

  it('calls validateControlIds when requiresControlValidation is true', async () => {
    mockValidateControlIds.mockImplementation(() => ({ valid: ['CC6.1'], invalid: [] }));
    await service.validate('Content with CC6.1 mentioned.', { requiresControlValidation: true });
    expect(mockControlLibrary.validateControlIds).toHaveBeenCalled();
  });

  it('flags hallucination when invalid control IDs found', async () => {
    mockValidateControlIds.mockImplementation(() => ({ valid: [], invalid: ['CC99.99'] }));
    const result = await service.validate(
      'Implement control CC99.99 for compliance.',
      { requiresControlValidation: true },
    );
    expect(result.hallucinationDetected).toBe(true);
    expect(result.controlIdsValid).toBe(false);
  });

  it('does not flag hallucination when all control IDs are valid', async () => {
    mockValidateControlIds.mockImplementation(() => ({ valid: ['CC6.1'], invalid: [] }));
    const result = await service.validate(
      'Implement control CC6.1.',
      { requiresControlValidation: true },
    );
    expect(result.hallucinationDetected).toBe(false);
    expect(result.controlIdsValid).toBe(true);
  });
});
