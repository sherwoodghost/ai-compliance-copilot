import { Module } from '@nestjs/common';
import { ComplianceJourneyModule } from '../compliance-journey/compliance-journey.module';
import { LlmGatewayModule } from '../llm-gateway/llm-gateway.module';
import { ControlLibraryModule } from '../control-library/control-library.module';
import { ScopingModule } from '../scoping/scoping.module';
import { InferenceModule } from '../inference/inference.module';
import { AgentMemoryModule } from '../agent-memory/agent-memory.module';
import { DashboardApiModule } from '../modules/dashboard/dashboard.module';
import { OnboardingAgent } from './onboarding/onboarding.agent';
import { DialogueManagerService } from './onboarding/dialogue-manager.service';
import { PlannerAgent } from './planner/planner.agent';
import { PolicyAgent } from './policy/policy.agent';
import { EvidenceAgent } from './evidence/evidence.agent';
import { ValidatorAgent } from './validator/validator.agent';
import { ReviewAgent } from './review/review.agent';
import { TaskAgent } from './task/task.agent';
import { AuditAgent } from './audit/audit.agent';
import { GapAnalysisAgent } from './gap-analysis/gap-analysis.agent';
import { RiskScoringAgent } from './risk-scoring/risk-scoring.agent';
import { DriftDetectorAgent } from './drift-detector/drift-detector.agent';
import { RemediationAdvisorAgent } from './remediation-advisor/remediation-advisor.agent';
import { ThreatIntelAgent } from './threat-intel/threat-intel.agent';
import { VendorRiskAgent } from './vendor-risk/vendor-risk.agent';
import { InterviewAgent } from './interview/interview.agent';
import { BenchmarkAgent } from './benchmark/benchmark.agent';
import { ScopingAgent } from './scoping/scoping.agent';
import { ControlMapperAgent } from './control-mapper/control-mapper.agent';
import { DashboardAgent } from './dashboard/dashboard.agent';
import { InferenceAgent } from './inference/inference.agent';
import { FrameworkExpertModule } from './framework-expert/framework-expert.module';

const ALL_AGENTS = [
  DialogueManagerService,
  OnboardingAgent,
  InferenceAgent,
  PlannerAgent,
  PolicyAgent,
  EvidenceAgent,
  ValidatorAgent,
  ReviewAgent,
  TaskAgent,
  AuditAgent,
  GapAnalysisAgent,
  RiskScoringAgent,
  DriftDetectorAgent,
  RemediationAdvisorAgent,
  ThreatIntelAgent,
  VendorRiskAgent,
  InterviewAgent,
  BenchmarkAgent,
  ScopingAgent,
  ControlMapperAgent,
  DashboardAgent,
];

@Module({
  imports: [ComplianceJourneyModule, LlmGatewayModule, ControlLibraryModule, ScopingModule, InferenceModule, AgentMemoryModule, DashboardApiModule, FrameworkExpertModule],
  providers: ALL_AGENTS,
  exports: [...ALL_AGENTS, FrameworkExpertModule],
})
export class AgentsModule {}
