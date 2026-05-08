export const QUEUE_NAMES = {
  WORKFLOW:          'workflow',
  DOCUMENTS:         'documents',     // Background document jobs (PDF import, AI gaps, bulk export)
  AGENT_ONBOARDING:  'agent.onboarding',
  AGENT_INFERENCE: 'agent.inference',
  AGENT_SCOPING: 'agent.scoping',
  AGENT_CONTROL_MAPPER: 'agent.control_mapper',
  AGENT_PLANNER: 'agent.planner',
  AGENT_GAP_ANALYSIS: 'agent.gap_analysis',
  AGENT_POLICY: 'agent.policy',
  AGENT_EVIDENCE: 'agent.evidence',
  AGENT_DRIFT: 'agent.drift',          // legacy alias
  AGENT_DRIFT_DETECTOR: 'agent.drift', // canonical name used by workflow engine
  AGENT_VALIDATOR: 'agent.validator',
  AGENT_RISK_SCORING: 'agent.risk_scoring',
  AGENT_REVIEW: 'agent.review',
  AGENT_REMEDIATION: 'agent.remediation',
  AGENT_THREAT_INTEL: 'agent.threat_intel',
  AGENT_VENDOR_RISK: 'agent.vendor_risk',
  AGENT_TASK: 'agent.task',
  AGENT_INTERVIEW: 'agent.interview',
  AGENT_BENCHMARK: 'agent.benchmark',
  AGENT_AUDIT: 'agent.audit',
  AGENT_DASHBOARD: 'agent.dashboard',
} as const;

// Full assessment pipeline order (matches PIPELINE in workflow.engine.ts)
export const FULL_PIPELINE: Array<keyof typeof QUEUE_NAMES> = [
  'AGENT_INFERENCE',
  'AGENT_SCOPING',
  'AGENT_CONTROL_MAPPER',
  'AGENT_PLANNER',
  'AGENT_GAP_ANALYSIS',
  'AGENT_POLICY',
  'AGENT_EVIDENCE',
  'AGENT_DRIFT_DETECTOR',
  'AGENT_VALIDATOR',
  'AGENT_RISK_SCORING',
  'AGENT_REVIEW',
  'AGENT_REMEDIATION',
  'AGENT_THREAT_INTEL',
  'AGENT_VENDOR_RISK',
  'AGENT_TASK',
  'AGENT_INTERVIEW',
  'AGENT_BENCHMARK',
  'AGENT_AUDIT',
  'AGENT_DASHBOARD',
];

export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};
