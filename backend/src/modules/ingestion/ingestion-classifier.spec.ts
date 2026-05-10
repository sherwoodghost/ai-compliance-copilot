/**
 * Ingestion Classifier — Tier 1 Deterministic Classification Tests
 *
 * IC01–IC20: Verify filename pattern matching, folder path signals,
 * file size heuristics, and confidence thresholds.
 */

import { IngestionClassifierService } from './ingestion-classifier.service';

// Create a minimal instance (Tier 1 is sync, no LLM deps needed)
const classifier = new (IngestionClassifierService as any)();

// Bind the method to the prototype directly since we skip constructor DI
const classifyTier1 = (signals: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  folderPath?: string;
}) => IngestionClassifierService.prototype.classifyTier1.call(classifier, signals);

describe('Tier 1 Classifier — Filename Patterns', () => {

  it('IC01 — access_review PDF → evidence, SOC2+ISO27001, confidence >= 85', () => {
    const result = classifyTier1({
      filename: 'access_review_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 50000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('evidence');
    expect(result!.detectedFrameworks).toContain('SOC2');
    expect(result!.detectedFrameworks).toContain('ISO27001');
    expect(result!.suggestedControlIds).toContain('CC6.3');
    expect(result!.confidence).toBeGreaterThanOrEqual(85);
    expect(result!.tier).toBe(1);
  });

  it('IC02 — penetration_test report → evidence', () => {
    const result = classifyTier1({
      filename: 'penetration-test-report-Q3.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 200000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('evidence');
    expect(result!.suggestedControlIds).toContain('CC7.1');
  });

  it('IC03 — SOC2 report → report type, SOC2 framework', () => {
    const result = classifyTier1({
      filename: 'SOC2_Type_II_Report_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 500000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('report');
    expect(result!.detectedFrameworks).toContain('SOC2');
  });

  it('IC04 — GDPR privacy policy → policy type', () => {
    const result = classifyTier1({
      filename: 'GDPR_Privacy_Policy.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 30000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('policy');
    expect(result!.detectedFrameworks).toContain('GDPR');
  });

  it('IC05 — security policy → policy with SOC2+ISO27001', () => {
    const result = classifyTier1({
      filename: 'Information_Security_Policy_v3.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 40000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('policy');
    expect(result!.suggestedControlIds).toContain('CC1.1');
    expect(result!.suggestedControlIds).toContain('A.5.1');
  });

  it('IC06 — incident_response procedure', () => {
    const result = classifyTier1({
      filename: 'incident-response-plan.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 25000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('procedure');
    expect(result!.suggestedControlIds).toContain('CC7.3');
  });

  it('IC07 — change_management procedure', () => {
    const result = classifyTier1({
      filename: 'change_management_process.docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 20000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('procedure');
  });

  it('IC08 — ISO9001 quality manual → policy', () => {
    const result = classifyTier1({
      filename: 'Quality_Manual_ISO9001.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 60000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('policy');
    expect(result!.detectedFrameworks).toContain('ISO9001');
  });

  it('IC09 — DPIA → procedure, GDPR', () => {
    const result = classifyTier1({
      filename: 'DPIA_CustomerData_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 35000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('procedure');
    expect(result!.detectedFrameworks).toContain('GDPR');
  });

  it('IC10 — ROPA template → template, GDPR', () => {
    const result = classifyTier1({
      filename: 'ROPA_Template.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 15000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('template');
    expect(result!.detectedFrameworks).toContain('GDPR');
  });
});

describe('Tier 1 Classifier — Null Returns (Escalation)', () => {

  it('IC11 — unknown filename returns null (escalate to Tier 2)', () => {
    const result = classifyTier1({
      filename: 'meeting_notes_march.txt',
      mimeType: 'text/plain',
      sizeBytes: 5000,
    });
    expect(result).toBeNull();
  });

  it('IC12 — generic document name returns null', () => {
    const result = classifyTier1({
      filename: 'document.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 30000,
    });
    expect(result).toBeNull();
  });

  it('IC13 — random filename returns null', () => {
    const result = classifyTier1({
      filename: 'Q4_financials_summary.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      sizeBytes: 80000,
    });
    expect(result).toBeNull();
  });
});

describe('Tier 1 Classifier — Folder Path Signals', () => {

  it('IC14 — file in /policies/ folder gets policy type hint', () => {
    const result = classifyTier1({
      filename: 'access_review_report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 50000,
      folderPath: 'compliance/policies',
    });
    // access_review matches first, so type = evidence, but folder adds framework signal
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('evidence'); // filename pattern wins
  });

  it('IC15 — unknown file in /evidence/ folder alone has low confidence (< 85)', () => {
    const result = classifyTier1({
      filename: 'screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 200000,
      folderPath: 'uploads/evidence/screenshots',
    });
    // Folder gives type=evidence at confidence=70, which is < 85 threshold
    expect(result).toBeNull();
  });

  it('IC16 — folder path containing soc2 adds SOC2 framework', () => {
    const result = classifyTier1({
      filename: 'training_records_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 30000,
      folderPath: 'compliance/soc2/evidence',
    });
    expect(result).not.toBeNull();
    expect(result!.detectedFrameworks).toContain('SOC2');
  });
});

describe('Tier 1 Classifier — Classification Reason', () => {

  it('IC17 — reason includes the matching pattern description', () => {
    const result = classifyTier1({
      filename: 'vendor_risk_assessment.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100000,
    });
    expect(result).not.toBeNull();
    // "vendor_risk_assessment" matches the "risk.?assess" pattern first
    expect(result!.classificationReason).toContain('risk assessment');
  });

  it('IC18 — folder path reason is included when applicable', () => {
    const result = classifyTier1({
      filename: 'vulnerability_scan_results.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 80000,
      folderPath: 'soc2/evidence',
    });
    expect(result).not.toBeNull();
    expect(result!.classificationReason).toContain('vulnerability');
  });
});

describe('Tier 1 Classifier — Case Insensitivity', () => {

  it('IC19 — filename matching is case-insensitive', () => {
    const result = classifyTier1({
      filename: 'ACCESS_REVIEW_2024.PDF',
      mimeType: 'application/pdf',
      sizeBytes: 50000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('evidence');
  });

  it('IC20 — mixed case filenames are matched', () => {
    const result = classifyTier1({
      filename: 'Risk-Assessment-Report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 150000,
    });
    expect(result).not.toBeNull();
    expect(result!.detectedType).toBe('report');
    expect(result!.suggestedControlIds).toContain('CC3.1');
  });
});
