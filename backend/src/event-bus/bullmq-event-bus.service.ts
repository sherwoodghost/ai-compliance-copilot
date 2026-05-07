import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUE_NAMES } from '../orchestrator/queue.config';
import { IEventBus, AgentJobPayload, EventBusPublishOptions } from './event-bus.interface';
import { PrismaService } from '../database/prisma.service';

/**
 * BullMQ implementation of IEventBus.
 * Swap this for KafkaEventBusService or RabbitMQEventBusService
 * by replacing the provider binding in EventBusModule — no other code changes.
 */
@Injectable()
export class BullMqEventBusService implements IEventBus {
  private readonly logger = new Logger(BullMqEventBusService.name);

  private readonly queueMap: Map<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.AGENT_PLANNER) private plannerQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_GAP_ANALYSIS) private gapQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_POLICY) private policyQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_EVIDENCE) private evidenceQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_VALIDATOR) private validatorQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_REVIEW) private reviewQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_RISK_SCORING) private riskQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_REMEDIATION) private remediationQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_THREAT_INTEL) private threatQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_VENDOR_RISK) private vendorQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_TASK) private taskQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_INTERVIEW) private interviewQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_BENCHMARK) private benchmarkQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_AUDIT) private auditQ: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_DRIFT_DETECTOR) private driftQ: Queue,
  ) {
    this.queueMap = new Map([
      [QUEUE_NAMES.AGENT_PLANNER, plannerQ],
      [QUEUE_NAMES.AGENT_GAP_ANALYSIS, gapQ],
      [QUEUE_NAMES.AGENT_POLICY, policyQ],
      [QUEUE_NAMES.AGENT_EVIDENCE, evidenceQ],
      [QUEUE_NAMES.AGENT_VALIDATOR, validatorQ],
      [QUEUE_NAMES.AGENT_REVIEW, reviewQ],
      [QUEUE_NAMES.AGENT_RISK_SCORING, riskQ],
      [QUEUE_NAMES.AGENT_REMEDIATION, remediationQ],
      [QUEUE_NAMES.AGENT_THREAT_INTEL, threatQ],
      [QUEUE_NAMES.AGENT_VENDOR_RISK, vendorQ],
      [QUEUE_NAMES.AGENT_TASK, taskQ],
      [QUEUE_NAMES.AGENT_INTERVIEW, interviewQ],
      [QUEUE_NAMES.AGENT_BENCHMARK, benchmarkQ],
      [QUEUE_NAMES.AGENT_AUDIT, auditQ],
      [QUEUE_NAMES.AGENT_DRIFT_DETECTOR, driftQ],
    ]);
  }

  async publish(queue: string, payload: AgentJobPayload, opts: EventBusPublishOptions = {}): Promise<void> {
    const q = this.queueMap.get(queue);
    if (!q) throw new Error(`Unknown queue: ${queue}`);

    try {
      await q.add('run', payload, {
        attempts: opts.attempts ?? 3,
        backoff: { type: 'exponential', delay: 2000 },
        delay: opts.delay ?? 0,
        priority: opts.priority ?? 0,
        removeOnComplete: 50,
        removeOnFail: 20,
      });
    } catch (redisErr: any) {
      this.logger.warn(`Redis unavailable — job dropped for queue ${queue}: ${redisErr.message}`);
    }

    // Record event in DB for full traceability
    await this.prisma.agentEvent.create({
      data: {
        orgId: payload.orgId,
        workflowId: payload.workflowId,
        journeyId: payload.journeyId,
        agentName: queue.replace('agent.', ''),
        eventType: 'job_enqueued',
        payload: payload as any,
      },
    });

    this.logger.log(`Published job to ${queue} | workflow: ${payload.workflowId}`);
  }

  async emit(_event: string, _payload: Record<string, unknown>): Promise<void> {
    // Lightweight pub/sub events go through the WebSocket gateway directly —
    // this is a no-op at the event-bus level since WS is handled by ComplianceGateway.
  }
}
