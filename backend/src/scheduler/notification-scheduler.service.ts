import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ResendService } from '../notifications/resend.service';

/**
 * NotificationSchedulerService
 *
 * Sends automated email/Slack notifications on a schedule:
 *
 *  • Daily   08:00 UTC — Evidence expiry alerts (7-day warning window)
 *  • Weekly  Mon 09:00 UTC — Weekly compliance digest to all org admins
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendService,
  ) {}

  // ─── Daily: Evidence expiry alerts ──────────────────────────────────────────
  @Cron('0 8 * * *', { name: 'daily-evidence-expiry-alerts', timeZone: 'UTC' })
  async sendDailyExpiryAlerts(): Promise<void> {
    this.logger.log('[Notifications] Daily evidence expiry check starting…');

    const in7Days = new Date(Date.now() + 7 * 86400_000);
    const now = new Date();

    // Find all orgs with evidence expiring in the next 7 days
    const expiringEvidence = await this.prisma.evidence.findMany({
      where: {
        isValid: true,
        expiresAt: { gte: now, lte: in7Days },
      },
      include: {
        control: { select: { code: true } },
      },
      take: 500,
    });

    // Group by orgId
    const byOrg = new Map<string, typeof expiringEvidence>();
    for (const ev of expiringEvidence) {
      if (!byOrg.has(ev.orgId)) byOrg.set(ev.orgId, []);
      byOrg.get(ev.orgId)!.push(ev);
    }

    // Send emails to org admins
    let notified = 0;
    for (const [orgId, items] of byOrg.entries()) {
      try {
        const org = await this.prisma.organization.findUnique({
          where: { id: orgId },
          select: {
            name: true,
            settings: true,
            users: {
              where: { role: 'admin', isActive: true },
              select: { email: true, fullName: true },
              take: 3,
            },
          },
        });

        if (!org) continue;

        const expiryList = items.map((ev) => ({
          title: ev.title,
          controlCode: (ev as any).control?.code ?? '—',
          daysLeft: Math.ceil(((ev.expiresAt?.getTime() ?? now.getTime()) - now.getTime()) / 86400_000),
        }));

        for (const admin of org.users ?? []) {
          await this.resend.sendEvidenceExpiryAlert({
            to: admin.email,
            orgName: org.name,
            expiring: expiryList,
          });
          notified++;
        }

        // Slack notification if configured
        const slackUrl = (org.settings as any)?.slackWebhookUrl;
        if (slackUrl) {
          await this.resend.sendSlackNotification(slackUrl, {
            text: `⏰ *${org.name}*: ${items.length} evidence item${items.length !== 1 ? 's' : ''} expiring in the next 7 days. Log in to renew.`,
          });
        }
      } catch (err: any) {
        this.logger.error(`Expiry alert failed for org ${orgId}: ${err.message}`);
      }
    }

    this.logger.log(`[Notifications] Expiry alerts: ${byOrg.size} orgs, ${notified} emails sent`);
  }

  // ─── Weekly: Compliance digest ───────────────────────────────────────────────
  @Cron('0 9 * * 1', { name: 'weekly-digest', timeZone: 'UTC' })
  async sendWeeklyDigest(): Promise<void> {
    this.logger.log('[Notifications] Weekly digest starting…');

    const orgs = await this.prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        settings: true,
        users: {
          where: { role: 'admin', isActive: true },
          select: { email: true, fullName: true },
          take: 3,
        },
      },
    });

    let sent = 0;
    for (const org of orgs) {
      try {
        if (!org.users.length) continue;

        const summary = await this.getOrgWeeklySummary(org.id);

        for (const admin of org.users) {
          await this.resend.sendWeeklyDigest({
            to:      admin.email,
            orgName: org.name,
            summary,
          });
          sent++;
        }
      } catch (err: any) {
        this.logger.error(`Weekly digest failed for org ${org.id}: ${err.message}`);
      }
    }

    this.logger.log(`[Notifications] Weekly digest: ${orgs.length} orgs, ${sent} emails sent`);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async getOrgWeeklySummary(orgId: string) {
    const oneWeekAgo = new Date(Date.now() - 7 * 86400_000);

    const [passCount, failCount, overdueCount] = await Promise.all([
      this.prisma.controlTestResult.count({
        where: { orgId, outcome: 'pass', testedAt: { gte: oneWeekAgo } },
      }),
      this.prisma.controlTestResult.count({
        where: { orgId, outcome: { in: ['fail', 'error'] }, testedAt: { gte: oneWeekAgo } },
      }),
      this.prisma.task.count({
        where: {
          orgId,
          status: { not: 'done' },
          dueDate: { lt: new Date() },
        },
      }),
    ]);

    const total = passCount + failCount;
    return {
      pass:     passCount,
      fail:     failCount,
      overdue:  overdueCount,
      passRate: total > 0 ? Math.round((passCount / total) * 100) : 0,
    };
  }
}
