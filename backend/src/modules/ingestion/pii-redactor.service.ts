import { Injectable, Logger } from '@nestjs/common';

export interface RedactionResult {
  text: string;
  piiDetected: boolean;
  piiFields: string[];
  redactionCount: number;
}

interface PiiPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const PII_PATTERNS: PiiPattern[] = [
  // SSN: 123-45-6789
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED_SSN]' },

  // Credit card numbers (basic patterns: 16 digits with optional separators)
  { name: 'CREDIT_CARD', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_CC]' },

  // Email addresses
  { name: 'EMAIL', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },

  // Phone numbers (US format)
  { name: 'PHONE', pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[REDACTED_PHONE]' },

  // IP addresses
  { name: 'IP_ADDRESS', pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, replacement: '[REDACTED_IP]' },

  // Dates of birth (common formats: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  { name: 'DOB', pattern: /\b(?:DOB|Date of Birth|Born)[\s:]*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/gi, replacement: '[REDACTED_DOB]' },

  // Passport numbers (basic: 1 letter + 7-8 digits)
  { name: 'PASSPORT', pattern: /\b(?:passport[\s#:]*)?[A-Z]\d{7,8}\b/gi, replacement: '[REDACTED_PASSPORT]' },
];

@Injectable()
export class PiiRedactorService {
  private readonly logger = new Logger(PiiRedactorService.name);

  /**
   * Redact PII from text before sending to LLM.
   * Returns the redacted text and metadata about what was found.
   */
  redact(text: string): RedactionResult {
    let redactedText = text;
    const detectedFields = new Set<string>();
    let totalRedactions = 0;

    for (const piiPattern of PII_PATTERNS) {
      const matches = redactedText.match(piiPattern.pattern);
      if (matches && matches.length > 0) {
        detectedFields.add(piiPattern.name);
        totalRedactions += matches.length;
        redactedText = redactedText.replace(piiPattern.pattern, piiPattern.replacement);
      }
    }

    const piiDetected = detectedFields.size > 0;
    if (piiDetected) {
      this.logger.warn(
        `PII detected: ${[...detectedFields].join(', ')} (${totalRedactions} redactions)`,
      );
    }

    return {
      text: redactedText,
      piiDetected,
      piiFields: [...detectedFields],
      redactionCount: totalRedactions,
    };
  }
}
