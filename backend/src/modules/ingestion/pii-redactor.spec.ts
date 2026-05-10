/**
 * PII Redactor Service Tests
 *
 * PII01–PII14: Verify PII pattern detection and redaction for all supported types.
 * Critical for LLM safety — PII must never reach the classification prompts.
 */

import { PiiRedactorService } from './pii-redactor.service';

const redactor = new PiiRedactorService();

describe('PII Redactor — SSN Detection', () => {

  it('PII01 — SSN with dashes is redacted', () => {
    const result = redactor.redact('Employee SSN: 123-45-6789 is on file.');
    expect(result.text).toContain('[REDACTED_SSN]');
    expect(result.text).not.toContain('123-45-6789');
    expect(result.piiDetected).toBe(true);
    expect(result.piiFields).toContain('SSN');
  });

  it('PII02 — multiple SSNs are all redacted', () => {
    const result = redactor.redact('SSN1: 111-22-3333, SSN2: 444-55-6666');
    expect(result.redactionCount).toBeGreaterThanOrEqual(2);
    expect(result.text).not.toContain('111-22-3333');
    expect(result.text).not.toContain('444-55-6666');
  });
});

describe('PII Redactor — Credit Card Detection', () => {

  it('PII03 — credit card with spaces is redacted', () => {
    const result = redactor.redact('Card: 4111 1111 1111 1111');
    expect(result.text).toContain('[REDACTED_CC]');
    expect(result.text).not.toContain('4111 1111 1111 1111');
    expect(result.piiFields).toContain('CREDIT_CARD');
  });

  it('PII04 — credit card with dashes is redacted', () => {
    const result = redactor.redact('Payment card: 5500-0000-0000-0004');
    expect(result.text).toContain('[REDACTED_CC]');
    expect(result.piiFields).toContain('CREDIT_CARD');
  });
});

describe('PII Redactor — Email Detection', () => {

  it('PII05 — email addresses are redacted', () => {
    const result = redactor.redact('Contact john.doe@company.com for details.');
    expect(result.text).toContain('[REDACTED_EMAIL]');
    expect(result.text).not.toContain('john.doe@company.com');
    expect(result.piiFields).toContain('EMAIL');
  });

  it('PII06 — multiple emails in text', () => {
    const result = redactor.redact('From: a@b.com To: c@d.org');
    expect(result.redactionCount).toBeGreaterThanOrEqual(2);
  });
});

describe('PII Redactor — Phone Detection', () => {

  it('PII07 — US phone with parentheses is redacted', () => {
    const result = redactor.redact('Call (555) 123-4567 for support.');
    expect(result.text).toContain('[REDACTED_PHONE]');
    expect(result.piiFields).toContain('PHONE');
  });

  it('PII08 — phone with dots is redacted', () => {
    const result = redactor.redact('Phone: 555.123.4567');
    expect(result.text).toContain('[REDACTED_PHONE]');
  });
});

describe('PII Redactor — IP Address Detection', () => {

  it('PII09 — IPv4 addresses are redacted', () => {
    const result = redactor.redact('Server IP: 192.168.1.100');
    expect(result.text).toContain('[REDACTED_IP]');
    expect(result.text).not.toContain('192.168.1.100');
    expect(result.piiFields).toContain('IP_ADDRESS');
  });

  it('PII10 — multiple IPs in network config text', () => {
    const result = redactor.redact('Gateway: 10.0.0.1, DNS: 8.8.8.8');
    expect(result.redactionCount).toBeGreaterThanOrEqual(2);
  });
});

describe('PII Redactor — DOB Detection', () => {

  it('PII11 — Date of Birth with label is redacted', () => {
    const result = redactor.redact('DOB: 01/15/1990');
    expect(result.text).toContain('[REDACTED_DOB]');
    expect(result.piiFields).toContain('DOB');
  });
});

describe('PII Redactor — No False Positives', () => {

  it('PII12 — normal business text has no PII detected', () => {
    const result = redactor.redact(
      'This security policy defines the access control requirements for production systems. ' +
      'All employees must complete annual training by December 31st.',
    );
    expect(result.piiDetected).toBe(false);
    expect(result.redactionCount).toBe(0);
    expect(result.piiFields).toEqual([]);
  });

  it('PII13 — control codes and framework IDs are not flagged', () => {
    const result = redactor.redact(
      'Controls: CC6.3, A.8.2, CC7.1. Frameworks: SOC2, ISO27001, GDPR.',
    );
    expect(result.piiDetected).toBe(false);
  });
});

describe('PII Redactor — Mixed PII', () => {

  it('PII14 — document with multiple PII types detects all', () => {
    const text = `
      Employee Record:
      Name: John Smith
      SSN: 123-45-6789
      Email: john.smith@company.com
      Phone: (555) 987-6543
      Server: 10.0.0.55
    `;
    const result = redactor.redact(text);
    expect(result.piiDetected).toBe(true);
    expect(result.piiFields).toContain('SSN');
    expect(result.piiFields).toContain('EMAIL');
    expect(result.piiFields).toContain('PHONE');
    expect(result.piiFields).toContain('IP_ADDRESS');
    expect(result.redactionCount).toBeGreaterThanOrEqual(4);
    expect(result.text).not.toContain('123-45-6789');
    expect(result.text).not.toContain('john.smith@company.com');
  });
});
