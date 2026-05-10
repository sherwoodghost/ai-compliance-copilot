import { Injectable, Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { LlmService } from '../../llm/llm.service';

export interface ClassificationResult {
  detectedType: string;  // policy | procedure | evidence | report | template | other
  detectedFrameworks: string[];
  suggestedControlIds: string[];
  confidence: number;    // 0-100
  tier: number;          // 1 = deterministic, 2 = haiku, 3 = sonnet
  classificationReason: string;
  isDuplicate?: boolean;
  duplicateOf?: string | null;
}

export interface FileSignals {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  folderPath?: string;
}

export interface ClassificationContext {
  companyName: string;
  industry: string;
  employeeCount: string;
  targetFrameworks: string[];
  cloudProviders: string[];
  dataTypes: string[];
  applicableControlCodes: string[];
  existingDocTitles: string[];
}

interface Tier2BatchItem {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  folderPath?: string;
  redactedText: string;
  t1Hints: ClassificationResult | null;
}

// Tier 1 deterministic rules
const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: string; frameworks: string[]; controlIds: string[]; reason: string }> = [
  { pattern: /access.?review/i,        type: 'evidence',   frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC6.3', 'A.8.2'],  reason: 'Filename contains "access review"' },
  { pattern: /penetration.?test/i,     type: 'evidence',   frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC7.1', 'A.8.8'],  reason: 'Filename contains "penetration test"' },
  { pattern: /vulnerability.?scan/i,   type: 'evidence',   frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC7.1', 'A.8.8'],  reason: 'Filename contains "vulnerability scan"' },
  { pattern: /soc.?2/i,                type: 'report',     frameworks: ['SOC2'],             controlIds: [],                  reason: 'Filename references SOC 2' },
  { pattern: /iso.?27001/i,            type: 'report',     frameworks: ['ISO27001'],         controlIds: [],                  reason: 'Filename references ISO 27001' },
  { pattern: /gdpr/i,                  type: 'policy',     frameworks: ['GDPR'],             controlIds: [],                  reason: 'Filename references GDPR' },
  { pattern: /iso.?9001/i,             type: 'policy',     frameworks: ['ISO9001'],          controlIds: [],                  reason: 'Filename references ISO 9001' },
  { pattern: /security.?policy/i,      type: 'policy',     frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC1.1', 'A.5.1'],  reason: 'Filename indicates security policy' },
  { pattern: /privacy.?policy/i,       type: 'policy',     frameworks: ['GDPR'],             controlIds: [],                  reason: 'Filename indicates privacy policy' },
  { pattern: /risk.?assess/i,          type: 'report',     frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC3.1', 'A.6.1'],  reason: 'Filename indicates risk assessment' },
  { pattern: /incident.?response/i,    type: 'procedure',  frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC7.3', 'A.5.24'], reason: 'Filename indicates incident response' },
  { pattern: /business.?continuity/i,  type: 'policy',     frameworks: ['ISO27001'],         controlIds: ['A.5.29'],          reason: 'Filename indicates business continuity' },
  { pattern: /change.?management/i,    type: 'procedure',  frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC8.1', 'A.8.32'], reason: 'Filename indicates change management' },
  { pattern: /vendor.?risk/i,          type: 'report',     frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC9.1', 'A.5.19'], reason: 'Filename indicates vendor risk' },
  { pattern: /data.?classification/i,  type: 'policy',     frameworks: ['ISO27001'],         controlIds: ['A.5.12'],          reason: 'Filename indicates data classification' },
  { pattern: /audit.?report/i,         type: 'report',     frameworks: [],                   controlIds: [],                  reason: 'Filename indicates audit report' },
  { pattern: /training/i,              type: 'evidence',   frameworks: ['SOC2', 'ISO27001'], controlIds: ['CC1.4', 'A.6.3'],  reason: 'Filename indicates training record' },
  { pattern: /background.?check/i,     type: 'evidence',   frameworks: ['ISO27001'],         controlIds: ['A.6.1'],           reason: 'Filename indicates background check' },
  { pattern: /nda|non.?disclosure/i,   type: 'policy',     frameworks: ['ISO27001'],         controlIds: ['A.6.1'],           reason: 'Filename indicates NDA' },
  { pattern: /dpia/i,                  type: 'procedure',  frameworks: ['GDPR'],             controlIds: [],                  reason: 'Filename references DPIA' },
  { pattern: /ropa|processing.?activit/i, type: 'template', frameworks: ['GDPR'],            controlIds: [],                  reason: 'Filename references ROPA' },
  { pattern: /nonconformit|ncr/i,      type: 'report',     frameworks: ['ISO9001'],          controlIds: [],                  reason: 'Filename references NCR/nonconformity' },
  { pattern: /capa|corrective.?action/i, type: 'procedure', frameworks: ['ISO9001'],         controlIds: [],                  reason: 'Filename references CAPA' },
  { pattern: /quality.?manual/i,        type: 'policy',    frameworks: ['ISO9001'],          controlIds: [],                  reason: 'Filename references Quality Manual' },
];

const FOLDER_PATTERNS: Array<{ pattern: RegExp; type?: string; frameworks: string[] }> = [
  { pattern: /\bpolicies?\b/i,   type: 'policy',    frameworks: [] },
  { pattern: /\bprocedures?\b/i, type: 'procedure', frameworks: [] },
  { pattern: /\bevidence\b/i,    type: 'evidence',  frameworks: [] },
  { pattern: /\breports?\b/i,    type: 'report',    frameworks: [] },
  { pattern: /\bsoc.?2\b/i,      type: undefined,   frameworks: ['SOC2'] },
  { pattern: /\biso.?27001\b/i,  type: undefined,   frameworks: ['ISO27001'] },
  { pattern: /\bgdpr\b/i,        type: undefined,   frameworks: ['GDPR'] },
  { pattern: /\biso.?9001\b/i,   type: undefined,   frameworks: ['ISO9001'] },
];

@Injectable()
export class IngestionClassifierService {
  private readonly logger = new Logger(IngestionClassifierService.name);

  constructor(
    private readonly gateway: LlmGatewayService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Tier 1 — Deterministic classification.
   * Returns null if confidence < 85 (caller should escalate to Tier 2).
   */
  classifyTier1(signals: FileSignals): ClassificationResult | null {
    let detectedType: string | undefined;
    let detectedFrameworks: string[] = [];
    let suggestedControlIds: string[] = [];
    let confidence = 0;
    const reasons: string[] = [];

    // --- Filename pattern matching ---
    const filename = signals.filename.toLowerCase();
    for (const rule of FILENAME_PATTERNS) {
      if (rule.pattern.test(filename)) {
        detectedType = rule.type;
        detectedFrameworks = [...new Set([...detectedFrameworks, ...rule.frameworks])];
        suggestedControlIds = [...new Set([...suggestedControlIds, ...rule.controlIds])];
        confidence = Math.max(confidence, 85);
        reasons.push(rule.reason);
        break; // first match wins for type
      }
    }

    // --- Folder path signals ---
    if (signals.folderPath) {
      for (const rule of FOLDER_PATTERNS) {
        if (rule.pattern.test(signals.folderPath)) {
          if (rule.type && !detectedType) detectedType = rule.type;
          detectedFrameworks = [...new Set([...detectedFrameworks, ...rule.frameworks])];
          confidence = Math.max(confidence, 70);
          reasons.push(`Folder path contains "${rule.pattern.source}"`);
        }
      }
    }

    // --- File size heuristics ---
    const pageSizeEstimate = signals.sizeBytes / 2000; // ~2KB per page
    if (signals.mimeType === 'application/pdf') {
      if (pageSizeEstimate < 10 && !detectedType) {
        detectedType = 'procedure';
        reasons.push('PDF appears to be a short procedure document');
        confidence = Math.max(confidence, 45);
      } else if (pageSizeEstimate > 50 && !detectedType) {
        detectedType = 'report';
        reasons.push('PDF appears to be a long report document');
        confidence = Math.max(confidence, 45);
      }
    }

    // CSV/spreadsheet → likely access lists or evidence logs
    if (signals.mimeType === 'text/csv' || filename.endsWith('.csv') || filename.endsWith('.xlsx')) {
      if (!detectedType) {
        detectedType = 'evidence';
        reasons.push('CSV/spreadsheet typically contains evidence logs or access lists');
        confidence = Math.max(confidence, 60);
      }
    }

    if (confidence < 85 || !detectedType) return null;

    return {
      detectedType: detectedType ?? 'other',
      detectedFrameworks,
      suggestedControlIds,
      confidence,
      tier: 1,
      classificationReason: reasons.join('; '),
    };
  }

  // ── Tier 2 — Haiku Batch Classification ─────────────────────────────────

  /**
   * Classify up to 10 files in a single Haiku LLM call.
   * Uses company context (BusinessProfile) for smarter classification.
   */
  async classifyTier2Batch(
    items: Tier2BatchItem[],
    context: ClassificationContext,
  ): Promise<Array<{ fileId: string; result: ClassificationResult | null }>> {
    const filesDescription = items.map((item, i) => {
      const hints = item.t1Hints
        ? `Tier 1 hints: type=${item.t1Hints.detectedType}, frameworks=${item.t1Hints.detectedFrameworks.join(',')}`
        : 'No Tier 1 match';
      return `File ${i + 1}: "${item.originalName}" (${item.mimeType}, ${item.sizeBytes} bytes)
${hints}
Content preview:
${item.redactedText.slice(0, 500)}`;
    }).join('\n\n---\n\n');

    const userMessage = `Company: ${context.companyName} (${context.industry}, ${context.employeeCount} employees)
Target frameworks: ${context.targetFrameworks.join(', ') || 'not set'}
Infrastructure: ${context.cloudProviders.join(', ') || 'not specified'}
Data types: ${context.dataTypes.join(', ') || 'not specified'}
Applicable controls: ${context.applicableControlCodes.slice(0, 50).join(', ')}

Classify each of the following ${items.length} files.

For each file, return a JSON object with:
- fileIndex (0-based)
- detectedType: one of "policy" | "procedure" | "evidence" | "report" | "template" | "other"
- detectedFrameworks: string[] of framework IDs (SOC2, ISO27001, GDPR, ISO9001, HIPAA, PCI_DSS, NIST_CSF, FedRAMP)
- suggestedControlIds: string[] of control codes this document likely maps to
- confidence: 0-100
- reason: brief explanation

Return a JSON array only, no other text.

${filesDescription}`;

    try {
      const response = await this.gateway.call({
        promptTemplateId: 'ingestion-classify-t2',
        userMessage,
        agentName: 'ingestion-classifier',
        taskType: 'compliance',
        maxTokens: 2000,
      });

      const parsed = this.llm.parseJSON<any[]>(response.content);

      return items.map((item, i) => {
        const match = parsed.find((p: any) => p.fileIndex === i);
        if (!match) return { fileId: item.fileId, result: null };

        return {
          fileId: item.fileId,
          result: {
            detectedType: match.detectedType ?? 'other',
            detectedFrameworks: match.detectedFrameworks ?? [],
            suggestedControlIds: match.suggestedControlIds ?? [],
            confidence: match.confidence ?? 50,
            tier: 2,
            classificationReason: match.reason ?? 'Classified by AI (Tier 2)',
          },
        };
      });
    } catch (err: any) {
      this.logger.error(`Tier 2 batch classification failed: ${err.message}`);
      return items.map((item) => ({ fileId: item.fileId, result: null }));
    }
  }

  // ── Tier 3 — Sonnet Deep Classification ─────────────────────────────────

  /**
   * Deep classification of a single document using Sonnet.
   * Full document text + complete company context.
   */
  async classifyTier3(
    signals: FileSignals,
    fullText: string,
    context: ClassificationContext,
  ): Promise<ClassificationResult | null> {
    const userMessage = `Company: ${context.companyName} (${context.industry}, ${context.employeeCount} employees)
Target frameworks: ${context.targetFrameworks.join(', ') || 'not set'}
Infrastructure: ${context.cloudProviders.join(', ') || 'not specified'}
Data types: ${context.dataTypes.join(', ') || 'not specified'}
Applicable controls: ${context.applicableControlCodes.slice(0, 100).join(', ')}
Existing documents: ${context.existingDocTitles.slice(0, 20).join(', ')}

Classify this document with high precision.

File: "${signals.filename}" (${signals.mimeType}, ${signals.sizeBytes} bytes)

Full content:
${fullText}

Return a single JSON object with:
- detectedType: "policy" | "procedure" | "evidence" | "report" | "template" | "other"
- detectedFrameworks: string[] of framework IDs
- suggestedControlIds: string[] of specific control codes this document maps to
- confidence: 0-100
- reason: detailed explanation of the classification
- isDuplicate: boolean — true if this appears to be a version of an existing document
- duplicateOf: string | null — title of the existing document it duplicates

Return JSON only, no other text.`;

    try {
      const response = await this.gateway.call({
        promptTemplateId: 'ingestion-classify-t3',
        userMessage,
        agentName: 'ingestion-classifier',
        model: 'claude-sonnet-4-6', // Override to Sonnet for Tier 3
        taskType: 'compliance',
        maxTokens: 1500,
      });

      const parsed = this.llm.parseJSON<any>(response.content);

      return {
        detectedType: parsed.detectedType ?? 'other',
        detectedFrameworks: parsed.detectedFrameworks ?? [],
        suggestedControlIds: parsed.suggestedControlIds ?? [],
        confidence: parsed.confidence ?? 50,
        tier: 3,
        classificationReason: parsed.reason ?? 'Classified by AI (Tier 3)',
        isDuplicate: parsed.isDuplicate ?? false,
        duplicateOf: parsed.duplicateOf ?? null,
      };
    } catch (err: any) {
      this.logger.error(`Tier 3 classification failed: ${err.message}`);
      return null;
    }
  }
}
