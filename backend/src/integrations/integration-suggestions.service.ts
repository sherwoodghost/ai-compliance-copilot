import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  InferenceOutput,
  ExpectedIntegration,
} from '../inference/inference.types';

/**
 * IntegrationSuggestionsService
 *
 * Derives integration suggestions deterministically from InferenceOutput.
 * ZERO LLM calls. Same inference output → same suggestions.
 *
 * Suggestions are ranked by relevance score and persisted to integration_suggestions
 * table (unique on orgId + provider) so the UI can show prioritised connection prompts.
 */

export interface IntegrationSuggestion {
  provider: string;
  category: string;
  reason: string;
  relevanceScore: number;     // 0–100
  automatesControls: string[];
  setupUrl?: string;
}

// Static provider metadata — kept here to avoid DB round-trips
const PROVIDER_METADATA: Record<string, {
  category: string;
  automatesControls: string[];
  setupUrl: string;
}> = {
  // Identity
  okta:          { category: 'identity',   automatesControls: ['CC6.1', 'CC6.2', 'CC6.3', 'A.9.1', 'A.9.2'], setupUrl: '/integrations/okta' },
  azure_ad:      { category: 'identity',   automatesControls: ['CC6.1', 'CC6.2', 'CC6.3', 'A.9.1'], setupUrl: '/integrations/azure_ad' },
  google_ws:     { category: 'identity',   automatesControls: ['CC6.1', 'CC6.2', 'A.9.1'], setupUrl: '/integrations/google_ws' },

  // Cloud
  aws:           { category: 'cloud',      automatesControls: ['CC6.6', 'CC6.7', 'CC7.1', 'CC7.2', 'A.12.1', 'A.12.4'], setupUrl: '/integrations/aws' },
  gcp:           { category: 'cloud',      automatesControls: ['CC6.6', 'CC7.1', 'A.12.4'], setupUrl: '/integrations/gcp' },
  azure:         { category: 'cloud',      automatesControls: ['CC6.6', 'CC7.1', 'A.12.4'], setupUrl: '/integrations/azure' },

  // Code / CI
  github:        { category: 'code',       automatesControls: ['CC8.1', 'A.12.1', 'A.12.6'], setupUrl: '/integrations/github' },
  gitlab:        { category: 'code',       automatesControls: ['CC8.1', 'A.12.1'], setupUrl: '/integrations/gitlab' },

  // Monitoring
  datadog:       { category: 'monitoring', automatesControls: ['CC7.2', 'CC7.3', 'A.12.4'], setupUrl: '/integrations/datadog' },
  splunk:        { category: 'monitoring', automatesControls: ['CC7.2', 'CC7.3', 'A.12.4'], setupUrl: '/integrations/splunk' },
  pagerduty:     { category: 'monitoring', automatesControls: ['CC7.3', 'A.16.1'], setupUrl: '/integrations/pagerduty' },

  // Ticketing
  jira:          { category: 'ticketing',  automatesControls: ['CC9.2'], setupUrl: '/integrations/jira' },
  linear:        { category: 'ticketing',  automatesControls: ['CC9.2'], setupUrl: '/integrations/linear' },

  // HR
  workday:       { category: 'hr',         automatesControls: ['CC1.1', 'CC1.4', 'A.7.1', 'A.7.2'], setupUrl: '/integrations/workday' },
  bamboohr:      { category: 'hr',         automatesControls: ['CC1.1', 'A.7.1'], setupUrl: '/integrations/bamboohr' },
};

