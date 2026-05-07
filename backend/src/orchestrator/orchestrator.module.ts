import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.config';
import { WorkflowEngine } from './workflow.engine';
import { OrchestratorController } from './orchestrator.controller';
import { AgentsModule } from '../agents/agents.module';
import { ComplianceJourneyModule } from '../compliance-journey/compliance-journey.module';
import {
  InferenceProcessor, OnboardingProcessor, ScopingProcessor, ControlMapperProcessor,
  PlannerProcessor, GapAnalysisProcessor, PolicyProcessor, EvidenceProcessor,
  DriftProcessor, ValidatorProcessor, RiskScoringProcessor, ReviewProcessor,
  RemediationProcessor, ThreatIntelProcessor, VendorRiskProcessor, TaskProcessor,
  InterviewProcessor, BenchmarkProcessor, AuditProcessor, DashboardProcessor,
} from './processors/agent.processor';

// Deduplicate queue names (AGENT_DRIFT and AGENT_DRIFT_DETECTOR share the same queue string)
const allQueues = [...new Set(Object.values(QUEUE_NAMES))].map((name) => ({ name }));

const allProcessors = [
  InferenceProcessor, OnboardingProcessor, ScopingProcessor, ControlMapperProcessor,
  PlannerProcessor, GapAnalysisProcessor, PolicyProcessor, EvidenceProcessor,
  DriftProcessor, ValidatorProcessor, RiskScoringProcessor, ReviewProcessor,
  RemediationProcessor, ThreatIntelProcessor, VendorRiskProcessor, TaskProcessor,
  InterviewProcessor, BenchmarkProcessor, AuditProcessor, DashboardProcessor,
];

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password') || undefined,
          tls: config.get<boolean>('redis.tls') ? {} : undefined,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
          retryStrategy: (times: number) => Math.min(times * 1000, 10000),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(...allQueues),
    AgentsModule,
    ComplianceJourneyModule,
  ],
  providers: [WorkflowEngine, ...allProcessors],
  controllers: [OrchestratorController],
  exports: [WorkflowEngine, BullModule],
})
export class OrchestratorModule {}
