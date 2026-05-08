import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly resend: Resend | null;

  constructor() {
    const apiKey = process.env['RESEND_API_KEY'];
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      this.logger.warn('RESEND_API_KEY not set — email notifications are disabled');
    }
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

  // ─── Evidence Expiry Alert ────────────────────────────────────────────────
  async sendEvidenceExpiryAlert(opts: {
    to: string;
    orgName: string;
    expiring: Array<{ title: string; controlCode: string; daysLeft: number }>;
  }): Promise<void> {
    const { to, orgName, expiring } = opts;
    const rows = expiring
      .map(e => `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb">${e.title}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${e.controlCode}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;color:${e.daysLeft <= 7 ? '#ef4444' : '#f59e0b'};font-weight:600">${e.daysLeft}d</td></tr>`)
      .join('');
    await this.send({
      to,
      subject: `⏰ ${expiring.length} Evidence Item${expiring.length > 1 ? 's' : ''} Expiring Soon — ${orgName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#f59e0b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Evidence Expiring Soon</h2>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p>${expiring.length} evidence items for <strong>${orgName}</strong> are expiring and need renewal:</p>
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#f9fafb"><th style="padding:8px;text-align:left">Evidence</th><th style="padding:8px;text-align:left">Control</th><th style="padding:8px;text-align:left">Days Left</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="color:#9ca3af;font-size:12px">Log in to AI Compliance Copilot to renew evidence.</p>
          </div>
        </div>
      `,
    });
  }

  // ─── Auditor RFI Notification ─────────────────────────────────────────────
  async sendAuditorRfiNotification(opts: {
    to: string;
    orgName: string;
    auditorName: string;
    auditorFirm?: string;
    question: string;
    controlCode?: string;
    priority: string;
  }): Promise<void> {
    const { to, orgName, auditorName, auditorFirm, question, controlCode, priority } = opts;
    const priorityColor: Record<string, string> = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
    const color = priorityColor[priority] ?? '#6b7280';
    await this.send({
      to,
      subject: `🔍 New Auditor RFI — ${controlCode ? `[${controlCode}] ` : ''}${orgName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <div style="background:#1e293b;color:#fff;padding:16px 24px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">New Request for Information</h2>
            <p style="margin:4px 0;opacity:.7">${orgName}</p>
          </div>
          <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
            <p><strong>${auditorName}</strong>${auditorFirm ? ` from ${auditorFirm}` : ''} submitted an RFI:</p>
            <div style="background:#f9fafb;border-left:4px solid ${color};padding:16px;border-radius:4px;margin:16px 0">
              <p style="margin:0 0 8px;font-weight:600">${question}</p>
              ${controlCode ? `<p style="margin:4px 0;color:#6b7280;font-family:monospace">Control: ${controlCode}</p>` : ''}
              <p style="margin:4px 0;color:${color};font-size:12px;text-transform:uppercase;font-weight:600">${priority} priority</p>
            </div>
            <p style="color:#6b7280;font-size:12px">Log in to respond to this RFI in the Auditor Portal.</p>
          </div>
        </div>
      `,
    });
  }

  // ─── AI Weekly Digest Email ───────────────────────────────────────────────
  async sendAiDigest(opts: {
    to:       string;
    orgName:  string;
    digest:   string; // markdown from LLM
    metadata: { score: number | string; openHighRisks: number; overdueTasks: number; expiringEvidence: number; recentWins: number };
  }): Promise<void> {
    const { to, orgName, digest, metadata } = opts;
    const scoreColor = Number(metadata.score) >= 80 ? '#10b981' : Number(metadata.score) >= 60 ? '#f59e0b' : '#ef4444';

    // Convert markdown to very basic HTML (bold, headers, bullets)
    const bodyHtml = digest
      .replace(/^### (.+)$/gm, '<h3 style="margin:20px 0 8px;color:#1e293b">$1</h3>')
      .replace(/^## (.+)$/gm,  '<h2 style="margin:24px 0 8px;color:#1e293b">$1</h2>')
      .replace(/^# (.+)$/gm,   '<h1 style="margin:0 0 8px;color:#1e293b">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm,   '<li style="margin:4px 0;color:#374151">$1</li>')
      .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
      .replace(/\n\n/g, '<br/>');

    await this.send({
      to,
      subject: `📊 Weekly Compliance Digest — ${orgName}`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto">
          <div style="background:#1e293b;color:#fff;padding:20px 28px;border-radius:8px 8px 0 0">
            <h2 style="margin:0">Weekly Compliance Digest</h2>
            <p style="margin:4px 0;opacity:.7;font-size:14px">${orgName}</p>
          </div>
          <div style="padding:4px 0;background:#f8fafc;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb">
            <div style="display:flex;gap:0;text-align:center">
              <div style="flex:1;padding:14px 8px;border-right:1px solid #e5e7eb">
                <div style="font-size:26px;font-weight:700;color:${scoreColor}">${metadata.score}%</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">Readiness</div>
              </div>
              <div style="flex:1;padding:14px 8px;border-right:1px solid #e5e7eb">
                <div style="font-size:26px;font-weight:700;color:${metadata.openHighRisks > 0 ? '#ef4444' : '#10b981'}">${metadata.openHighRisks}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">Open Risks</div>
              </div>
              <div style="flex:1;padding:14px 8px;border-right:1px solid #e5e7eb">
                <div style="font-size:26px;font-weight:700;color:${metadata.overdueTasks > 0 ? '#f97316' : '#10b981'}">${metadata.overdueTasks}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">Overdue Tasks</div>
              </div>
              <div style="flex:1;padding:14px 8px">
                <div style="font-size:26px;font-weight:700;color:#10b981">${metadata.recentWins}</div>
                <div style="font-size:11px;color:#6b7280;margin-top:2px">Recent Wins</div>
              </div>
            </div>
          </div>
          <div style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;background:#fff">
            <div style="font-size:14px;line-height:1.7;color:#374151">${bodyHtml}</div>
            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb"/>
            <p style="color:#9ca3af;font-size:12px;margin:0">Sent by AI Compliance Copilot. Log in to view full details.</p>
          </div>
        </div>
      `,
    });
  }

  // ─── Slack Webhook Notification ───────────────────────────────────────────
  async sendSlackNotification(webhookUrl: string, message: {
    text: string;
    blocks?: unknown[];
  }): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!response.ok) {
        this.logger.warn(`Slack webhook failed: ${response.status}`);
      }
    } catch (err: any) {
      this.logger.error(`Slack webhook error: ${err.message}`);
      // Never throw
    }
  }

  // ─── Private helper ───────────────────────────────────────────────────────

  private async send(opts: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email skipped (no API key): ${opts.subject}`);
      return;
    }
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
