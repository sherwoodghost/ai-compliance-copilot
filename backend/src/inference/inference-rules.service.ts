import { Injectable } from '@nestjs/common';
import {
  OnboardingProfileInput,
  InferenceOutput,
  RuleResult,
  InferredFramework,
  RequiredControl,
  ExpectedIntegration,
  SystemFlags,
  DataClassification,
  RiskLevel,
  INFERENCE_ENGINE_VERSION,
  RISK_THRESHOLDS,
} from './inference.types';

/**
 * InferenceRulesService
 *
 * DETERMINISTIC ONLY. Zero LLM calls. Zero randomness.
 * Same input ALWAYS produces the same output.
 *
 * Rules R-001 through R-012 implement the full inference table.
 * engine_version bumps when rules change to trigger recomputation.
 */
@Injectable()
export class InferenceRulesService {

  evaluate(profile: OnboardingProfileInput): InferenceOutput {
    const ruleResults = this.evaluateAllRules(profile);

    // Aggregate
    const firedRules = ruleResults.filter((r) => r.fired);
    const riskScore = firedRules.reduce((sum, r) => sum + r.weight, 0);
    const riskLevel = this.computeRiskLevel(riskScore);

    // Collect effects
    const frameworks = new Map<string, InferredFramework>();
    const controls: RequiredControl[] = [];
    const integrations: ExpectedIntegration[] = [];
    const flags: SystemFlags = {
      requires_encryption: false,
      requires_mfa: false,
      requires_logging: false,
      requires_dpa: false,
      requires_vendor_review: false,
      requires_incident_response_plan: false,
    };
    let classification: DataClassification = 'PUBLIC';

    for (const rule of firedRules) {
      for (const effect of rule.effects) {
        switch (effect.type) {
          case 'framework': {
            const f = effect.payload as InferredFramework;
            if (!frameworks.has(f.framework)) {
              frameworks.set(f.framework, f);
            }
            break;
          }
          case 'control_flag': {
            const c = effect.payload as RequiredControl;
            if (!controls.some((x) => x.control_id === c.control_id)) {
              controls.push(c);
            }
            break;
          }
          case 'system_flag': {
            const f = effect.payload as Partial<SystemFlags>;
            Object.assign(flags, f);
            break;
          }
          case 'data_classification': {
            const lvl = effect.payload.level as DataClassification;
            classification = this.maxClassification(classification, lvl);
            break;
          }
          case 'integration': {
            const i = effect.payload as ExpectedIntegration;
            if (!integrations.some((x) => x.provider === i.provider)) {
              integrations.push(i);
            }
            break;
          }
        }
      }
    }

    // Goals-based frameworks always win — override any inferred applicability
    // User selection REQUIRED > any rule-inferred RECOMMENDED/OPTIONAL
    if (profile.goals.target_frameworks.includes('SOC2')) {
      frameworks.set('SOC2', {
        framework: 'SOC2',
        applicability: 'REQUIRED',
        reason: 'Explicitly selected by organization as a target framework',
        triggered_by_rule_id: 'R-005',
      });
    }
    if (profile.goals.target_frameworks.includes('ISO27001')) {
      frameworks.set('ISO27001', {
        framework: 'ISO27001',
        applicability: 'REQUIRED',
        reason: 'Explicitly selected by organization as a target framework',
        triggered_by_rule_id: 'R-006',
      });
    }

    return {
      organization_id: profile.organization_id,
      onboarding_version: profile.onboarding_version ?? 1,
      risk_level: riskLevel,
      risk_score: riskScore,
      risk_drivers: firedRules.map((r) => ({
        rule_id: r.rule_id,
        weight: r.weight,
        rationale: r.rationale,
      })),
      inferred_frameworks: Array.from(frameworks.values()),
      data_classification: classification,
      required_controls: controls,
      expected_integrations: integrations,
      system_flags: flags,
      computed_at: new Date().toISOString(),
      engine_version: INFERENCE_ENGINE_VERSION,
    };
  }

  // ── Individual Rules ─────────────────────────────────────────────────────────

  private evaluateAllRules(p: OnboardingProfileInput): RuleResult[] {
    return [
      this.R001(p),
      this.R002(p),
      this.R003(p),
      this.R004(p),
      this.R005(p),
      this.R006(p),
      this.R007(p),
      this.R008(p),
      this.R009(p),
      this.R010(p),
      this.R011(p),
      this.R012(p),
    ];
  }

