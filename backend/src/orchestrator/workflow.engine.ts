import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { ComplianceJourneyService } from '../compliance-journey/compliance-journey.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from './queue.config';
import { AgentJobData } from '../agents/base/agent.interfaces';
import { BusinessProfile } from '../agents/types/business-profile.type';

export interface StartFromOnboardingOptions {
  orgId: string;
  onboardingVersion?: number;
  triggeredBy?: string;
}

export interface TriggerWorkflowOptions {
  orgId: string;
  triggeredBy?: string;
  name?: string;
  frameworkIds?: string[];
  controlIds?: string[];
  isReplay?: boolean;
}

// Centralized pipeline definition — no agent knows about any other agent
// Order: inference → scoping → control-mapper → planner → ... → audit → dashboard
const PIPELINE: string[] = [
  QUEUE_NAMES.AGENT_INFERENCE,
  QUEUE_NAMES.AGENT_SCOPING,
  QUEUE_NAMES.AGENT_CONTROL_MAPPER,
  QUEUE_NAMES.AGENT_PLANNER,
  QUEUE_NAMES.AGENT_GAP_ANALYSIS,
  QUEUE_NAMES.AGENT_POLICY,
  QUEUE_NAMES.AGENT_EVIDENCE,
  QUEUE_NAMES.AGENT_DRIFT_DETECTOR,
  QUEUE_NAMES.AGENT_VALIDATOR,
  QUEUE_NAMES.AGENT_RISK_SCORING,
  QUEUE_NAMES.AGENT_REVIEW,
  QUEUE_NAMES.AGENT_REMEDIATION,
  QUEUE_NAMES.AGENT_THREAT_INTEL,
  QUEUE_NAMES.AGENT_VENDOR_RISK,
  QUEUE_NAMES.AGENT_TASK,
  QUEUE_NAMES.AGENT_INTERVIEW,
  QUEUE_NAMES.AGENT_BENCHMARK,
  QUEUE_NAMES.AGENT_AUDIT,
  QUEUE_NAMES.AGENT_DASHBOARD,
];

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);

  private readonly queueMap: Map<string, Queue>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly journeyService: ComplianceJourneyService,
    @InjectQueue(QUEUE_NAMES.AGENT_INFERENCE) private readonly inferenceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_SCOPING) private readonly scopingQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_CONTROL_MAPPER) private readonly controlMapperQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_PLANNER) private readonly plannerQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_GAP_ANALYSIS) private readonly gapQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_POLICY) private readonly policyQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_EVIDENCE) private readonly evidenceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_DRIFT_DETECTOR) private readonly driftQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_VALIDATOR) private readonly validatorQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_RISK_SCORING) private readonly riskQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_REVIEW) private readonly reviewQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_REMEDIATION) private readonly remediationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_THREAT_INTEL) private readonly threatQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_VENDOR_RISK) private readonly vendorQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_TASK) private readonly taskQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_INTERVIEW) private readonly interviewQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_BENCHMARK) private readonly benchmarkQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_AUDIT) private readonly auditQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_DASHBOARD) private readonly dashboardQueue: Queue,
  ) {
    this.queueMap = new Map([
      [QUEUE_NAMES.AGENT_INFERENCE, inferenceQueue],
      [QUEUE_NAMES.AGENT_SCOPING, scopingQueue],
      [QUEUE_NAMES.AGENT_CONTROL_MAPPER, controlMapperQueue],
      [QUEUE_NAMES.AGENT_PLANNER, plannerQueue],
      [QUEUE_NAMES.AGENT_GAP_ANALYSIS, gapQueue],
      [QUEUE_NAMES.AGENT_POLICY, policyQueue],
      [QUEUE_NAMES.AGENT_EVIDENCE, evidenceQueue],
      [QUEUE_NAMES.AGENT_DRIFT_DETECTOR, driftQueue],
      // legacy alias so replayFromAgent('drift') works
      [QUEUE_NAMES.AGENT_DRIFT, driftQueue],
      [QUEUE_NAMES.AGENT_VALIDATOR, validatorQueue],
      [QUEUE_NAMES.AGENT_RISK_SCORING, riskQueue],
      [QUEUE_NAMES.AGENT_REVIEW, reviewQueue],
      [QUEUE_NAMES.AGENT_REMEDIATION, remediationQueue],
      [QUEUE_NAMES.AGENT_THREAT_INTEL, threatQueue],
      [QUEUE_NAMES.AGENT_VENDOR_RISK, vendorQueue],
      [QUEUE_NAMES.AGENT_TASK, taskQueue],
      [QUEUE_NAMES.AGENT_INTERVIEW, interviewQueue],
      [QUEUE_NAMES.AGENT_BENCHMARK, benchmarkQueue],
      [QUEUE_NAMES.AGENT_AUDIT, auditQueue],
      [QUEUE_NAMES.AGENT_DASHBOARD, dashboardQueue],
    ]);
  }

  async triggerFullAssessment(options: TriggerWorkflowOptions): Promise<{ workflowId: string; journeyId: string }> {
    const { orgId, triggeredBy } = options;

    // Gate: business profile must be complete
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile?.isComplete) {
      throw new Error('Cannot start assessment: onboarding is not complete. Complete the business profile first.');
    }

    const businessProfile = this.buildProfileObject(profile);

    // Create workflow record
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId,
        name: options.name ?? `Full Assessment — ${new Date().toLocaleDateString()}`,
        type: 'full_assessment',
        status: 'running',
        inputPayload: { orgId, frameworkIds: options.frameworkIds ?? [] } as any,
        triggeredBy: triggeredBy ?? null,
        startedAt: new Date(),
      },
    });

    // Create compliance journey — the single source of truth for this run
    const journey = await this.journeyService.getOrCreate(orgId, workflow.id);

    this.logger.log(`Workflow: ${workflow.id} | Journey: ${journey.id} | Org: ${orgId}`);

    if (options.frameworkIds?.length) {
      await this.initializeControls(orgId, options.frameworkIds);
    }

    // Record enqueue event
    await this.prisma.agentEvent.create({
      data: {
        orgId,
        workflowId: workflow.id,
        journeyId: journey.id,
        agentName: 'orchestrator',
        eventType: 'job_enqueued',
        payload: { firstAgent: 'scoping', frameworkIds: options.frameworkIds } as any,
      },
    });

    // Kick off with ScopingAgent first — pipeline order: scoping → control-mapper → planner → ...
    const baseJobData: AgentJobData = {
      workflowId: workflow.id,
      journeyId: journey.id,
      orgId,
      businessProfile,
      inputPayload: {
        frameworkIds: options.frameworkIds ?? [],
        // default framework for scoping; planner uses frameworkIds for multi-framework runs
        framework: options.frameworkIds?.includes('iso27001') ? 'iso27001' : 'soc2',
      },
    };

    await this.scopingQueue.add('run', baseJobData, { ...DEFAULT_JOB_OPTIONS, priority: 1 });

    return { workflowId: workflow.id, journeyId: journey.id };
  }

  /**
   * Entry point triggered by onboarding.completed event.
   * Fires inference-agent first, then the standard pipeline begins.
   * Uses idempotency keys to prevent duplicate job submissions.
   */
  async startFromOnboarding(
    options: StartFromOnboardingOptions,
  ): Promise<{ workflowId: string; journeyId: string }> {
    const { orgId, onboardingVersion = 1, triggeredBy } = options;

    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile?.isComplete) {
      throw new Error('Cannot start pipeline: onboarding is not complete');
    }

    const businessProfile = this.buildProfileObject(profile);

    // Create workflow
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId,
        name: `Compliance Assessment — v${onboardingVersion} — ${new Date().toLocaleDateString()}`,
        type: 'full_assessment',
        status: 'running',
        inputPayload: { orgId, onboardingVersion } as any,
        triggeredBy: triggeredBy ?? null,
        startedAt: new Date(),
      },
    });

    const journey = await this.journeyService.getOrCreate(orgId, workflow.id);

    this.logger.log(`startFromOnboarding: workflow=${workflow.id} | journey=${journey.id} | org=${orgId}`);

    // Idempotency key: hash(orgId + onboardingVersion + agentId + step)
    const idempotencyKey = createHash('sha256')
      .update(`${orgId}:${onboardingVersion}:inference-agent:0`)
      .digest('hex');

    const jobData: AgentJobData = {
      workflowId: workflow.id,
      journeyId: journey.id,
      orgId,
      businessProfile,
      inputPayload: { onboardingVersion, triggeredBy: 'onboarding.completed' },
    };

    await this.inferenceQueue.add('run', jobData, {
      ...DEFAULT_JOB_OPTIONS,
      jobId: idempotencyKey, // BullMQ deduplication: same jobId = skip if already queued
      priority: 1,
    });

    return { workflowId: workflow.id, journeyId: journey.id };
  }

  /**
   * Called by each agent processor after success.
   * The orchestrator — not the agent — decides what runs next.
   */
  async advance(
    currentQueueName: string,
    jobData: AgentJobData,
    agentOutput: Record<string, unknown>,
  ): Promise<void> {
    // Check if the journey is paused (human checkpoint)
    if (jobData.journeyId) {
      const journey = await this.prisma.complianceJourney.findUnique({
        where: { id: jobData.journeyId },
      });
      if (journey?.status === 'awaiting_human') {
        this.logger.log(`Pipeline paused at ${currentQueueName} — awaiting human checkpoint`);
        return;
      }
    }

    const currentIndex = PIPELINE.indexOf(currentQueueName);
    if (currentIndex === -1 || currentIndex === PIPELINE.length - 1) {
      // Pipeline complete
      await this.prisma.workflow.update({
        where: { id: jobData.workflowId },
        data: { status: 'completed', completedAt: new Date() },
      });
      await this.prisma.complianceJourney.updateMany({
        where: { workflowId: jobData.workflowId },
        data: { status: 'completed', currentStage: 'completed' as any, completedAt: new Date() },
      });
      this.logger.log(`Pipeline complete for workflow: ${jobData.workflowId}`);
      return;
    }

    const nextQueueName = PIPELINE[currentIndex + 1];
    const nextQueue = this.queueMap.get(nextQueueName);
    if (!nextQueue) return;

    const nextJobData: AgentJobData = {
      ...jobData,
      inputPayload: agentOutput,
    };

    await nextQueue.add('run', nextJobData, DEFAULT_JOB_OPTIONS);
    this.logger.log(`Orchestrator advanced: ${currentQueueName} → ${nextQueueName}`);
  }

  async replayFromAgent(
    workflowId: string,
    agentName: string,
    customInput?: Record<string, unknown>,
  ): Promise<void> {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new Error('Workflow not found');

    const journey = await this.prisma.complianceJourney.findUnique({ where: { workflowId } });
    if (!journey) throw new Error('Compliance journey not found for workflow');

    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId: workflow.orgId } });
    if (!profile) throw new Error('Business profile not found');

    const queueName = `agent.${agentName}`;
    const queue = this.queueMap.get(queueName);
    if (!queue) throw new Error(`Unknown agent: ${agentName}`);

    // Restore latest step input if custom input not provided
    const latestRun = await this.prisma.agentRun.findFirst({
      where: { workflowId, agentName },
      orderBy: { createdAt: 'desc' },
      include: { steps: { orderBy: { stepIndex: 'asc' }, take: 1 } },
    });

    const replayInput = customInput ?? (latestRun?.steps[0]?.inputSnapshot as any) ?? workflow.inputPayload ?? {};

    const replayJobData: AgentJobData = {
      workflowId,
      journeyId: journey.id,
      orgId: workflow.orgId,
      businessProfile: this.buildProfileObject(profile),
      inputPayload: replayInput,
      isReplay: true,
    };

    await queue.add('run', replayJobData, { ...DEFAULT_JOB_OPTIONS, priority: 10 });

    // Record replay event
    await this.prisma.agentEvent.create({
      data: {
        orgId: workflow.orgId,
        workflowId,
        journeyId: journey.id,
        agentName,
        eventType: 'replay_triggered',
        payload: { customInput: customInput ?? null } as any,
      },
    });

    this.logger.log(`Replay: workflow=${workflowId} agent=${agentName}`);
  }

  private buildProfileObject(profile: any): BusinessProfile {
    return {
      companyName: profile.companyName,
      companyType: profile.companyType,
      industry: profile.industry,
      subIndustry: profile.subIndustry,
      employeeCount: profile.employeeCount,
      engineeringCount: profile.engineeringCount,
      hqCountry: profile.hqCountry,
      operatesIn: profile.operatesIn ?? [],
      infrastructure: profile.infrastructure ?? { cloudProviders: [] },
      tools: profile.tools ?? {},
      dataHandling: profile.dataHandling ?? { dataTypes: [] },
      currentPosture: profile.currentPosture ?? {},
      complianceGoals: profile.complianceGoals ?? { frameworks: [] },
      riskProfile: profile.riskProfile ?? { riskLevel: 'medium', riskFactors: [], recommendedPriority: [], estimatedReadiness: 0 },
    };
  }

  private async initializeControls(orgId: string, frameworkIds: string[]) {
    const controls = await this.prisma.control.findMany({
      where: { frameworkId: { in: frameworkIds } },
    });
    for (const control of controls) {
      await this.prisma.organizationControl.upsert({
        where: { orgId_controlId: { orgId, controlId: control.id } },
        create: { orgId, controlId: control.id },
        update: {},
      });
    }
  }
}
