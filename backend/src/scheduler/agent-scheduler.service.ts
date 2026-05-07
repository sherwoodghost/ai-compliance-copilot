import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { WorkflowType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ComplianceJourneyService } from '../compliance-journey/compliance-journey.service';
import { QUEUE_NAMES } from '../orchestrator/queue.config';
import { AgentJobData } from '../agents/base/agent.interfaces';
import { BusinessProfile } from '../agents/types/business-profile.type';

/**
 * AgentSchedulerService
 *
 * Runs agent jobs on a schedule so the platform stays current without
 * requiring manual "Run Assessment" clicks:
 *
 *  • Daily   02:00 UTC — EvidenceAgent    (refresh evidence suggestions)
 *  • Daily   02:30 UTC — DriftDetectorAgent (detect control drift)
 *  • Weekly  Mon 03:00 UTC — GapAnalysisAgent (comprehensive gap report)
 *
 * Each run:
 *  1. Finds all orgs that have completed onboarding
 *  2. Gets or creates a workflow + journey record
 *  3. Enqueues the target agent for each org
 *  4. Catches per-org errors so one bad org doesn't block others
 */
@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journeyService: ComplianceJourneyService,
    @InjectQueue(QUEUE_NAMES.AGENT_EVIDENCE)       private readonly evidenceQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_DRIFT_DETECTOR) private readonly driftQueue: Queue,
    @InjectQueue(QUEUE_NAMES.AGENT_GAP_ANALYSIS)   private readonly gapQueue: Queue,
  ) {}

  // ─── Daily: Evidence suggestions refresh ────────────────────────────────────
  @Cron('0 2 * * *', { name: 'daily-evidence', timeZone: 'UTC' })
  async runDailyEvidenceCollection(): Promise<void> {
    this.logger.log('[Scheduler] Daily evidence collection starting…');
    await this.runForAllOrgs(WorkflowType.full_assessment, this.evidenceQueue, 'evidence-agent-scheduled');
  }

  // ─── Daily: Drift detection ──────────────────────────────────────────────────
  @Cron('30 2 * * *', { name: 'daily-drift', timeZone: 'UTC' })
  async runDailyDriftDetection(): Promise<void> {
    this.logger.log('[Scheduler] Daily drift detection starting…');
    await this.runForAllOrgs(WorkflowType.full_assessment, this.driftQueue, 'drift-agent-scheduled');
  }

  // ─── Weekly: Gap analysis ────────────────────────────────────────────────────
  @Cron('0 3 * * 1', { name: 'weekly-gap-analysis', timeZone: 'UTC' })
  async runWeeklyGapAnalysis(): Promise<void> {
    this.logger.log('[Scheduler] Weekly gap analysis starting…');
    await this.runForAllOrgs(WorkflowType.gap_analysis, this.gapQueue, 'gap-agent-scheduled');
  }

  // ─── Shared runner ──────────────────────────────────────────────────────────

  private async runForAllOrgs(
    workflowType: WorkflowType,
    queue: Queue,
    jobName: string,
  ): Promise<void> {
    const orgs = await this.getActiveOrgs();
    this.logger.log(`[Scheduler] ${jobName}: found ${orgs.length} active org(s)`);

    let success = 0;
    let failed = 0;

    for (const org of orgs) {
      try {
        await this.enqueueForOrg(org.orgId, org.businessProfile, workflowType, queue, jobName);
        success++;
      } catch (err: any) {
        failed++;
        this.logger.error(
          `[Scheduler] ${jobName} failed for org ${org.orgId}: ${err.message}`,
          err.stack,
        );
      }
    }

    this.logger.log(`[Scheduler] ${jobName}: ${success} enqueued, ${failed} failed`);
  }

  private async enqueueForOrg(
    orgId: string,
    rawProfile: any,
    workflowType: WorkflowType,
    queue: Queue,
    jobName: string,
  ): Promise<void> {
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId,
        name: `${jobName} — ${new Date().toISOString().slice(0, 10)}`,
        type: workflowType,
        status: 'running',
        inputPayload: { triggeredBy: 'scheduler', jobName } as any,
        startedAt: new Date(),
      },
    });

    const journey = await this.journeyService.getOrCreate(orgId, workflow.id);
    const businessProfile = this.buildProfileObject(rawProfile);

    const jobData: AgentJobData = {
      workflowId: workflow.id,
      journeyId: journey.id,
      orgId,
      businessProfile,
      inputPayload: { scheduledRun: true },
    };

    await queue.add(jobName, jobData, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 10_000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    this.logger.debug(
      `[Scheduler] Enqueued ${jobName} for org ${orgId} (workflow ${workflow.id})`,
    );
  }

  private async getActiveOrgs(): Promise<Array<{ orgId: string; businessProfile: any }>> {
    const profiles = await this.prisma.businessProfile.findMany({
      where: { isComplete: true },
    });

    return profiles.map((p) => ({ orgId: p.orgId, businessProfile: p }));
  }

  private buildProfileObject(profile: any): BusinessProfile {
    const infra = (profile?.infrastructure ?? {}) as any;
    const tools = (profile?.tools ?? {}) as any;
    const dataHandling = (profile?.dataHandling ?? {}) as any;
    const currentPosture = (profile?.currentPosture ?? {}) as any;
    const complianceGoals = (profile?.complianceGoals ?? {}) as any;
    const riskProfile = (profile?.riskProfile ?? {}) as any;

    return {
      companyName:      profile?.companyName ?? '',
      companyType:      profile?.companyType ?? 'startup',
      industry:         profile?.industry ?? '',
      subIndustry:      profile?.subIndustry ?? undefined,
      employeeCount:    profile?.employeeCount ?? '',
      engineeringCount: profile?.engineeringCount ?? undefined,
      hqCountry:        profile?.hqCountry ?? undefined,
      operatesIn:       profile?.operatesIn ?? [],
      infrastructure:   infra,
      tools,
      dataHandling,
      currentPosture,
      complianceGoals,
      riskProfile: {
        riskLevel:            riskProfile?.riskLevel ?? 'medium',
        riskFactors:          riskProfile?.riskFactors ?? [],
        recommendedPriority:  riskProfile?.recommendedPriority ?? [],
        estimatedReadiness:   riskProfile?.estimatedReadiness ?? 0,
      },
    };
  }
}
