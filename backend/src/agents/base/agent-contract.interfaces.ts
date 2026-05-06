/**
 * AGENT RUNTIME CONTRACT
 * ─────────────────────────────────────────────────────────────────────────────
 * Every agent in the compliance pipeline must conform to this contract.
 *
 * Enforcement rules (non-negotiable):
 *  1. No agent may call an LLM provider directly — all LLM calls go through
 *     LlmGatewayService.call() with a registered promptTemplateId.
 *  2. No agent may use inline prompts — all prompts live in /src/prompts/.
 *  3. Deterministic agents must declare usesLlm = false.
 *  4. Every agent must validate its input at runtime (Zod or class-validator).
 *  5. Every agent must write AgentRun + AgentStep records for replay support.
 *  6. Every agent must include organizationId in all DB writes (tenant isolation).
 *  7. No agent may call another agent directly — only via the orchestrator queue.
 *  8. Human-review decisions must be surfaced through HumanCheckpoint records.
 *  9. No agent output may contain forbidden certification language.
 * 10. Control IDs referenced in output must exist in the Control Library.
 */

import { z, ZodSchema } from 'zod';
import { Logger } from '@nestjs/common';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { ControlLibraryService } from '../../control-library/control-library.service';

// ─── Core type enumerations ──────────────────────────────────────────────────

export type AgentTaskType =
  | 'onboarding'
  | 'compliance'
  | 'policy'
  | 'evidence_validation'
  | 'risk'
  | 'audit_export'
  | 'dashboard'
  | 'deterministic'; // no LLM

export type WorkflowStepStatus = 'continue' | 'wait_for_human' | 'complete' | 'failed';

export type ApproverRole = 'admin' | 'security_lead' | 'executive' | 'legal';

// ─── Framework reference ─────────────────────────────────────────────────────

export interface FrameworkVersionRef {
  frameworkType: 'SOC2' | 'ISO27001';
  version: string; // e.g. 'SOC2:2017', 'ISO27001:2022'
}

// ─── Control reference ───────────────────────────────────────────────────────

export interface ControlRef {
  controlId: string; // UUID in the DB
  code: string;      // e.g. 'CC6.1', 'A.8.24'
  framework: 'SOC2' | 'ISO27001';
}

// ─── Agent execution context ─────────────────────────────────────────────────

/**
 * Rich execution context passed alongside job data.
 * Services that agents may need are injected here — agents must NOT
 * inject them as direct NestJS dependencies (except what BaseAgent provides).
 */
export interface AgentExecutionContext {
  /** Tenant identifier — must be applied to every DB write */
  organizationId: string;
  /** User who triggered the workflow, if known */
  userId?: string;
  /** Workflow record ID */
  workflowId: string;
  /** AgentRun record ID — unique per agent invocation */
  agentRunId: string;
  /**
   * Distributed trace ID for cross-service correlation.
   * Defaults to workflowId if not provided.
   */
  correlationId: string;
  /** Snapshot version of the BusinessProfile used for this run */
  businessProfileVersion?: number;
  /** Which framework versions are in scope for this assessment */
  frameworkVersions: FrameworkVersionRef[];
  /** Compliance-aware LLM Gateway — the only permitted way to call LLMs */
  llmGateway: LlmGatewayService;
  /** Control Library — for validation, lookup, and cross-framework mapping */
  controlLibrary: ControlLibraryService;
  /** Logger scoped to this agent's class */
  logger: Logger;
}

// ─── Workflow step decision ───────────────────────────────────────────────────

/**
 * Returned by getNextStep() to guide the orchestrator.
 * Agents do NOT call other agents directly — they return a decision,
 * and the WorkflowEngine advances the pipeline.
 */
export interface WorkflowStepDecision {
  /** BullMQ queue name for the next agent, if known (optional — orchestrator has pipeline) */
  nextQueue?: string;
  /** Pipeline advancement decision */
  status: WorkflowStepStatus;
  /** Human-readable reason for status (especially for wait_for_human / failed) */
  reason?: string;
  /** Which roles must approve before the pipeline continues */
  requiredApprovals?: ApproverRole[];
}

// ─── Human review decision ───────────────────────────────────────────────────

/**
 * Returned by getHumanReviewRequirement() to signal whether a checkpoint
 * must be created before advancing the pipeline.
 */
