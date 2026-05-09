import { Injectable } from '@nestjs/common';

export interface ClassificationResult {
  detectedType: string;
  detectedFrameworks: string[];
  confidence: number;
  suggestedControlIds: string[];
}

interface PatternEntry {
  pattern: RegExp;
  type: string;
  frameworks: string[];
  confidence: number;
  controls: string[];
}

const FILENAME_PATTERNS: PatternEntry[] = [
  { pattern: /access.?review/i,       type: 'access_review',    frameworks: ['SOC2','ISO27001'], confidence: 92, controls: ['CC6.3','A.8.2'] },
  { pattern: /access.?control/i,      type: 'policy',           frameworks: ['SOC2','ISO27001'], confidence: 88, controls: ['CC6.1','A.8.3'] },
  { pattern: /pentest|penetration.?test/i, type: 'audit_report', frameworks: ['SOC2','ISO27001'], confidence: 95, controls: ['CC7.2','A.8.8'] },
  { pattern: /vuln(erability)?.?scan/i,    type: 'audit_report', frameworks: ['SOC2','ISO27001'], confidence: 92, controls: ['CC7.1','A.8.8'] },
  { pattern: /soc.?2|soc2/i,          type: 'audit_report',     frameworks: ['SOC2'],            confidence: 90, controls: [] },
  { pattern: /iso.?27001/i,           type: 'policy',           frameworks: ['ISO27001'],        confidence: 90, controls: [] },
  { pattern: /gdpr|dpa|data.?protection/i, type: 'policy',      frameworks: ['GDPR'],            confidence: 88, controls: ['GDPR-Art-24-1'] },
  { pattern: /iso.?9001|quality.?manual/i, type: 'policy',      frameworks: ['ISO9001'],         confidence: 90, controls: ['ISO9001-7.5'] },
  { pattern: /dpia|impact.?assessment/i,   type: 'policy',      frameworks: ['GDPR'],            confidence: 92, controls: ['GDPR-Art-35-1'] },
  { pattern: /ropa|processing.?activit/i,  type: 'policy',      frameworks: ['GDPR'],            confidence: 94, controls: ['GDPR-Art-30-1'] },
  { pattern: /ncr|nonconformit|non.?conform/i, type: 'report',  frameworks: ['ISO9001'],         confidence: 92, controls: ['ISO9001-10.2'] },
  { pattern: /capa|corrective.?action/i,   type: 'policy',      frameworks: ['ISO9001'],         confidence: 90, controls: ['ISO9001-10.2'] },
  { pattern: /security.?policy|infosec/i,  type: 'policy',      frameworks: ['ISO27001','SOC2'], confidence: 90, controls: ['A.5.1','CC2.1'] },
  { pattern: /incident.?response/i,        type: 'policy',      frameworks: ['ISO27001','SOC2'], confidence: 88, controls: ['A.5.24','CC7.3'] },
  { pattern: /business.?continuity|bcp|bcdr/i, type: 'policy',  frameworks: ['ISO27001','SOC2'], confidence: 88, controls: ['A.5.29','A1.2'] },
  { pattern: /risk.?assessment|risk.?register/i, type: 'policy', frameworks: ['ISO27001','SOC2'], confidence: 90, controls: ['A.5.9','CC3.2'] },
  { pattern: /vendor|supplier|third.?party/i, type: 'policy',   frameworks: ['ISO27001','SOC2'], confidence: 85, controls: ['A.5.19','CC9.2'] },
  { pattern: /training|awareness|phishing/i,   type: 'training_record', frameworks: ['ISO27001','SOC2'], confidence: 88, controls: ['A.6.3','CC1.4'] },
  { pattern: /change.?management|change.?control/i, type: 'policy', frameworks: ['ISO27001','SOC2'], confidence: 88, controls: ['A.8.32','CC8.1'] },
  { pattern: /audit.?report|audit.?log/i,     type: 'audit_report', frameworks: ['ISO27001','SOC2'], confidence: 87, controls: [] },
  { pattern: /privacy.?notice|privacy.?policy/i, type: 'policy', frameworks: ['GDPR'],           confidence: 92, controls: ['GDPR-Art-13-1'] },
  { pattern: /data.?retention/i,             type: 'policy',    frameworks: ['GDPR','ISO27001'], confidence: 88, controls: ['GDPR-Art-5-1','A.5.33'] },
  { pattern: /encryption|cryptograph/i,      type: 'policy',    frameworks: ['ISO27001','GDPR'], confidence: 87, controls: ['A.8.24','GDPR-Art-32-1'] },
  { pattern: /mfa|multi.?factor|2fa/i,       type: 'config_screenshot', frameworks: ['SOC2','ISO27001'], confidence: 88, controls: ['CC6.1','A.8.5'] },
  { pattern: /backup|disaster.?recovery/i,   type: 'audit_report', frameworks: ['ISO27001','SOC2'], confidence: 87, controls: ['A.8.13','A1.2'] },
];

