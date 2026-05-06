import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { QUEUE_NAMES } from '../queue.config';
import { WorkflowEngine } from '../workflow.engine';
import { AgentJobData } from '../../agents/base/agent.interfaces';
import { PlannerAgent } from '../../agents/planner/planner.agent';
import { GapAnalysisAgent } from '../../agents/gap-analysis/gap-analysis.agent';
import { PolicyAgent } from '../../agents/policy/policy.agent';
import { EvidenceAgent } from '../../agents/evidence/evidence.agent';
import { DriftDetectorAgent } from '../../agents/drift-detector/drift-detector.agent';
import { ValidatorAgent } from '../../agents/validator/validator.agent';
import { RiskScoringAgent } from '../../agents/risk-scoring/risk-scoring.agent';
import { ReviewAgent } from '../../agents/review/review.agent';
import { RemediationAdvisorAgent } from '../../agents/remediation-advisor/remediation-advisor.agent';
import { ThreatIntelAgent } from '../../agents/threat-intel/threat-intel.agent';
import { VendorRiskAgent } from '../../agents/vendor-risk/vendor-risk.agent';
import { TaskAgent } from '../../agents/task/task.agent';
import { InterviewAgent } from '../../agents/interview/interview.agent';
import { BenchmarkAgent } from '../../agents/benchmark/benchmark.agent';
import { AuditAgent } from '../../agents/audit/audit.agent';
import { OnboardingAgent } from '../../agents/onboarding/onboarding.agent';
import { ScopingAgent } from '../../agents/scoping/scoping.agent';
import { ControlMapperAgent } from '../../agents/control-mapper/control-mapper.agent';
import { DashboardAgent } from '../../agents/dashboard/dashboard.agent';
import { InferenceAgent } from '../../agents/inference/inference.agent';

// Generic processor factory — each queue uses the same logic, different agent
function createProcessor(queueName: string) {
  @Processor(queueName)
  @Injectable()
  class GenericAgentProcessor {
    readonly logger = new Logger(`Processor:${queueName}`);

    constructor(
      readonly moduleRef: ModuleRef,
      readonly workflowEngine: WorkflowEngine,
    ) {}

    @Process('run')
    async handle(job: Job<AgentJobData>) {
      const agent = this.getAgent(queueName);
      const output = await agent.execute(job.data);

      // Orchestrator — not the agent — decides what runs next.
      // Agents must never call other agents directly.
      if (output.success) {
        await this.workflowEngine.advance(
          queueName,
          job.data,
          output.nextAgentInput ?? output.data,
        );
      }

      return output;
    }

    @OnQueueFailed()
    onFailed(job: Job<AgentJobData>, error: Error) {
      this.logger.error(`Job failed | queue: ${queueName} | workflow: ${job.data.workflowId} | ${error.message}`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job<AgentJobData>) {
      this.logger.log(`Job completed | queue: ${queueName} | workflow: ${job.data.workflowId}`);
    }

    getAgent(queue: string) {
      const agentMap: Record<string, any> = {
        [QUEUE_NAMES.AGENT_INFERENCE]: InferenceAgent,
        [QUEUE_NAMES.AGENT_SCOPING]: ScopingAgent,
        [QUEUE_NAMES.AGENT_CONTROL_MAPPER]: ControlMapperAgent,
        [QUEUE_NAMES.AGENT_PLANNER]: PlannerAgent,
        [QUEUE_NAMES.AGENT_GAP_ANALYSIS]: GapAnalysisAgent,
        [QUEUE_NAMES.AGENT_POLICY]: PolicyAgent,
        [QUEUE_NAMES.AGENT_EVIDENCE]: EvidenceAgent,
        [QUEUE_NAMES.AGENT_DRIFT]: DriftDetectorAgent,
        [QUEUE_NAMES.AGENT_VALIDATOR]: ValidatorAgent,
        [QUEUE_NAMES.AGENT_RISK_SCORING]: RiskScoringAgent,
        [QUEUE_NAMES.AGENT_REVIEW]: ReviewAgent,
        [QUEUE_NAMES.AGENT_REMEDIATION]: RemediationAdvisorAgent,
        [QUEUE_NAMES.AGENT_THREAT_INTEL]: ThreatIntelAgent,
        [QUEUE_NAMES.AGENT_VENDOR_RISK]: VendorRiskAgent,
        [QUEUE_NAMES.AGENT_TASK]: TaskAgent,
        [QUEUE_NAMES.AGENT_INTERVIEW]: InterviewAgent,
        [QUEUE_NAMES.AGENT_BENCHMARK]: BenchmarkAgent,
        [QUEUE_NAMES.AGENT_AUDIT]: AuditAgent,
        [QUEUE_NAMES.AGENT_ONBOARDING]: OnboardingAgent,
        [QUEUE_NAMES.AGENT_DASHBOARD]: DashboardAgent,
      };
      return this.moduleRef.get(agentMap[queue], { strict: false });
    }
  }

  return GenericAgentProcessor;
}

export const InferenceProcessor = createProcessor(QUEUE_NAMES.AGENT_INFERENCE);
export const OnboardingProcessor = createProcessor(QUEUE_NAMES.AGENT_ONBOARDING);
export const ScopingProcessor = createProcessor(QUEUE_NAMES.AGENT_SCOPING);
export const ControlMapperProcessor = createProcessor(QUEUE_NAMES.AGENT_CONTROL_MAPPER);
export const PlannerProcessor = createProcessor(QUEUE_NAMES.AGENT_PLANNER);
export const GapAnalysisProcessor = createProcessor(QUEUE_NAMES.AGENT_GAP_ANALYSIS);
export const PolicyProcessor = createProcessor(QUEUE_NAMES.AGENT_POLICY);
export const EvidenceProcessor = createProcessor(QUEUE_NAMES.AGENT_EVIDENCE);
export const DriftProcessor = createProcessor(QUEUE_NAMES.AGENT_DRIFT);
export const ValidatorProcessor = createProcessor(QUEUE_NAMES.AGENT_VALIDATOR);
export const RiskScoringProcessor = createProcessor(QUEUE_NAMES.AGENT_RISK_SCORING);
export const ReviewProcessor = createProcessor(QUEUE_NAMES.AGENT_REVIEW);
export const RemediationProcessor = createProcessor(QUEUE_NAMES.AGENT_REMEDIATION);
export const ThreatIntelProcessor = createProcessor(QUEUE_NAMES.AGENT_THREAT_INTEL);
export const VendorRiskProcessor = createProcessor(QUEUE_NAMES.AGENT_VENDOR_RISK);
export const TaskProcessor = createProcessor(QUEUE_NAMES.AGENT_TASK);
export const InterviewProcessor = createProcessor(QUEUE_NAMES.AGENT_INTERVIEW);
export const BenchmarkProcessor = createProcessor(QUEUE_NAMES.AGENT_BENCHMARK);
export const AuditProcessor = createProcessor(QUEUE_NAMES.AGENT_AUDIT);
export const DashboardProcessor = createProcessor(QUEUE_NAMES.AGENT_DASHBOARD);