export interface HumanReviewDecision {
  /** Whether human review is required for this output */
  required: boolean;
  /** Why human review is needed */
  reason?: string;
  /** Which roles may approve */
  approverRoles?: ApproverRole[];
  /** Which controls are implicated in the review decision */
  relatedControls?: ControlRef[];
}

// ─── Agent context requirement descriptor ────────────────────────────────────

export interface AgentContextRequirement {
  /** What piece of context is required */
  type: 'business_profile' | 'scope' | 'controls' | 'evidence' | 'policies' | 'risks' | 'rag';
  /** Whether absence should fail the agent (vs. warn) */
  required: boolean;
  description: string;
}

// ─── Formal agent contract interface ─────────────────────────────────────────

/**
 * ComplianceAgentContract — the structural contract every agent must satisfy.
 *
 * TInput:  The validated, typed input the agent receives from the job queue.
 * TOutput: The validated, typed output the agent produces and persists.
 *
 * Concrete agents extend BaseAgent AND implement this contract.
 */
export interface ComplianceAgentContract<TInput, TOutput> {
  /** Unique agent name — matches agentName in agentMap and PIPELINE */
  readonly name: string;
  /** Semantic version of this agent's logic */
  readonly version: string;
  /** BullMQ queue name for this agent */
  readonly queueName: string;
  /** One-sentence description of what this agent does */
  readonly description: string;
  /** Whether this agent calls the LLM Gateway */
  readonly usesLlm: boolean;
  /** Task type for context packing and routing */
  readonly taskType: AgentTaskType;
  /** Prompt template ID — required if usesLlm = true */
  readonly promptTemplateId?: string;
  /** Zod schema for validating job input at runtime */
  readonly inputSchema: ZodSchema<TInput>;
  /** Zod schema for validating agent output at runtime */
  readonly outputSchema: ZodSchema<TOutput>;
  /** What context pieces this agent requires */
  readonly requiredContext: AgentContextRequirement[];

  /** Runtime input validation — throws ZodError if invalid */
  validateInput(raw: unknown): TInput;
  /** Runtime output validation — throws ZodError if invalid */
  validateOutput(raw: unknown): TOutput;
  /**
   * Orchestrator decision: should the pipeline continue, pause, or fail?
   * Called by the processor after a successful execute().
   */
  getNextStep(output: TOutput, context: AgentExecutionContext): WorkflowStepDecision;
  /**
   * Human review gate: must a checkpoint be created before advancing?
   * Called after getNextStep() when status = 'continue'.
   */
  getHumanReviewRequirement(output: TOutput, context: AgentExecutionContext): HumanReviewDecision;
}

// ─── Zod schemas for AgentJobData (runtime validation) ───────────────────────

/**
 * Runtime-validated job data schema.
 * Applied in BaseAgent.execute() before calling process().
 */
export const AgentJobDataSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
  journeyId: z.string().min(1, 'journeyId is required'),
  orgId: z.string().min(1, 'orgId is required'),
  runId: z.string().optional(),
  isReplay: z.boolean().optional().default(false),
  inputPayload: z.record(z.string(), z.unknown()).default({}),
  businessProfile: z.record(z.string(), z.unknown()).optional(),
  stepIndex: z.number().int().optional(),
});

export type ValidatedJobData = z.infer<typeof AgentJobDataSchema>;

// ─── Zod schema for AgentOutput (runtime validation) ─────────────────────────

export const AgentOutputSchema = z.object({
  success: z.boolean(),
  data: z.record(z.string(), z.unknown()),
  nextAgentInput: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  runId: z.string().optional(),
});

// ─── Forbidden language constants ─────────────────────────────────────────────

/**
 * These strings must NEVER appear in agent output data or LLM responses.
 * The LlmGatewayService checks these, but agents should also avoid them
 * in any text they construct directly.
 */
export const FORBIDDEN_CERTIFICATION_PHRASES = [
  'certified',
  'ISO certified',
  'SOC 2 certified',
  'passed SOC 2',
  'guaranteed compliance',
  'guaranteed audit success',
  'ISO 27001 certified',
  'audit passed',
] as const;

export const AUDIT_DISCLAIMER =
  'This output reflects internal readiness assessment only. ' +
  'It does not constitute an official SOC 2 audit opinion or ISO 27001 certification. ' +
  'Certification requires engagement with an accredited third-party auditor.';