const FOLDER_PATTERNS: PatternEntry[] = [
  { pattern: /\/policies\//i,    type: 'policy',        frameworks: [],            confidence: 82, controls: [] },
  { pattern: /\/procedures\//i,  type: 'procedure',     frameworks: [],            confidence: 82, controls: [] },
  { pattern: /\/evidence\//i,    type: 'evidence',      frameworks: [],            confidence: 80, controls: [] },
  { pattern: /\/soc.?2\//i,      type: 'audit_report',  frameworks: ['SOC2'],      confidence: 85, controls: [] },
  { pattern: /\/iso.?27001\//i,  type: 'policy',        frameworks: ['ISO27001'],  confidence: 85, controls: [] },
  { pattern: /\/gdpr\//i,        type: 'policy',        frameworks: ['GDPR'],      confidence: 85, controls: [] },
  { pattern: /\/iso.?9001\//i,   type: 'policy',        frameworks: ['ISO9001'],   confidence: 85, controls: [] },
  { pattern: /\/training\//i,    type: 'training_record', frameworks: [],          confidence: 82, controls: [] },
  { pattern: /\/audit\//i,       type: 'audit_report',  frameworks: [],            confidence: 80, controls: [] },
];

@Injectable()
export class IngestionClassifierService {
  /** Tier 1 deterministic classification — returns null if confidence < 85 */
  classify(filename: string, folderPath?: string, sizeBytes?: number, mimeType?: string): ClassificationResult | null {
    let bestResult: ClassificationResult | null = null;
    let bestConfidence = 0;

    // Check filename patterns
    for (const entry of FILENAME_PATTERNS) {
      if (entry.pattern.test(filename)) {
        if (entry.confidence > bestConfidence) {
          bestConfidence = entry.confidence;
          bestResult = {
            detectedType: entry.type,
            detectedFrameworks: entry.frameworks,
            confidence: entry.confidence,
            suggestedControlIds: entry.controls,
          };
        }
      }
    }

    // Check folder path patterns (augment confidence if matching)
    if (folderPath) {
      for (const entry of FOLDER_PATTERNS) {
        if (entry.pattern.test(folderPath)) {
          if (bestResult) {
            // Boost confidence if folder confirms same type
            if (!bestResult.detectedType || entry.type === bestResult.detectedType) {
              bestResult.confidence = Math.min(99, bestResult.confidence + 3);
              bestConfidence = bestResult.confidence;
            }
            // Add frameworks from folder hint
            for (const fw of entry.frameworks) {
              if (!bestResult.detectedFrameworks.includes(fw)) {
                bestResult.detectedFrameworks.push(fw);
              }
            }
          } else if (entry.confidence > bestConfidence) {
            bestConfidence = entry.confidence;
            bestResult = {
              detectedType: entry.type,
              detectedFrameworks: entry.frameworks,
              confidence: entry.confidence,
              suggestedControlIds: entry.controls,
            };
          }
        }
      }
    }

    // CSV/spreadsheet hint — often access lists or evidence
    if (mimeType === 'text/csv' || filename.endsWith('.csv') || filename.endsWith('.xlsx')) {
      if (!bestResult) {
        bestResult = { detectedType: 'evidence', detectedFrameworks: [], confidence: 80, suggestedControlIds: [] };
        bestConfidence = 80;
      }
    }

    // Return only if confidence meets threshold
    if (bestResult && bestConfidence >= 85) {
      bestResult.confidence = bestConfidence;
      return bestResult;
    }
    return null;
  }
}
