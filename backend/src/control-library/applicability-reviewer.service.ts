import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';

interface ApplicabilityBatchItem {
  id: string;          // ControlApplicability.id
  controlId: string;
  code: string;
  title: string;
  description: string | null;
  category: string | null;
  currentStatus: string;
  rationale: string | null;
}

interface AiApplicabilityResult {
  code: string;
  applicabilityStatus: 'applicable' | 'not_applicable' | 'partial';
  companySpecificNotes: string;
  implementationContext: string;
  aiPriority: 'critical' | 'high' | 'medium' | 'low';
  aiConfidence: number;
  requiresHumanReview: boolean;
}

/**
 * ApplicabilityReviewerService — AI enrichment layer on top of the deterministic
 * ControlApplicabilityEngine. Adds company-specific notes, implementation context,
 * and priority rankings to each control applicability record.
 *
 * Uses claude-haiku-3-5 for cost efficiency (165 controls = ~13k tokens total).
 */
@Injectable()
export class ApplicabilityReviewerService {
  private readonly logger = new Logger(ApplicabilityReviewerService.name);
  private readonly BATCH_SIZE = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /**
   * Enrich all applicability records for an org with AI-generated notes.
   * Called after the deterministic ControlApplicabilityEngine runs.
   */
  async enrichForOrg(orgId: string): Promise<{ enriched: number; errors: number }> {
    // 1. Load org's business profile
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      this.logger.warn(`ApplicabilityReviewer: no business profile for org ${orgId}, skipping`);
      return { enriched: 0, errors: 0 };
    }

    // 2. Load all applicability records with control info
    const records = await this.prisma.controlApplicability.findMany({
      where: { orgId },
      include: {
        control: {
          include: { framework: true },
        },
      },
    });

    if (records.length === 0) {
      this.logger.log(`ApplicabilityReviewer: no applicability records found for org ${orgId}`);
      return { enriched: 0, errors: 0 };
    }

    // 3. Build profile summary for the LLM prompt
    const profileSummary = this.buildProfileSummary(profile as any);

    // 4. Process in batches
    let enriched = 0;
    let errors = 0;

    const batches = this.chunkArray(records, this.BATCH_SIZE);
    this.logger.log(`ApplicabilityReviewer: enriching ${records.length} controls in ${batches.length} batches for org ${orgId}`);

    for (const batch of batches) {
      try {
        const items: ApplicabilityBatchItem[] = batch.map((r: any) => ({
          id: r.id,
          controlId: r.controlId,
          code: r.control.code,
          title: r.control.title,
          description: r.control.description,
          category: r.control.category,
          currentStatus: r.applicabilityStatus,
          rationale: r.rationale,
        }));

        const results = await this.callLlmBatch(profileSummary, items);
        await this.persistResults(orgId, items, results);
        enriched += results.length;
      } catch (err: any) {
        this.logger.error(`ApplicabilityReviewer batch error: ${err.message}`);
        errors += batch.length;
      }
    }