@Injectable()
export class IntegrationSuggestionsService {
  private readonly logger = new Logger(IntegrationSuggestionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build ranked integration suggestions from inference output.
   * Deterministic — same input → same output.
   */
  buildSuggestions(inference: InferenceOutput): IntegrationSuggestion[] {
    const suggestions: IntegrationSuggestion[] = [];

    // ── 1. Suggestions from expected_integrations (already inferred) ──────────
    for (const expected of inference.expected_integrations) {
      const suggestion = this.buildFromExpected(expected, inference);
      if (suggestion) suggestions.push(suggestion);
    }

    // ── 2. Additional suggestions from system_flags ───────────────────────────
    if (inference.system_flags.requires_mfa) {
      this.addIfMissing(suggestions, 'okta', 95, 'MFA enforcement required — Okta automates access controls CC6.1–CC6.3', inference);
    }

    if (inference.system_flags.requires_logging) {
      this.addIfMissing(suggestions, 'datadog', 85, 'Logging & monitoring required — Datadog automates CC7.2, CC7.3', inference);
    }

    if (inference.system_flags.requires_vendor_review) {
      this.addIfMissing(suggestions, 'jira', 60, 'Vendor risk workflow — Jira automates CC9.2 review tickets', inference);
    }

    // ── 3. Framework-specific additions ──────────────────────────────────────
    const hasSOC2 = inference.inferred_frameworks.some((f) => f.framework === 'SOC2');
    const hasISO = inference.inferred_frameworks.some((f) => f.framework === 'ISO27001');

    if (hasSOC2 || hasISO) {
      // Cloud evidence is essential for any framework
      this.addIfMissing(suggestions, 'aws', 80, 'Cloud infrastructure evidence automates CC6.6, CC7.1, A.12.1', inference);
    }

    if (hasSOC2) {
      // SOC2 requires code change management evidence
      this.addIfMissing(suggestions, 'github', 75, 'Change management evidence for CC8.1 (code review + PR approvals)', inference);
    }

    if (hasISO) {
      // ISO 27001 requires HR lifecycle evidence
      this.addIfMissing(suggestions, 'bamboohr', 70, 'HR onboarding/offboarding lifecycle evidence for A.7.1, A.7.2', inference);
    }

    // ── 4. Sort by relevance score descending ─────────────────────────────────
    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return suggestions;
  }

  /**
   * Persist suggestions to integration_suggestions table.
   * Idempotent — upsert on orgId + provider.
   */
  async persistSuggestions(orgId: string, suggestions: IntegrationSuggestion[]): Promise<void> {
    for (const suggestion of suggestions) {
      await (this.prisma as any).integrationSuggestion.upsert({
        where: { orgId_provider: { orgId, provider: suggestion.provider } },
        create: {
          orgId,
          provider: suggestion.provider,
          category: suggestion.category,
          reason: suggestion.reason,
          relevanceScore: suggestion.relevanceScore,
          automatesControls: suggestion.automatesControls,
          dismissed: false,
        },
        update: {
          reason: suggestion.reason,
          relevanceScore: suggestion.relevanceScore,
          automatesControls: suggestion.automatesControls,
        },
      });
    }
    this.logger.debug(`Persisted ${suggestions.length} integration suggestions for org: ${orgId}`);
  }

  /**
   * Get persisted suggestions for an org, sorted by relevance.
   */
  async getSuggestions(orgId: string): Promise<IntegrationSuggestion[]> {
    const rows = await (this.prisma as any).integrationSuggestion.findMany({
      where: { orgId, dismissed: false },
      orderBy: { relevanceScore: 'desc' },
    });

    return rows.map((r: any) => ({
      provider: r.provider,
      category: r.category,
      reason: r.reason,
      relevanceScore: r.relevanceScore,
      automatesControls: r.automatesControls ?? [],
      setupUrl: PROVIDER_METADATA[r.provider]?.setupUrl,
    }));
  }

  /**
   * Dismiss a suggestion (user chose not to connect this provider).
   */
  async dismiss(orgId: string, provider: string): Promise<void> {
    await (this.prisma as any).integrationSuggestion.updateMany({
      where: { orgId, provider },
      data: { dismissed: true },
    });
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildFromExpected(
    expected: ExpectedIntegration,
    _inference: InferenceOutput,
  ): IntegrationSuggestion | null {
    const meta = PROVIDER_METADATA[expected.provider];
    if (!meta) return null;

    return {
      provider: expected.provider,
      category: meta.category,
      reason: `Inferred from rule ${expected.triggered_by} — automates ${meta.automatesControls.slice(0, 3).join(', ')}`,
      relevanceScore: 90,
      automatesControls: meta.automatesControls,
      setupUrl: meta.setupUrl,
    };
  }

  private addIfMissing(
    suggestions: IntegrationSuggestion[],
    provider: string,
    score: number,
    reason: string,
    _inference: InferenceOutput,
  ): void {
    if (suggestions.some((s) => s.provider === provider)) return;
    const meta = PROVIDER_METADATA[provider];
    if (!meta) return;

    suggestions.push({
      provider,
      category: meta.category,
      reason,
      relevanceScore: score,
      automatesControls: meta.automatesControls,
      setupUrl: meta.setupUrl,
    });
  }
}
