import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PromptTemplate } from '../prompts/prompt.interfaces';
import { ONBOARDING_PROMPT_V1 } from '../prompts/onboarding/onboarding-v1.prompt';
import { POLICY_GENERATOR_PROMPT_V1 } from '../prompts/policy/policy-generator-v1.prompt';
import { GAP_ANALYSIS_PROMPT_V1 } from '../prompts/gap-analysis/gap-analysis-v1.prompt';
import { RISK_REGISTER_PROMPT_V1 } from '../prompts/risk/risk-register-v1.prompt';
import { EVIDENCE_COLLECTOR_PROMPT_V1 } from '../prompts/evidence/evidence-collector-v1.prompt';
import { ROADMAP_PROMPT_V1 } from '../prompts/planner/roadmap-v1.prompt';
import { AUDIT_REPORT_PROMPT_V1 } from '../prompts/audit/audit-report-v1.prompt';
import { REVIEW_PROMPT_V1 } from '../prompts/review/review-v1.prompt';
import { TASK_GENERATOR_PROMPT_V1 } from '../prompts/task/task-generator-v1.prompt';
import { SCOPING_PROMPT_V1 } from '../prompts/scoping/scoping-v1.prompt';
import { EVIDENCE_VALIDATOR_PROMPT_V1 } from '../prompts/validator/evidence-validator-v1.prompt';
import { BENCHMARK_PROMPT_V1 } from '../prompts/benchmark/benchmark-v1.prompt';
import { INTERVIEW_PROMPT_V1 } from '../prompts/interview/interview-v1.prompt';
import { THREAT_INTEL_PROMPT_V1 } from '../prompts/threat-intel/threat-intel-v1.prompt';
import { VENDOR_RISK_PROMPT_V1 } from '../prompts/vendor-risk/vendor-risk-v1.prompt';
import { REMEDIATION_ADVISOR_PROMPT_V1 } from '../prompts/remediation-advisor/remediation-advisor-v1.prompt';
import { DRIFT_DETECTOR_PROMPT_V1 } from '../prompts/drift-detector/drift-detector-v1.prompt';
import { DASHBOARD_PROMPT_V1 } from '../prompts/dashboard/dashboard-v1.prompt';
import { DIALOGUE_QUESTION_PROMPT_V1 } from '../prompts/onboarding/dialogue-question-v1.prompt';
import { INFERENCE_RATIONALE_V1 } from '../prompts/inference/inference-rationale-v1.prompt';
import { ONBOARDING_NEXT_QUESTION_V1 } from '../prompts/onboarding/onboarding-next-question-v1.prompt';
import { ONBOARDING_CHAT_V2 } from '../prompts/onboarding/onboarding-chat-v2.prompt';

export class PolicyViolationException extends Error {
  constructor(message: string) {
    super(`[PolicyViolation] ${message}`);
    this.name = 'PolicyViolationException';
  }
}

const ALL_PROMPTS: PromptTemplate[] = [
  ONBOARDING_PROMPT_V1,
  POLICY_GENERATOR_PROMPT_V1,
  GAP_ANALYSIS_PROMPT_V1,
  RISK_REGISTER_PROMPT_V1,
  EVIDENCE_COLLECTOR_PROMPT_V1,
  ROADMAP_PROMPT_V1,
  AUDIT_REPORT_PROMPT_V1,
  REVIEW_PROMPT_V1,
  TASK_GENERATOR_PROMPT_V1,
  SCOPING_PROMPT_V1,
  EVIDENCE_VALIDATOR_PROMPT_V1,
  BENCHMARK_PROMPT_V1,
  INTERVIEW_PROMPT_V1,
  THREAT_INTEL_PROMPT_V1,
  VENDOR_RISK_PROMPT_V1,
  REMEDIATION_ADVISOR_PROMPT_V1,
  DRIFT_DETECTOR_PROMPT_V1,
  DASHBOARD_PROMPT_V1,
  DIALOGUE_QUESTION_PROMPT_V1,
  INFERENCE_RATIONALE_V1,
  ONBOARDING_NEXT_QUESTION_V1,
  ONBOARDING_CHAT_V2,
];

@Injectable()
export class PromptRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PromptRegistryService.name);
  private readonly registry = new Map<string, PromptTemplate & { contentHash: string }>();

  onModuleInit() {
    this.loadAll();
  }

  private loadAll() {
    for (const template of ALL_PROMPTS) {
      const key = this.makeKey(template.templateId, template.version);
      if (this.registry.has(key)) {
        throw new Error(`Duplicate prompt template: ${key}`);
      }
      const contentHash = this.hash(template.systemPrompt);
      this.registry.set(key, { ...template, contentHash });
      this.logger.debug(`Loaded prompt: ${key} (hash: ${contentHash.slice(0, 8)})`);
    }
    this.logger.log(`Prompt registry loaded ${this.registry.size} templates`);
  }

  /**
   * Get a prompt template by ID + version.
   * Throws PolicyViolationException if not found (agents must use registered prompts).
   */
  get(templateId: string, version = 'v1'): PromptTemplate & { contentHash: string } {
    const key = this.makeKey(templateId, version);
    const template = this.registry.get(key);
    if (!template) {
      throw new PolicyViolationException(
        `Prompt template '${key}' not found in registry. All prompts must be registered. Available: ${this.listIds().join(', ')}`,
      );
    }
    return template;
  }

  /**
   * Get latest version of a template (useful when agents don't pin version).
   */
  getLatest(templateId: string): PromptTemplate & { contentHash: string } {
    // Find the highest version for this templateId
    const matches = Array.from(this.registry.entries())
      .filter(([k]) => k.startsWith(`${templateId}:`))
      .sort(([a], [b]) => b.localeCompare(a)); // desc sort

    if (matches.length === 0) {
      throw new PolicyViolationException(
        `No prompt template found for '${templateId}'. Available: ${this.listIds().join(', ')}`,
      );
    }
    return matches[0][1];
  }

  /**
   * Render a prompt template by replacing {{variable}} placeholders.
   */
  render(templateId: string, version: string, variables: Record<string, string>): {
    systemPrompt: string;
    userPrompt: string;
    contentHash: string;
    templateId: string;
    version: string;
  } {
    const template = this.get(templateId, version);

    let userPrompt = template.userPromptTemplate ?? '';
    for (const [key, value] of Object.entries(variables)) {
      userPrompt = userPrompt.replaceAll(`{{${key}}}`, value ?? '');
    }

    // Check for unresolved variables
    const unresolved = userPrompt.match(/\{\{[^}]+\}\}/g);
    if (unresolved?.length) {
      this.logger.warn(`Unresolved template variables in ${templateId}:${version}: ${unresolved.join(', ')}`);
    }

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
      contentHash: template.contentHash,
      templateId,
      version,
    };
  }

  /**
   * List all registered template IDs.
   */
  listIds(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * Get all templates (for admin listing).
   */
  listAll(): Array<PromptTemplate & { contentHash: string }> {
    return Array.from(this.registry.values());
  }

  private makeKey(templateId: string, version: string): string {
    return `${templateId}:${version}`;
  }

  private hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}
