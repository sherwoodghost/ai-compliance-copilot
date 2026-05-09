import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ApprovalWorkflowService } from '../modules/approval-workflow/approval-workflow.service';

/**
 * DocumentSchedulerService
 *
 * Handles time-based lifecycle operations for documents:
 *
 *  • Hourly               — Check for workflow SLA breaches + escalate
 *  • Daily   01:00 UTC    — Soft-delete documents past retainUntil (no legal hold)
 *  • Monthly  1st 00:30 UTC — Physical purge of soft-deleted docs >30 days old
 *  • Monthly  1st 00:00 UTC — Reset per-org AI token usage counters
 */
@Injectable()
export class DocumentSchedulerService {
  private readonly logger = new Logger(DocumentSchedulerService.name);

  constructor(
    private readonly prisma:          PrismaService,
    private readonly approvalWorkflow: ApprovalWorkflowService,
  ) {}

  // ─── Hourly: workflow SLA breach escalation ───────────────────────────────────

  @Cron('0 * * * *', { name: 'hourly-workflow-sla-check', timeZone: 'UTC' })
  async checkWorkflowSla(): Promise<void> {
    try {
      const escalated = await this.approvalWorkflow.checkSlaBreaches();
      if (escalated > 0) {
        this.logger.warn(`[WorkflowSLA] Escalated ${escalated} overdue workflow step(s)`);
      }
    } catch (err) {
      this.logger.error(`[WorkflowSLA] SLA check failed: ${(err as Error).message}`);
    }
  }

  // ─── Daily: archive expired documents ────────────────────────────────────────

  @Cron('0 1 * * *', { name: 'daily-retention-archive', timeZone: 'UTC' })
  async archiveExpiredDocuments(): Promise<void> {
    this.logger.log('[Retention] Daily retention archive check starting…');

    try {
      const result = await this.prisma.document.updateMany({
        where: {
          deletedAt:   null,
          legalHoldAt: null,
          status:      { not: 'approved' },   // never auto-expire approved/active docs
          retainUntil: { lte: new Date() },
        },
        data: {
          deletedAt: new Date(),
          status:    'archived',
        },
      });

      if (result.count > 0) {
        this.logger.log(`[Retention] Soft-deleted ${result.count} expired document(s)`);
      }
    } catch (err) {
      this.logger.error(`[Retention] Archive job failed: ${(err as Error).message}`);
    }
  }

  // ─── Monthly: purge soft-deleted documents ────────────────────────────────────

  @Cron('30 0 1 * *', { name: 'monthly-retention-purge', timeZone: 'UTC' })
  async purgeExpiredDocuments(): Promise<void> {
    this.logger.log('[Retention] Monthly purge check starting…');

    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

      const docsToDelete = await this.prisma.document.findMany({
        where: {
          deletedAt:   { lte: cutoff },
          legalHoldAt: null,
          purgedAt:    null,
        },
        select: { id: true, orgId: true },
      });

      let purgedCount = 0;
      for (const doc of docsToDelete) {
        await this.prisma.documentVersion.deleteMany({ where: { documentId: doc.id } });
        await this.prisma.document.update({
          where: { id: doc.id },
          data:  { purgedAt: new Date() },
        });
        purgedCount++;
      }

      if (purgedCount > 0) {
        this.logger.log(`[Retention] Purged ${purgedCount} document(s) past retention window`);
      }
    } catch (err) {
      this.logger.error(`[Retention] Purge job failed: ${(err as Error).message}`);
    }
  }

  // ─── Monthly: reset AI token budgets ─────────────────────────────────────────

  /**
   * On the 1st of each month at 00:00 UTC, reset every org's aiTokensUsedMonth
   * counter so teams get a fresh monthly AI budget.
   * Also stamps aiTokensResetAt so the UI can show "resets on X date".
   */
  @Cron('0 0 1 * *', { name: 'monthly-ai-token-reset', timeZone: 'UTC' })
  async resetAiTokenBudgets(): Promise<void> {
    this.logger.log('[AI Budget] Monthly token budget reset starting…');

    try {
      const result = await this.prisma.organization.updateMany({
        where: { aiTokensUsedMonth: { gt: 0 } },
        data: {
          aiTokensUsedMonth: 0,
          aiTokensResetAt:   new Date(),
        },
      });

      this.logger.log(`[AI Budget] Reset token counters for ${result.count} organization(s)`);
    } catch (err) {
      this.logger.error(`[AI Budget] Token reset failed: ${(err as Error).message}`);
    }
  }
}
