import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '../../orchestrator/queue.config';
import { DialogueManagerService } from '../../agents/onboarding/dialogue-manager.service';

/** Minimum completeness fraction (0–1) required to allow finalize */
const FINALIZE_COMPLETENESS_THRESHOLD = 0.85;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.AGENT_ONBOARDING) private readonly onboardingQueue: Queue,
    private readonly dialogueManager: DialogueManagerService,
  ) {}

  async getOrCreateSession(orgId: string, userId: string) {
    const existing = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: 'in_progress' },
      include: {
        messages: { orderBy: { turnIndex: 'asc' } },
      },
    });

    if (existing) return existing;

    // Create new session + trigger greeting message
    const session = await this.prisma.onboardingSession.create({
      data: {
        orgId,
        userId,
        status: 'in_progress',
        currentState: 'GREETING',
      },
    });

    // Queue greeting job (no user message → agent sends first)
    await this.enqueueMessage(session.id, orgId, null, userId);

    return this.prisma.onboardingSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { turnIndex: 'asc' } } },
    });
  }

  async sendMessage(orgId: string, userId: string, message: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: 'in_progress' },
    });

    if (!session) {
      throw new NotFoundException('No active onboarding session. Start a new session first.');
    }

    if (!message?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Add to queue and return jobId for WebSocket tracking
    const job = await this.enqueueMessage(session.id, orgId, message, userId);
    return { sessionId: session.id, jobId: job.id };
  }

  async getSessionStatus(orgId: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: { orderBy: { turnIndex: 'asc' } },
      },
    });

    if (!session) return { hasSession: false };

    const profile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
      select: { isComplete: true, industry: true, companyType: true, riskProfile: true },
    });

    return {
      hasSession: true,
      status: session.status,
      currentState: session.currentState,
      turnCount: session.turnCount,
      isComplete: session.status === 'completed',
      hasBusinessProfile: profile?.isComplete ?? false,
      messages: session.messages,
    };
  }

  async getBusinessProfile(orgId: string) {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
    });
    if (!profile) throw new NotFoundException('Business profile not found. Complete onboarding first.');
    return profile;
  }

  async updateBusinessProfile(orgId: string, userId: string, updates: Record<string, unknown>) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!existing) throw new NotFoundException('Business profile not found');

    await this.prisma.profileChangeLog.create({
      data: {
        orgId,
        changedBy: userId,
        previousProfile: existing as any,
        newProfile: { ...existing, ...updates } as any,
        changeReason: 'manual_update',
      },
    });

    return this.prisma.businessProfile.update({
      where: { orgId },
      data: {
        ...updates,
        version: { increment: 1 },
      } as any,
    });
  }

  async getProfileVersions(orgId: string) {
    return this.prisma.businessProfileVersion.findMany({
      where: { orgId },
      include: { changedBy: { select: { fullName: true, email: true } } },
      orderBy: { version: 'desc' },
    });
  }

  async rollbackProfile(orgId: string, changedById: string, targetVersion: number): Promise<void> {
    const versionRecord = await this.prisma.businessProfileVersion.findUnique({
      where: { orgId_version: { orgId, version: targetVersion } },
    });
    if (!versionRecord) throw new NotFoundException(`Version ${targetVersion} not found`);

    // Save current before rollback
    const current = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (current) {
      const latest = await this.prisma.businessProfileVersion.findFirst({
        where: { orgId }, orderBy: { version: 'desc' },
      });
      await this.prisma.businessProfileVersion.create({
        data: {
          orgId,
          version: (latest?.version ?? 0) + 1,
          snapshot: current as any,
          changedById,
          changeReason: `Pre-rollback snapshot before restoring v${targetVersion}`,
          diff: {},
        },
      });
    }

    const snap = versionRecord.snapshot as Record<string, unknown>;
    await this.prisma.businessProfile.update({
      where: { orgId },
      data: {
        companyName: snap.companyName as string,
        companyType: snap.companyType as any,
        industry: snap.industry as any,
        employeeCount: snap.employeeCount as string,
        infrastructure: snap.infrastructure as any,
        tools: snap.tools as any,
        dataHandling: snap.dataHandling as any,
        currentPosture: snap.currentPosture as any,
        complianceGoals: snap.complianceGoals as any,
        riskProfile: snap.riskProfile as any,
      },
    });
  }

  /**
   * Returns current completeness score (0–100) and the list of missing required fields.
   * Uses the DialogueManagerService as the single source of truth.
   */
  async getCompleteness(orgId: string) {
    const status = await this.dialogueManager.getCompletionStatus(orgId);
    return {
      completionPct: status.completionPct,
      completionScore: status.completionPct / 100,
      isComplete: status.isComplete,
      missingFields: status.missingFields,
      canFinalize: (status.completionPct / 100) >= FINALIZE_COMPLETENESS_THRESHOLD,
      finalizeThreshold: FINALIZE_COMPLETENESS_THRESHOLD,
    };
  }

  /**
   * Finalize onboarding — marks the profile complete and triggers the inference pipeline.
   * Blocked if completeness_score < FINALIZE_COMPLETENESS_THRESHOLD (0.85).
   */
  async finalizeOnboarding(orgId: string, userId: string): Promise<{ workflowId: string; journeyId: string }> {
    // Gate: completeness check
    const completeness = await this.getCompleteness(orgId);
    if (!completeness.canFinalize) {
      throw new BadRequestException(
        `Cannot finalize onboarding — completeness score ${completeness.completionPct}% is below the required ${Math.round(FINALIZE_COMPLETENESS_THRESHOLD * 100)}%. ` +
        `Missing required fields: ${completeness.missingFields.join(', ')}`,
      );
    }

    // Ensure the business profile is marked complete
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      throw new NotFoundException('Business profile not found — complete the onboarding chat first');
    }

    if (!profile.isComplete) {
      await this.prisma.businessProfile.update({
        where: { orgId },
        data: { isComplete: true, completedAt: new Date() },
      });
    }

    // Mark session as completed
    await this.prisma.onboardingSession.updateMany({
      where: { orgId, status: 'in_progress' },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Create a workflow + trigger inference pipeline
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId,
        name: `Compliance Assessment — ${new Date().toLocaleDateString()}`,
        type: 'full_assessment',
        status: 'running',
        inputPayload: { orgId, triggeredBy: 'onboarding_finalize' } as any,
        triggeredBy: userId,
        startedAt: new Date(),
      },
    });

    const journey = await this.prisma.complianceJourney.create({
      data: {
        orgId,
        workflowId: workflow.id,
        status: 'active',
        currentStage: 'planning',
      },
    });

    // Fire inference agent (first pipeline stage)
    await this.onboardingQueue.add(
      'run',
      {
        workflowId: workflow.id,
        journeyId: journey.id,
        orgId,
        businessProfile: profile as any,
        inputPayload: { onboardingVersion: profile.version ?? 1, triggeredBy: 'onboarding_finalize' },
      },
      { ...DEFAULT_JOB_OPTIONS, priority: 1 },
    );

    this.logger.log(`Onboarding finalized: org=${orgId} workflow=${workflow.id}`);
    return { workflowId: workflow.id, journeyId: journey.id };
  }

  private async enqueueMessage(sessionId: string, orgId: string, userMessage: string | null, userId: string) {
    return this.onboardingQueue.add(
      'run',
      {
        workflowId: sessionId, // Reuse sessionId as workflowId for observability
        orgId,
        businessProfile: {} as any, // Not needed for onboarding
        inputPayload: { sessionId, userMessage },
      },
      { ...DEFAULT_JOB_OPTIONS, priority: 1 },
    );
  }
}
