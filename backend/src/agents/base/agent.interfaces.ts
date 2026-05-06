import { BusinessProfile } from '../types/business-profile.type';

// Re-export the formal contract types so agents only need one import
export type {
  AgentExecutionContext,
  WorkflowStepDecision,
  WorkflowStepStatus,
  HumanReviewDecision,
  ComplianceAgentContract,
  AgentContextRequirement,
  AgentTaskType,
  ControlRef,
  FrameworkVersionRef,
} from './agent-contract.interfaces';

export {
  AgentJobDataSchema,
  AgentOutputSchema,
  FORBIDDEN_CERTIFICATION_PHRASES,
  AUDIT_DISCLAIMER,
} from './agent-contract.interfaces';

// ─── Legacy job data shape (kept for backwards compatibility) ────────────────
// Runtime validation uses AgentJobDataSchema (Zod) in base.agent.ts

export interface AgentJobData {
  workflowId: string;
  journeyId: string;          // Compliance journey this job belongs to
  orgId: string;
  runId?: string;             // Pre-created run ID for replay
  businessProfile: BusinessProfile;
  inputPayload: Record<string, unknown>;
  stepIndex?: number;
  isReplay?: boolean;
}

export interface AgentOutput {
  success: boolean;
  data: Record<string, unknown>;
  nextAgentInput?: Record<string, unknown>; // Passed directly to next agent in pipeline
  errors?: string[];
  warnings?: string[];
  runId?: string;             // Attached by execute() for processor use
}

export interface StepRecord {
  stepName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
}
