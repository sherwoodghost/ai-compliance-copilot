import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
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
      useFactory: (config: ConfigService) => {
        const redisLogger = new Logger('Redis');

        // Factory shared across all Bull client types (client / subscriber / bclient).
        // We create one IORedis instance per type so Bull can manage them independently,
        // but ALL have an explicit 'error' listener so the EventEmitter never throws
        // an unhandled error event that would crash the Node.js process.
        const makeClient = () => {
          const client = new Redis({
            host:     config.get<string>('redis.host'),
            port:     config.get<number>('redis.port'),
            password: config.get<string>('redis.password') || undefined,
            tls:      config.get<boolean>('redis.tls') ? {} : undefined,
            // Don't connect at construction time — Bull will connect lazily when
            // it first needs to send a command. This prevents startup deadlocks
            // when Redis/Upstash is unavailable.
            lazyConnect:        true,
            enableReadyCheck:   false,
            maxRetriesPerRequest: null as any,
            // null = give up immediately on failure rather than entering a retry
            // loop that would block NestJS from completing its module lifecycle.
            retryStrategy: () => null,
          });

          // ─── CRITICAL: explicit error listener ─────────────────────────────
          // In Node.js, an EventEmitter that emits 'error' with no listener
          // throws synchronously, becoming an uncaughtException.  Even though
          // main.ts has a process-level handler, IORedis can emit errors before
          // those handlers are fully reliable (e.g. during module init).
          // This listener swallows Redis errors locally so they never escape.
          client.on('error', (err: Error) => {
            redisLogger.warn(`Redis client error (Bull): ${err.message}`);
          });

          return client;
        };

        return {
          createClient: makeClient,
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        };
      },
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
