import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { ResendService } from '../notifications/resend.service';
import { NotificationService } from '../notifications/notification.service';
import { ApprovalWorkflowService } from '../modules/approval-workflow/approval-workflow.service';

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
    private readonly prisma:            PrismaService,
    private readonly resend:            ResendService,
    private readonly notifications:     NotificationService,
    @Optional() private readonly approvalWorkflow: ApprovalWorkflowService | null,
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

    // Send emails + in-app notifications to org admins
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
              select: { id: true, email: true, fullName: true },
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

        const criticalCount = expiryList.filter((e) => e.daysLeft <= 2).length;
        const notifPriority = criticalCount > 0 ? 'high' : 'normal';

        for (const admin of org.users ?? []) {
          // Email alert
          await this.resend.sendEvidenceExpiryAlert({
            to: admin.email,
            orgName: org.name,
            expiring: expiryList,
          });

          // In-app bell notification
          await this.notifications.send(orgId, admin.id, {
            type:     'evidence.expiring',
            title:    `${items.length} evidence item${items.length !== 1 ? 's' : ''} expiring soon`,
            body:     expiryList.slice(0, 3).map((e) => `${e.controlCode}: ${e.title} (${e.daysLeft}d)`).join(' · '),
            href:     '/evidence',
            priority: notifPriority,
          }).catch(() => {});

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

  // ─── Hourly: Approval workflow SLA checks ────────────────────────────────────
  @Cron('0 * * * *', { name: 'workflow-sla-check', timeZone: 'UTC' })
  async checkWorkflowSlas(): Promise<void> {
    if (!this.approvalWorkflow) return;
    try {
      const breached = await this.approvalWorkflow.checkSlaBreaches();
      if (breached > 0) {
        this.logger.warn(`[WorkflowSLA] Escalated ${breached} overdue approval(s)`);
      }
    } catch (err: any) {
      this.logger.error(`Workflow SLA check failed: ${err.message}`);
    }
  }

  // ─── Every 30 min: Incident SLA breach alerts ────────────────────────────────
  // CRITICAL=4h, HIGH=24h, MEDIUM=72h — notify assignee + SECURITY_LEAD on breach
  @Cron('*/30 * * * *', { name: 'incident-sla-check', timeZone: 'UTC' })
  async checkIncidentSlas(): Promise<void> {
    const SLA_HOURS: Record<string, number> = {
      CRITICAL: 4, HIGH: 24, MEDIUM: 72, LOW: 168, INFORMATIONAL: 720,
    };

    try {
      const openIncidents = await this.prisma.securityIncident.findMany({
        where:   { status: { not: 'closed' }, containedAt: null },
        select:  { id: true, orgId: true, title: true, severity: true, detectedAt: true, assignedTo: true },
      });

      let breached = 0;

      for (const incident of openIncidents) {
        const slaHours = SLA_HOURS[incident.severity] ?? 168;
        const deadline = new Date(incident.detectedAt.getTime() + slaHours * 3_600_000);

        if (new Date() <= deadline) continue;

        breached++;

        // Notify the assigned responder
        if (incident.assignedTo) {
          await this.notifications.send(incident.orgId, incident.assignedTo, {
            type:     'incident.sla_breach',
            title:    `⚠️ Incident SLA breached: ${incident.title}`,
            body:     `${incident.severity} incident exceeded ${slaHours}h containment SLA. Immediate action required.`,
            href:     `/incidents`,
            priority: 'high',
          }).catch(() => {});
        }

        // Also notify the SECURITY_LEAD via role-based notification
        const securityLead = await this.prisma.complianceResponsibility.findFirst({
          where:  { orgId: incident.orgId, role: 'SECURITY_LEAD', isPrimary: true },
          select: { userId: true },
        });
        if (securityLead && securityLead.userId !== incident.assignedTo) {
          await this.notifications.send(incident.orgId, securityLead.userId, {
            type:     'incident.sla_breach',
            title:    `⚠️ SLA breach: ${incident.title}`,
            body:     `${incident.severity} incident (${incident.id.slice(0, 8)}) has exceeded its ${slaHours}h containment SLA.`,
            href:     `/incidents`,
            priority: 'high',
          }).catch(() => {});
        }
      }

      if (breached > 0) {
        this.logger.warn(`[IncidentSLA] ${breached} incident(s) have breached containment SLA`);
      }
    } catch (err: any) {
      this.logger.error(`Incident SLA check failed: ${err.message}`);
    }
  }
}
