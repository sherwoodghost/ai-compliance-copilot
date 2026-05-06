import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ComplianceGateway } from '../gateways/compliance.gateway';

export type JourneyStage =
  | 'onboarding' | 'planning' | 'gap_analysis' | 'policy_generation'
  | 'evidence_collection' | 'validation' | 'review' | 'remediation'
  | 'threat_intel' | 'vendor_risk' | 'task_generation' | 'audit' | 'completed';

// Maps agent name → journey stage
const AGENT_STAGE_MAP: Record<string, JourneyStage> = {
  onboarding: 'onboarding',
  planner: 'planning',
  'gap-analysis': 'gap_analysis',
  policy: 'policy_generation',
  evidence: 'evidence_collection',
  validator: 'validation',
  review: 'review',
  'remediation-advisor': 'remediation',
  'threat-intel': 'threat_intel',
  'vendor-risk': 'vendor_risk',
  task: 'task_generation',
  'risk-scoring': 'review',
  'drift-detector': 'validation',
  interview: 'audit',
  benchmark: 'audit',
  audit: 'audit',
};

// Checkpoints that require human approval before advancing
const CHECKPOINT_STAGES: Set<JourneyStage> = new Set([
  'onboarding',        // after onboarding profile created
  'policy_generation', // after policies generated
  'audit',             // before audit readiness confirmed
]);

@Injectable()
export class ComplianceJourneyService {
  private readonly logger = new Logger(ComplianceJourneyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: ComplianceGateway,
  ) {}

  /** Get or create the active journey for a workflow */
  async getOrCreate(orgId: string, workflowId: string): Promise<any> {
    const existing = await this.prisma.complianceJourney.findUnique({
      where: { workflowId },
    });
    if (existing) return existing;

    return this.prisma.complianceJourney.create({
      data: {
        orgId,
        workflowId,
        currentStage: 'onboarding',
        status: 'active',
        agentOutputs: {},
        history: [],
        humanInterventions: [],
      },
    });
  }

  /** Called by BaseAgent after each successful agent run */
  async recordAgentOutput(
    journeyId: string,
    agentName: string,
    output: Record<string, unknown>,
    durationMs: number,
  ): Promise<void> {
    const journey = await this.prisma.complianceJourney.findUniqueOrThrow({
      where: { id: journeyId },
    });

    const stage = AGENT_STAGE_MAP[agentName] ?? 'planning';
    const history = journey.history as any[];
    history.push({
      stage,
      agentName,
      status: 'completed',
      timestamp: new Date().toISOString(),
      durationMs,
    });

    const agentOutputs = journey.agentOutputs as Record<string, unknown>;
    agentOutputs[agentName] = output;

    await this.prisma.complianceJourney.update({
      where: { id: journeyId },
      data: {
        currentStage: stage as any,
        agentOutputs: agentOutputs as any,
        history: history as any,
      },
    });

    // Emit real-time update
    this.gateway.emitJourneyUpdate(journey.orgId, journeyId, stage, agentName);

    this.logger.log(`Journey ${journeyId}: ${agentName} → ${stage}`);
  }

  /** Create a human checkpoint — pauses the journey until resolved */
  async createCheckpoint(
    journeyId: string,
    orgId: string,
    workflowId: string,
    agentName: string,
    checkpointType: string,
    summary: string,
    findings: unknown[],
    risks: unknown[],
    uncertainties: unknown[],
    metrics: Record<string, unknown>,
  ): Promise<any> {
    const checkpoint = await this.prisma.humanCheckpoint.create({
      data: {
        orgId,
        journeyId,
        workflowId,
        checkpointType: checkpointType as any,
        agentName,
        summary,
        findings: findings as any,
        risks: risks as any,
        uncertainties: uncertainties as any,
        metrics: metrics as any,
        status: 'pending',
      },
    });

    // Pause the journey
    await this.prisma.complianceJourney.update({
      where: { id: journeyId },
      data: { status: 'awaiting_human' },
    });

    // Notify via WebSocket
    this.gateway.emitCheckpointCreated(orgId, checkpoint.id, checkpointType, agentName);

    this.logger.log(`Checkpoint created: ${checkpoint.id} type=${checkpointType} agent=${agentName}`);
    return checkpoint;
  }

