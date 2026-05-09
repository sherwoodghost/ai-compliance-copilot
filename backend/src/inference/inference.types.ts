/**
 * Inference Engine Types
 *
 * All types used by the deterministic rules engine and its outputs.
 * InferenceOutput is the contract between inference and all downstream agents.
 */

export interface OnboardingProfileInput {
  organization_id: string;
  onboarding_version?: number;

  company_profile: {
    industry: string[];
    geography: string[];
    business_model: 'B2B' | 'B2C' | 'Both';
    company_size: '1-10' | '10-50' | '50-200' | '200+';
    product_type: 'SaaS' | 'API' | 'Marketplace' | 'Internal' | 'Other';
    criticality: 'Low' | 'Medium' | 'High';
  };

  data_profile: {
    stores_pii: boolean;
    stores_financial_data: boolean;
    stores_health_data: boolean;
    stores_credentials: boolean;
    data_regions: string[];               // ISO 3166-1 alpha-2
    encryption_at_rest: boolean;
    encryption_in_transit: boolean;
  };

  infrastructure: {
    cloud_provider: 'AWS' | 'Azure' | 'GCP' | 'Other' | 'Unknown';
    uses_ci_cd: boolean;
    has_logging: boolean;
    has_monitoring: boolean;
    has_backups: boolean;
  };

  access_control: {
    uses_sso: boolean;
    enforces_mfa: boolean;
    performs_access_reviews: boolean;
  };

  governance: {
    has_policies: boolean;
    policy_review_cycle: 'None' | 'Ad-hoc' | 'Annual' | 'Quarterly';
  };

  risk: {
    maintains_risk_register: boolean;
    known_high_risks: boolean;
  };

  vendors: {
    uses_third_parties: boolean;
    vendors_process_data: boolean;
  };

  goals: {
    target_frameworks: Array<'SOC2' | 'ISO27001' | 'HIPAA' | 'GDPR' | 'PCI_DSS' | 'FEDRAMP' | 'NIST_CSF' | 'ISO9001' | 'ISO14001' | 'ISO45001'>;
    audit_timeline: '0-3m' | '3-6m' | '6-12m' | '12m+' | null;
  };
}

export type Framework = 'SOC2' | 'ISO27001' | 'HIPAA' | 'GDPR' | 'PCI_DSS' | 'FEDRAMP' | 'NIST_CSF' | 'ISO9001' | 'ISO14001' | 'ISO45001';
export type FrameworkApplicability = 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SENSITIVE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RuleResult {
  rule_id: string;
  fired: boolean;
  weight: number;
  rationale: string;         // deterministic explanation (no LLM)
  effects: RuleEffect[];
}

export type RuleEffect =
  | { type: 'framework'; payload: InferredFramework }
  | { type: 'control_flag'; payload: RequiredControl }
  | { type: 'system_flag'; payload: Record<string, boolean> }
  | { type: 'data_classification'; payload: { level: DataClassification } }
  | { type: 'risk_delta'; payload: { delta: number } }
  | { type: 'integration'; payload: ExpectedIntegration };

export interface InferredFramework {
  framework: Framework;
  applicability: FrameworkApplicability;
  reason: string;
  triggered_by_rule_id: string;
}

export interface RequiredControl {
  framework: Framework;
  control_id: string;
  control_category: string;
  reason: string;
}

export interface ExpectedIntegration {
  provider: string;
  category: 'identity' | 'cloud' | 'code' | 'monitoring' | 'ticketing' | 'hr';
  triggered_by: string;
}

export interface SystemFlags {
  requires_encryption: boolean;
  requires_mfa: boolean;
  requires_logging: boolean;
  requires_dpa: boolean;
  requires_vendor_review: boolean;
  requires_incident_response_plan: boolean;
}

export interface InferenceOutput {
  organization_id: string;
  onboarding_version: number;
  risk_level: RiskLevel;
  risk_score: number;
  risk_drivers: Array<{ rule_id: string; weight: number; rationale: string }>;

  inferred_frameworks: InferredFramework[];
  data_classification: DataClassification;

  required_controls: RequiredControl[];
  expected_integrations: ExpectedIntegration[];
  system_flags: SystemFlags;

  computed_at: string;
  engine_version: string;
}

/** Engine version — bump whenever rules change to trigger recomputation */
export const INFERENCE_ENGINE_VERSION = '1.0.0';

/** Risk score thresholds */
export const RISK_THRESHOLDS = {
  LOW_MAX: 3,    // 0–3 → LOW
  MEDIUM_MAX: 7, // 4–7 → MEDIUM
                 // 8+  → HIGH
} as const;
