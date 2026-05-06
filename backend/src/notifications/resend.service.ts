import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env['RESEND_API_KEY'] ?? '');
  }

  private get from(): string {
    const domain = process.env['RESEND_FROM_DOMAIN'];
    return domain ? `Compliance Copilot <compliance@${domain}>` : 'Compliance Copilot <onboarding@resend.dev>';
  }

  // ─── Control Test Failure Alert ──────────────────────────────────────────

  async sendTestFailureAlert(opts: {
    to:       string;
    orgName:  string;
    testName: string;
    testId:   string;
    details:  Record<string, unknown>;
  }): Promise<void> {
    const { to, orgName, testName, testId, details } = opts;

    const detailsHtml = Object.entries(details)
      .map(([k, v]) => `<li><strong>${k}:</strong> ${JSON.stringify(v)}</li>`)
      .join('');

    await this.send({
      to,
      subject:  `⚠️ Control Test Failed — ${testName} [${orgName}]`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#ef4444;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Control Test Failed</h2>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>The following automated compliance test failed for <strong>${orgName}</strong>:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0">
              <tr><td style="padding:8px;background:#f9fafb;font-weight:600;width:40%">Test</td><td style="padding:8px">${testName}</td></tr>
              <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Test ID</td><td style="padding:8px;font-family:monospace">${testId}</td></tr>
            </table>
            <h3>Details</h3>
            <ul style="color:#374151">${detailsHtml}</ul>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="color:#9ca3af;font-size:12px">This alert was sent by AI Compliance Copilot. Log in to review and remediate.</p>
          </div>
        </div>
      `,
    });
  }

  // ─── Task Assignment Notification ────────────────────────────────────────

  async sendTaskAssignment(opts: {
    to:         string;
    assigneeName: string;
    taskTitle:  string;
    taskId:     string;
    dueDate?:   string;
    priority:   string;
  }): Promise<void> {
    const { to, assigneeName, taskTitle, taskId, dueDate, priority } = opts;

    const priorityColor: Record<string, string> = {
      critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#10b981',
    };
    const color = priorityColor[priority] ?? '#6b7280';

    await this.send({
      to,
      subject: `📋 New Task Assigned — ${taskTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#6366f1;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">New Task Assigned</h2>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>Hi ${assigneeName}, a compliance task has been assigned to you:</p>
            <div style="background:#f9fafb;border-left:4px solid ${color};padding:16px;border-radius:4px;margin:16px 0">
              <h3 style="margin:0 0 8px">${taskTitle}</h3>
              <p style="margin:4px 0;color:#6b7280">Priority: <span style="color:${color};font-weight:600">${priority.toUpperCase()}</span></p>
              ${dueDate ? `<p style="margin:4px 0;color:#6b7280">Due: ${dueDate}</p>` : ''}
            </div>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="color:#9ca3af;font-size:12px">Task ID: ${taskId}</p>
          </div>
        </div>
      `,
    });
  }

  // ─── Weekly Digest ───────────────────────────────────────────────────────

  async sendWeeklyDigest(opts: {
    to:      string;
    orgName: string;
    summary: { pass: number; fail: number; overdue: number; passRate: number };
  }): Promise<void> {
    const { to, orgName, summary } = opts;
    const statusColor = summary.passRate >= 80 ? '#10b981' : summary.passRate >= 60 ? '#f59e0b' : '#ef4444';

    await this.send({
      to,
      subject: `📊 Weekly Compliance Digest — ${orgName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e293b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Weekly Compliance Digest</h2>
            <p style="margin:4px 0;opacity:.7">${orgName}</p>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <div style="display:flex;gap:16px;margin:16px 0">
              <div style="flex:1;text-align:center;padding:16px;background:#f0fdf4;border-radius:8px">
                <div style="font-size:32px;font-weight:700;color:#10b981">${summary.pass}</div>
                <div style="color:#374151">Tests Passing</div>
              </div>
              <div style="flex:1;text-align:center;padding:16px;background:#fef2f2;border-radius:8px">
                <div style="font-size:32px;font-weight:700;color:#ef4444">${summary.fail}</div>
                <div style="color:#374151">Tests Failing</div>
              </div>
              <div style="flex:1;text-align:center;padding:16px;background:#fff7ed;border-radius:8px">
                <div style="font-size:32px;font-weight:700;color:#f97316">${summary.overdue}</div>
                <div style="color:#374151">Overdue Tasks</div>
              </div>
            </div>
            <div style="text-align:center;padding:16px;background:#f9fafb;border-radius:8px;margin:16px 0">
              <div style="font-size:48px;font-weight:700;color:${statusColor}">${summary.passRate}%</div>
              <div style="color:#6b7280">Overall Pass Rate</div>
            </div>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="color:#9ca3af;font-size:12px">Sent by AI Compliance Copilot. Log in to review details.</p>
          </div>
        </div>
      `,
    });
  }

  // ─── Private helper ───────────────────────────────────────────────────────

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    try {
      const result = await this.resend.emails.send({
        from:    this.from,
        to:      opts.to,
        subject: opts.subject,
        html:    opts.html,
      });

      if (result.error) {
        this.logger.error(`Resend error: ${JSON.stringify(result.error)}`);
      } else {
        this.logger.log(`Email sent to ${opts.to}: ${opts.subject}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${opts.to}: ${err.message}`);
      // Never throw — email failures should not break the main flow
    }
  }
}