  /** Human resolves a checkpoint — resumes the journey */
  async resolveCheckpoint(
    orgId: string,
    checkpointId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected' | 'override',
    comments?: string,
    overrideReason?: string,
  ): Promise<any> {
    const checkpoint = await this.prisma.humanCheckpoint.findFirst({
      where: { id: checkpointId, orgId },
    });
    if (!checkpoint) throw new NotFoundException('Checkpoint not found');

    const updated = await this.prisma.humanCheckpoint.update({
      where: { id: checkpointId },
      data: {
        status: decision === 'approved' ? 'approved' : decision === 'override' ? 'overridden' : 'rejected',
        reviewerId,
        reviewedAt: new Date(),
        decision,
        comments,
        overrideReason,
      },
    });

    // Record the intervention on the journey
    const journey = await this.prisma.complianceJourney.findUniqueOrThrow({
      where: { id: checkpoint.journeyId },
    });

    const interventions = journey.humanInterventions as any[];
    interventions.push({
      checkpointId,
      userId: reviewerId,
      action: decision,
      notes: comments,
      timestamp: new Date().toISOString(),
    });

    // Resume journey if approved or overridden
    const resumeStatus = (decision === 'rejected') ? 'paused_for_review' : 'active';

    await this.prisma.complianceJourney.update({
      where: { id: checkpoint.journeyId },
      data: {
        status: resumeStatus as any,
        humanInterventions: interventions as any,
      },
    });

    // Record event
    await this.prisma.agentEvent.create({
      data: {
        orgId,
        workflowId: checkpoint.workflowId ?? undefined,
        journeyId: checkpoint.journeyId,
        agentName: checkpoint.agentName,
        eventType: 'checkpoint_resolved',
        payload: { checkpointId, decision, reviewerId } as any,
      },
    });

    this.gateway.emitCheckpointResolved(orgId, checkpointId, decision);
    return updated;
  }

  /** Get full journey state including all checkpoints */
  async getJourneyDetail(orgId: string, journeyId: string) {
    const journey = await this.prisma.complianceJourney.findFirst({
      where: { id: journeyId, orgId },
      include: {
        checkpoints: {
          include: { reviewer: { select: { fullName: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
        workflow: {
          select: { id: true, name: true, status: true, type: true, startedAt: true },
        },
      },
    });
    if (!journey) throw new NotFoundException('Journey not found');
    return journey;
  }

  /** List all journeys for an org */
  async listJourneys(orgId: string) {
    return this.prisma.complianceJourney.findMany({
      where: { orgId },
      include: {
        workflow: { select: { name: true, type: true, status: true } },
        checkpoints: { select: { id: true, status: true, checkpointType: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getPendingCheckpoints(orgId: string) {
    return this.prisma.humanCheckpoint.findMany({
      where: { orgId, status: 'pending' },
      include: {
        journey: { select: { currentStage: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async shouldCreateCheckpoint(journeyId: string, agentName: string): Promise<boolean> {
    const stage = AGENT_STAGE_MAP[agentName];
    if (!CHECKPOINT_STAGES.has(stage)) return false;

    // Don't create a duplicate pending checkpoint for the same stage
    const journey = await this.prisma.complianceJourney.findUniqueOrThrow({
      where: { id: journeyId },
      include: { checkpoints: { where: { status: 'pending' } } },
    });

    const alreadyPending = journey.checkpoints.some(
      (c) => c.agentName === agentName && c.status === 'pending',
    );

    return !alreadyPending;
  }
}