  /**
   * R-001: stores_pii && data_regions ∩ EU → GDPR REQUIRED
   */
  private R001(p: OnboardingProfileInput): RuleResult {
    const euCountries = ['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GR',
                         'HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE',
                         'SI','SK','EU'];
    const hasEuRegion = p.data_profile.data_regions.some((r) => euCountries.includes(r.toUpperCase()));
    const fired = p.data_profile.stores_pii && hasEuRegion;

    return {
      rule_id: 'R-001',
      fired,
      weight: fired ? 2 : 0,
      rationale: fired
        ? 'Organization processes PII with data residency in EU jurisdictions — GDPR applies'
        : 'No EU PII data residency detected',
      effects: fired
        ? [
            {
              type: 'framework',
              payload: {
                framework: 'GDPR',
                applicability: 'REQUIRED',
                reason: 'PII data processed in EU regions',
                triggered_by_rule_id: 'R-001',
              } as InferredFramework,
            },
            {
              type: 'system_flag',
              payload: { requires_dpa: true },
            },
          ]
        : [],
    };
  }

  /**
   * R-002: stores_health_data → HIPAA REQUIRED, classification=SENSITIVE
   */
  private R002(p: OnboardingProfileInput): RuleResult {
    const fired = p.data_profile.stores_health_data;
    return {
      rule_id: 'R-002',
      fired,
      weight: fired ? 3 : 0,
      rationale: fired
        ? 'Organization stores health data — HIPAA regulatory requirements apply'
        : 'No health data storage detected',
      effects: fired
        ? [
            {
              type: 'framework',
              payload: {
                framework: 'HIPAA',
                applicability: 'REQUIRED',
                reason: 'Health data storage triggers HIPAA requirements',
                triggered_by_rule_id: 'R-002',
              } as InferredFramework,
            },
            {
              type: 'data_classification',
              payload: { level: 'SENSITIVE' as DataClassification },
            },
          ]
        : [],
    };
  }

  /**
   * R-003: stores_financial_data → risk+=2, classification≥CONFIDENTIAL, +PCI if cards
   */
  private R003(p: OnboardingProfileInput): RuleResult {
    const fired = p.data_profile.stores_financial_data;
    return {
      rule_id: 'R-003',
      fired,
      weight: fired ? 2 : 0,
      rationale: fired
        ? 'Financial data storage increases risk posture and requires CONFIDENTIAL data classification'
        : 'No financial data storage detected',
      effects: fired
        ? [
            {
              type: 'data_classification',
              payload: { level: 'CONFIDENTIAL' as DataClassification },
            },
            {
              type: 'framework',
              payload: {
                framework: 'PCI',
                applicability: 'RECOMMENDED',
                reason: 'Financial data handling may require PCI DSS compliance if card data is processed',
                triggered_by_rule_id: 'R-003',
              } as InferredFramework,
            },
          ]
        : [],
    };
  }

  /**
   * R-004: product_type = SaaS → requires_logging=true, +SOC2 RECOMMENDED
   */
  private R004(p: OnboardingProfileInput): RuleResult {
    const fired = p.company_profile.product_type === 'SaaS';
    return {
      rule_id: 'R-004',
      fired,
      weight: fired ? 1 : 0,
      rationale: fired
        ? 'SaaS product type requires comprehensive logging and audit trails for customer trust'
        : 'Non-SaaS product type',
      effects: fired
        ? [
            {
              type: 'system_flag',
              payload: { requires_logging: true },
            },
            {
              type: 'framework',
              payload: {
                framework: 'SOC2',
                applicability: 'RECOMMENDED',
                reason: 'SaaS companies typically need SOC 2 for enterprise customer sales',
                triggered_by_rule_id: 'R-004',
              } as InferredFramework,
            },
          ]
        : [],
    };
  }

  /**
   * R-005: target_frameworks includes SOC2 → SOC2 REQUIRED, CC1–CC9 applicable
   */
  private R005(p: OnboardingProfileInput): RuleResult {
    const fired = p.goals.target_frameworks.includes('SOC2');
    return {
      rule_id: 'R-005',
      fired,
      weight: fired ? 0 : 0, // framework selection adds no risk — it's a goal
      rationale: fired
        ? 'SOC 2 explicitly selected as target framework — all CC1–CC9 trust service criteria apply'
        : 'SOC 2 not selected as target framework',
      effects: fired
        ? [
            {
              type: 'framework',
              payload: {
                framework: 'SOC2',
                applicability: 'REQUIRED',
                reason: 'Explicitly selected as target framework',
                triggered_by_rule_id: 'R-005',
              } as InferredFramework,
            },
            ...this.soc2CoreControls(),
          ]
        : [],
    };
  }

