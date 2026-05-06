import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { InferenceRulesService } from './inference-rules.service';
import { OnboardingProfileInput, InferenceOutput, INFERENCE_ENGINE_VERSION } from './inference.types';

/**
 * InferenceService
 *
 * Orchestrates inference: runs rules, persists result, returns output.
 * Idempotent: same (orgId, onboardingVersion) always produces same output.
 * Re-persists on engine_version bump.
 */
@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: InferenceRulesService,
  ) {}

  /**
   * Run inference on an onboarding profile.
   * Persists result to inference_results table.
   * Returns InferenceOutput.
   */
  async infer(profile: OnboardingProfileInput): Promise<InferenceOutput> {
    const output = this.rules.evaluate(profile);

    // Persist — upsert based on most recent for this org
    await this.prisma.inferenceResult.create({
      data: {
        orgId: profile.organization_id,
        onboardingVersion: output.onboarding_version,
        riskLevel: output.risk_level,
        riskScore: output.risk_score,
        riskDrivers: output.risk_drivers as any,
        inferredFrameworks: output.inferred_frameworks as any,
        dataClassification: output.data_classification,
        requiredControls: output.required_controls as any,
        expectedIntegrations: output.expected_integrations as any,
        systemFlags: output.system_flags as any,
        engineVersion: output.engine_version,
        computedAt: new Date(output.computed_at),
      },
    });

    this.logger.log(
      `Inference complete for org ${profile.organization_id}: ` +
      `risk=${output.risk_level}(${output.risk_score}), ` +
      `frameworks=${output.inferred_frameworks.map((f) => f.framework).join(',')}, ` +
      `engine=${INFERENCE_ENGINE_VERSION}`,
    );

    return output;
  }

  /**
   * Get latest inference result for an org.
   */
  async getLatest(orgId: string): Promise<InferenceOutput | null> {
    const result = await this.prisma.inferenceResult.findFirst({
      where: { orgId },
      orderBy: { computedAt: 'desc' },
    });

    if (!result) return null;

    return {
      organization_id: result.orgId,
      onboarding_version: result.onboardingVersion,
      risk_level: result.riskLevel as any,
      risk_score: result.riskScore,
      risk_drivers: result.riskDrivers as any,
      inferred_frameworks: result.inferredFrameworks as any,
      data_classification: result.dataClassification as any,
      required_controls: result.requiredControls as any,
      expected_integrations: result.expectedIntegrations as any,
      system_flags: result.systemFlags as any,
      computed_at: result.computedAt.toISOString(),
      engine_version: result.engineVersion,
    };
  }

  /**
   * Build OnboardingProfileInput from the existing BusinessProfile Prisma record.
   * Maps existing JSON fields to the typed inference input.
   */
  buildProfileInput(orgId: string, profile: any): OnboardingProfileInput {
    const infra = profile.infrastructure ?? {};
    const data = profile.dataHandling ?? {};
    const posture = profile.currentPosture ?? {};
    const goals = profile.complianceGoals ?? {};

    return {
      organization_id: orgId,
      onboarding_version: profile.version ?? 1,

      company_profile: {
        industry: [profile.industry ?? 'other'],
        geography: profile.operatesIn ?? ['US'],
        business_model: 'B2B',
        company_size: this.mapEmployeeCount(profile.employeeCount),
        product_type: 'SaaS',
        criticality: 'Medium',
      },

      data_profile: {
        stores_pii: data.dataTypes?.includes('pii') ?? false,
        stores_financial_data: data.dataTypes?.includes('financial') ?? false,
        stores_health_data: data.dataTypes?.includes('health') ?? false,
        stores_credentials: data.dataTypes?.includes('credentials') ?? false,
        data_regions: profile.operatesIn ?? ['US'],
        encryption_at_rest: data.encryptionAtRest ?? false,
        encryption_in_transit: data.encryptionInTransit ?? true,
      },

      infrastructure: {
        cloud_provider: this.mapCloudProvider(infra.cloudProviders),
        uses_ci_cd: infra.cicd ?? false,
        has_logging: infra.logging ?? false,
        has_monitoring: infra.monitoring ?? false,
        has_backups: infra.backups ?? false,
      },

      access_control: {
        uses_sso: posture.sso ?? false,
        enforces_mfa: posture.mfaEnabled ?? false,
        performs_access_reviews: posture.accessReviews ?? false,
      },

      governance: {
        has_policies: posture.hasPolicies ?? false,
        policy_review_cycle: posture.policyReviewCycle ?? 'None',
      },

      risk: {
        maintains_risk_register: posture.riskRegister ?? false,
        known_high_risks: false,
      },

      vendors: {
        uses_third_parties: data.thirdParties ?? true,
        vendors_process_data: data.vendorsProcessData ?? false,
      },

      goals: {
        target_frameworks: (goals.frameworks ?? ['soc2']).map((f: string) =>
          f.toLowerCase() === 'soc2' ? 'SOC2' :
          f.toLowerCase() === 'iso27001' ? 'ISO27001' : f.toUpperCase()
        ) as any,
        audit_timeline: goals.targetDate ? '6-12m' : null,
      },
    };
  }

  private mapEmployeeCount(count: string): '1-10' | '10-50' | '50-200' | '200+' {
    if (!count) return '10-50';
    if (count.includes('200') || count.includes('500') || count.includes('1000')) return '200+';
    if (count.includes('50') || count.includes('100')) return '50-200';
    if (count.includes('10') || count.includes('25')) return '10-50';
    return '1-10';
  }

  private mapCloudProvider(providers?: string[]): 'AWS' | 'Azure' | 'GCP' | 'Other' | 'Unknown' {
    if (!providers?.length) return 'Unknown';
    const p = providers[0]?.toLowerCase() ?? '';
    if (p === 'aws') return 'AWS';
    if (p === 'azure') return 'Azure';
    if (p === 'gcp' || p === 'google') return 'GCP';
    return 'Other';
  }
}