    this.logger.log(`ApplicabilityReviewer: done — enriched ${enriched}, errors ${errors}`);
    return { enriched, errors };
  }

  /**
   * Re-evaluate a single org's applicability — called from the REST endpoint.
   * Same as enrichForOrg but logs separately for observability.
   */
  async reEvaluate(orgId: string): Promise<{ enriched: number; errors: number; startedAt: Date }> {
    const startedAt = new Date();
    const result = await this.enrichForOrg(orgId);
    return { ...result, startedAt };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async callLlmBatch(
    profileSummary: string,
    items: ApplicabilityBatchItem[],
  ): Promise<AiApplicabilityResult[]> {
    const controlsList = items
      .map((i) => `${i.code}: ${i.title}${i.description ? ` — ${i.description.slice(0, 150)}` : ''}`)
      .join('\n');

    const systemPrompt = `You are a compliance expert assessing whether ISO 27001 and SOC 2 controls apply to a specific company. Be concise and specific to the company's actual situation. Return ONLY valid JSON.`;

    const userPrompt = `Company profile:
${profileSummary}

For each compliance control below, provide a JSON assessment. Use the company profile to give SPECIFIC, ACTIONABLE notes — not generic compliance text.

Controls to assess:
${controlsList}

Return a JSON array (no markdown, no explanation, just the array):
[
  {
    "code": "<control code>",
    "applicabilityStatus": "applicable" | "not_applicable" | "partial",
    "companySpecificNotes": "<1-2 sentences specific to THIS company — mention their industry/stack/data>",
    "implementationContext": "<1-2 sentences on what implementation looks like for THEIR tech stack>",
    "aiPriority": "critical" | "high" | "medium" | "low",
    "aiConfidence": <0-100>,
    "requiresHumanReview": <true if edge case or significant uncertainty>
  }
]`;

    const raw = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { agentName: 'control-mapper', temperature: 0.15 },
    );

    const cleaned = raw.content
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const parsed: AiApplicabilityResult[] = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  }

  private async persistResults(
    orgId: string,
    items: ApplicabilityBatchItem[],
    results: AiApplicabilityResult[],
  ): Promise<void> {
    const resultMap = new Map(results.map((r) => [r.code, r]));

    const updates = items
      .map((item) => ({ item, result: resultMap.get(item.code) }))
      .filter((x): x is { item: ApplicabilityBatchItem; result: AiApplicabilityResult } => !!x.result);

    await Promise.all(
      updates.map(({ item, result }) =>
        this.prisma.controlApplicability.update({
          where: { id: item.id },
          data: {
            companySpecificNotes: result.companySpecificNotes,
            aiGeneratedRationale: result.companySpecificNotes,
            implementationContext: result.implementationContext,
            aiPriority: result.aiPriority,
            aiConfidence: Math.max(0, Math.min(100, result.aiConfidence)),
            aiAssessedAt: new Date(),
            aiModelUsed: 'claude-haiku-3-5',
            requiresHumanReview: result.requiresHumanReview,
            // Only update applicabilityStatus if AI has high confidence and not needs_review
            ...(result.aiConfidence >= 80 && item.currentStatus === 'needs_review'
              ? { applicabilityStatus: result.applicabilityStatus }
              : {}),
          },
        }),
      ),
    );
  }

  private buildProfileSummary(profile: any): string {
    const infra = profile.infrastructure ?? {};
    const data = profile.dataHandling ?? {};
    const posture = profile.currentPosture ?? {};
    const goals = profile.complianceGoals ?? {};

    const lines: string[] = [
      `- Company: ${profile.companyName ?? 'Unknown'} (${profile.companyType ?? 'startup'})`,
      `- Industry: ${profile.industry ?? 'saas'}${profile.subIndustry ? ` / ${profile.subIndustry}` : ''}`,
      `- Size: ${profile.employeeCount ?? 'unknown'} employees, ${profile.engineeringCount ?? 'unknown'} engineers`,
      `- Headquarters: ${profile.hqCountry ?? 'unknown'}, operates in: ${(profile.operatesIn ?? []).join(', ') || 'unknown'}`,
      `- Cloud providers: ${(infra.cloudProviders ?? []).join(', ') || 'none specified'}`,
      `- Databases: ${(infra.keyDatabases ?? []).join(', ') || 'none specified'}`,
      `- Identity provider: ${posture.identityProvider ?? 'unknown'}, MFA: ${posture.usesMfa ?? false}, SSO: ${posture.hasSso ?? false}`,
      `- Data types: ${(data.dataTypes ?? []).join(', ') || 'none specified'}`,
      `- GDPR exposure: ${data.gdprExposure ?? false}, HIPAA scope: ${data.hipaaScope ?? false}`,
      `- Compliance goals: ${(goals.frameworks ?? []).join(', ') || 'soc2'}, driver: ${goals.driver ?? 'unknown'}`,
      `- Has security team: ${posture.hasSecurityTeam ?? false}, has incident response: ${posture.hasIncidentResponsePlan ?? false}`,
      `- Has existing policies: ${posture.hasExistingPolicies ?? false}`,
    ];

    return lines.join('\n');
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
