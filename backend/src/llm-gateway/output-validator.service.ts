import { Injectable, Logger } from '@nestjs/common';
import { ControlLibraryService } from '../control-library/control-library.service';

export interface ValidationResult {
  schemaValid: boolean;
  controlIdsValid: boolean;
  forbiddenLanguageDetected: boolean;
  hallucinationDetected: boolean;
  citationsValid: boolean;
  issues: string[];
  sanitizedContent?: string;
}

// Phrases that must never appear in LLM output on this compliance platform
const FORBIDDEN_PHRASES = [
  /\bcertified\b/i,
  /\bsoc\s*2\s*certified\b/i,
  /\biso\s*certified\b/i,
  /\bpassed\s*(the\s*)?audit\b/i,
  /\bguaranteed?\s*compliance\b/i,
  /\bguaranteed?\s*audit\s*success\b/i,
  /\bfully\s*compliant\b/i,
  /\bno\s*remaining\s*risk\b/i,
  /\bfully\s*mitigated\b/i,
  /\bapproved\s*by\s*(the\s*)?(auditor|regulator)\b/i,
];

// Pattern to detect likely hallucinated control IDs (not in CC/A.X format)
const CONTROL_ID_PATTERN = /\b(CC\d+\.\d+|A\d+\.\d+|C\d+\.\d+|PI\d+\.\d+|P\d+\.\d+|A\.\d+\.\d+)\b/g;

@Injectable()
export class OutputValidatorService {
  private readonly logger = new Logger(OutputValidatorService.name);

  constructor(private readonly library: ControlLibraryService) {}

  /**
   * Full validation pipeline for LLM output.
   */
  async validate(
    content: string,
    options: {
      requiresControlValidation?: boolean;
      outputSchemaId?: string;
    } = {},
  ): Promise<ValidationResult> {
    const issues: string[] = [];

    // 1. Forbidden language check
    const forbiddenFound = this.checkForbiddenLanguage(content);
    if (forbiddenFound.length) {
      issues.push(`Forbidden language detected: ${forbiddenFound.join(', ')}`);
    }

    // 2. Control ID validation
    let controlIdsValid = true;
    let hallucinationDetected = false;
    if (options.requiresControlValidation) {
      const { valid, invalid } = this.validateControlIds(content);
      if (invalid.length > 0) {
        controlIdsValid = false;
        hallucinationDetected = true;
        issues.push(`Unknown control IDs detected (possible hallucination): ${invalid.join(', ')}`);
      }
    }

    // 3. Schema validation (JSON output check)
    let schemaValid = true;
    if (options.outputSchemaId) {
      schemaValid = this.validateSchema(content, options.outputSchemaId);
      if (!schemaValid) {
        issues.push(`Output does not match expected schema: ${options.outputSchemaId}`);
      }
    }

    // 4. Citation check: if content mentions controls, they should be cited
    const citationsValid = this.checkCitations(content);

    // 5. Sanitize: replace forbidden phrases if found (for retry purposes, we strip them)
    const sanitizedContent = forbiddenFound.length
      ? this.sanitize(content, forbiddenFound)
      : content;

    return {
      schemaValid,
      controlIdsValid,
      forbiddenLanguageDetected: forbiddenFound.length > 0,
      hallucinationDetected,
      citationsValid,
      issues,
      sanitizedContent,
    };
  }

  private checkForbiddenLanguage(content: string): string[] {
    const found: string[] = [];
    for (const pattern of FORBIDDEN_PHRASES) {
      const match = content.match(pattern);
      if (match) found.push(match[0]);
    }
    return found;
  }

  private validateControlIds(content: string): { valid: string[]; invalid: string[] } {
    const matches = content.match(CONTROL_ID_PATTERN) ?? [];
    const uniqueCodes = [...new Set(matches)];
    return this.library.validateControlIds(uniqueCodes);
  }

  private validateSchema(content: string, schemaId: string): boolean {
    // Extract JSON from content (may be wrapped in markdown code block)
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ??
                      content.match(/^\s*(\{[\s\S]*\})\s*$/);

    if (!jsonMatch) {
      // If no JSON found but schema is required, it's only invalid for JSON-output schemas
      const jsonSchemas = [
        'gap-analysis-v1', 'risk-register-v1', 'evidence-collection-v1',
        'roadmap-v1', 'audit-report-v1', 'review-v1', 'task-list-v1',
        'scope-definition-v1', 'evidence-validation-v1', 'onboarding-extraction-v1',
      ];
      return !jsonSchemas.includes(schemaId); // markdown schemas are valid without JSON
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return this.validateAgainstSchema(parsed, schemaId);
    } catch {
      return false;
    }
  }

  private validateAgainstSchema(obj: any, schemaId: string): boolean {
    // Lightweight structural validation per schema
    switch (schemaId) {
      case 'gap-analysis-v1':
        return Array.isArray(obj.gaps) && typeof obj.overallReadiness === 'string';
      case 'risk-register-v1':
        return Array.isArray(obj.risks);
      case 'evidence-collection-v1':
        return Array.isArray(obj.evidence_items);
      case 'roadmap-v1':
        return Array.isArray(obj.phases) && typeof obj.total_duration_weeks === 'number';
      case 'task-list-v1':
        return Array.isArray(obj.tasks);
      case 'review-v1':
        return typeof obj.summary === 'string' && Array.isArray(obj.findings);
      case 'scope-definition-v1':
        return typeof obj.requires_human_review === 'boolean';
      case 'evidence-validation-v1':
        return typeof obj.overall_verdict === 'string';
      case 'onboarding-extraction-v1':
        return typeof obj.extracted === 'object';
      default:
        return true; // Unknown schema — pass through
    }
  }

  private checkCitations(content: string): boolean {
    // If content references "control" it should cite a code
    const mentionsControl = /\b(control|criteria|requirement)\b/i.test(content);
    const hasControlCode = CONTROL_ID_PATTERN.test(content);
    CONTROL_ID_PATTERN.lastIndex = 0; // reset regex state

    if (mentionsControl && !hasControlCode && content.length > 200) {
      // Long content that mentions controls but cites none — flag
      return false;
    }
    return true;
  }

  private sanitize(content: string, _forbiddenFound: string[]): string {
    let result = content;
    for (const pattern of FORBIDDEN_PHRASES) {
      result = result.replace(pattern, '[REMOVED — see compliance guidelines]');
    }
    return result;
  }
}