  /**
   * R-006: target_frameworks includes ISO27001 → ISO27001 REQUIRED, A.5–A.18 applicable
   */
  private R006(p: OnboardingProfileInput): RuleResult {
    const fired = p.goals.target_frameworks.includes('ISO27001');
    return {
      rule_id: 'R-006',
      fired,
      weight: fired ? 0 : 0,
      rationale: fired
        ? 'ISO 27001 explicitly selected as target framework — annex A controls A.5–A.18 apply'
        : 'ISO 27001 not selected as target framework',
      effects: fired
        ? [
            {
              type: 'framework',
              payload: {
                framework: 'ISO27001',
                applicability: 'REQUIRED',
                reason: 'Explicitly selected as target framework',
                triggered_by_rule_id: 'R-006',
              } as InferredFramework,
            },
            ...this.iso27001CoreControls(),
          ]
        : [],
    };
  }

  /**
   * R-007: !enforces_mfa && stores_pii → risk+=3, requires_mfa=true, flag CC6.3/A.9.4.2
   */
  private R007(p: OnboardingProfileInput): RuleResult {
    const fired = !p.access_control.enforces_mfa && p.data_profile.stores_pii;
    return {
      rule_id: 'R-007',
      fired,
      weight: fired ? 3 : 0,
      rationale: fired
        ? 'MFA not enforced while PII is stored — highest single risk factor; unauthorized access risk is critical'
        : 'MFA enforced or no PII storage',
      effects: fired
        ? [
            {
              type: 'system_flag',
              payload: { requires_mfa: true },
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'SOC2',
                control_id: 'CC6.3',
                control_category: 'Logical and Physical Access',
                reason: 'MFA not enforced — CC6.3 role-based access control requires MFA',
              } as RequiredControl,
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.9.4',
                control_category: 'Access Control',
                reason: 'MFA not enforced — A.9.4 system and application access control requires strong authentication',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  /**
   * R-008: uses_third_parties && vendors_process_data → requires_vendor_review, +CC9.2/A.5.19
   */
  private R008(p: OnboardingProfileInput): RuleResult {
    const fired = p.vendors.uses_third_parties && p.vendors.vendors_process_data;
    return {
      rule_id: 'R-008',
      fired,
      weight: fired ? 1 : 0,
      rationale: fired
        ? 'Third-party vendors process company data — vendor risk assessments and DPAs are required'
        : 'No data-processing third parties detected',
      effects: fired
        ? [
            {
              type: 'system_flag',
              payload: { requires_vendor_review: true },
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'SOC2',
                control_id: 'CC9.2',
                control_category: 'Risk Mitigation',
                reason: 'Vendor data processing requires CC9.2 vendor risk management',
              } as RequiredControl,
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.5.19',
                control_category: 'Supplier Relationships',
                reason: 'Vendor data processing requires A.5.19 information security in supplier relationships',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  /**
   * R-009: company_size = 200+ → risk+=1, formal policies required
   */
  private R009(p: OnboardingProfileInput): RuleResult {
    const fired = p.company_profile.company_size === '200+';
    return {
      rule_id: 'R-009',
      fired,
      weight: fired ? 1 : 0,
      rationale: fired
        ? 'Large organization (200+ employees) has elevated risk from scale and complexity — formal policies are mandatory'
        : 'Organization size does not trigger elevated policy requirements',
      effects: fired
        ? [
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.5.1',
                control_category: 'Information Security Policies',
                reason: 'Large organization requires formal, management-approved information security policies',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  /**
   * R-010: !has_backups → risk+=2, flag A.8.13/A1.2
   */
  private R010(p: OnboardingProfileInput): RuleResult {
    const fired = !p.infrastructure.has_backups;
    return {
      rule_id: 'R-010',
      fired,
      weight: fired ? 2 : 0,
      rationale: fired
        ? 'No backup strategy detected — data loss risk is elevated; business continuity requirements not met'
        : 'Backup strategy in place',
      effects: fired
        ? [
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.12.3',
                control_category: 'Operations Security',
                reason: 'No backups — A.12.3 requires regular backup of information',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  /**
   * R-011: !encryption_at_rest → risk+=2, requires_encryption=true, flag CC6.1/A.8.24
   */
  private R011(p: OnboardingProfileInput): RuleResult {
    const fired = !p.data_profile.encryption_at_rest;
    return {
      rule_id: 'R-011',
      fired,
      weight: fired ? 2 : 0,
      rationale: fired
        ? 'Data not encrypted at rest — critical security control gap; data breach impact is significantly elevated'
        : 'Encryption at rest is implemented',
      effects: fired
        ? [
            {
              type: 'system_flag',
              payload: { requires_encryption: true },
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'SOC2',
                control_id: 'CC6.1',
                control_category: 'Logical and Physical Access',
                reason: 'No encryption at rest — CC6.1 requires encryption for protected information assets',
              } as RequiredControl,
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.10.1',
                control_category: 'Cryptography',
                reason: 'No encryption at rest — A.10.1 requires cryptographic controls for data protection',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  /**
   * R-012: !has_monitoring → risk+=1, flag CC7.2/A.8.16
   */
  private R012(p: OnboardingProfileInput): RuleResult {
    const fired = !p.infrastructure.has_monitoring;
    return {
      rule_id: 'R-012',
      fired,
      weight: fired ? 1 : 0,
      rationale: fired
        ? 'No monitoring solution detected — security incidents will go undetected; anomaly detection is not possible'
        : 'Monitoring solution in place',
      effects: fired
        ? [
            {
              type: 'system_flag',
              payload: { requires_logging: true },
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'SOC2',
                control_id: 'CC7.2',
                control_category: 'System Operations',
                reason: 'No monitoring — CC7.2 requires monitoring of system components for anomalies',
              } as RequiredControl,
            },
            {
              type: 'control_flag',
              payload: {
                framework: 'ISO27001',
                control_id: 'A.12.4',
                control_category: 'Operations Security',
                reason: 'No monitoring — A.12.4 requires logging and monitoring of events',
              } as RequiredControl,
            },
          ]
        : [],
    };
  }

  // ── Risk Level ───────────────────────────────────────────────────────────────

  computeRiskLevel(score: number): RiskLevel {
    if (score <= RISK_THRESHOLDS.LOW_MAX) return 'LOW';
    if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return 'MEDIUM';
    return 'HIGH';
  }

  // ── Control Helpers ──────────────────────────────────────────────────────────

  private soc2CoreControls() {
    const coreControls: Array<{ control_id: string; control_category: string }> = [
      { control_id: 'CC1.1', control_category: 'Control Environment' },
      { control_id: 'CC2.1', control_category: 'Communication and Information' },
      { control_id: 'CC3.1', control_category: 'Risk Assessment' },
      { control_id: 'CC4.1', control_category: 'Monitoring Activities' },
      { control_id: 'CC5.1', control_category: 'Control Activities' },
      { control_id: 'CC6.1', control_category: 'Logical and Physical Access' },
      { control_id: 'CC7.1', control_category: 'System Operations' },
      { control_id: 'CC8.1', control_category: 'Change Management' },
      { control_id: 'CC9.1', control_category: 'Risk Mitigation' },
    ];
    return coreControls.map((c) => ({
      type: 'control_flag' as const,
      payload: {
        framework: 'SOC2',
        control_id: c.control_id,
        control_category: c.control_category,
        reason: 'SOC 2 trust service criteria — applicable for all security-scope engagements',
      } as RequiredControl,
    }));
  }

  private iso27001CoreControls() {
    const coreControls: Array<{ control_id: string; control_category: string }> = [
      { control_id: 'A.5.1', control_category: 'Information Security Policies' },
      { control_id: 'A.6.1', control_category: 'Organisation of Information Security' },
      { control_id: 'A.7.1', control_category: 'Human Resource Security' },
      { control_id: 'A.8.1', control_category: 'Asset Management' },
      { control_id: 'A.9.1', control_category: 'Access Control' },
      { control_id: 'A.10.1', control_category: 'Cryptography' },
      { control_id: 'A.12.1', control_category: 'Operations Security' },
      { control_id: 'A.13.1', control_category: 'Communications Security' },
      { control_id: 'A.16.1', control_category: 'Information Security Incident Management' },
    ];
    return coreControls.map((c) => ({
      type: 'control_flag' as const,
      payload: {
        framework: 'ISO27001',
        control_id: c.control_id,
        control_category: c.control_category,
        reason: 'ISO 27001 Annex A — applicable for all ISMS certifications',
      } as RequiredControl,
    }));
  }

  // ── Utility ──────────────────────────────────────────────────────────────────

  private maxClassification(a: DataClassification, b: DataClassification): DataClassification {
    const order: DataClassification[] = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE'];
    return order.indexOf(a) >= order.indexOf(b) ? a : b;
  }
}
