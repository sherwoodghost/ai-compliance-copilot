import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class IngestionNotificationService {
  private readonly logger = new Logger(IngestionNotificationService.name);
  private readonly resendApiKey: string;
  private readonly fromDomain: string;
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY', '');
    this.fromDomain = this.config.get<string>('RESEND_FROM_DOMAIN', 'compliance-copilot.com');
    this.appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
  }

  /**
   * Send email notification when an ingestion batch completes processing.
   * Only sends if RESEND_API_KEY is configured.
   */
  async notifyBatchCompleted(batchId: string, orgId: string): Promise<void> {
    if (!this.resendApiKey) {
      this.logger.debug('Skipping batch notification — RESEND_API_KEY not configured');
      return;
    }

    try {
      // Get batch details
      const batch = await this.prisma.ingestionBatch.findFirst({
        where: { id: batchId, orgId },
      });
      if (!batch) return;

      // Get org admin emails
      const admins = await this.prisma.user.findMany({
        where: { orgId, role: 'admin' },
        select: { email: true, fullName: true },
      });
      if (admins.length === 0) return;

      const reviewUrl = `${this.appUrl}/import`;
      const subject = batch.needsReview > 0
        ? `Import complete — ${batch.needsReview} files need review`
        : `Import complete — ${batch.autoPlaced} files auto-placed`;

      const html = this.buildBatchEmailHtml({
        totalFiles: batch.totalFiles,
        autoPlaced: batch.autoPlaced,
        needsReview: batch.needsReview,
        failed: batch.failed,
        reviewUrl,
      });

      // Send via Resend
      const { Resend } = await import('resend');
      const resend = new Resend(this.resendApiKey);

      for (const admin of admins) {
        await resend.emails.send({
          from: `Compliance Copilot <notifications@${this.fromDomain}>`,
          to: admin.email,
          subject,
          html,
        });
      }

      this.logger.log(`Batch ${batchId} notification sent to ${admins.length} admin(s)`);
    } catch (err: any) {
      this.logger.warn(`Failed to send batch notification: ${err.message}`);
      // Don't throw — notification failure shouldn't break the pipeline
    }
  }

  buildBatchEmailHtml(data: {
    totalFiles: number;
    autoPlaced: number;
    needsReview: number;
    failed: number;
    reviewUrl: string;
  }): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e293b; color: white; padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">Document Import Complete</h1>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
          <p style="color: #475569; margin-top: 0;">Your batch import has finished processing <strong>${data.totalFiles} files</strong>.</p>

          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px 0; color: #16a34a; font-weight: 600;">&#10003; Auto-placed</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.autoPlaced}</td>
            </tr>
            ${data.needsReview > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #d97706; font-weight: 600;">&#9888; Needs review</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.needsReview}</td>
            </tr>` : ''}
            ${data.failed > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #dc2626; font-weight: 600;">&#10007; Failed</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.failed}</td>
            </tr>` : ''}
          </table>

          ${data.needsReview > 0 ? `
          <a href="${data.reviewUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
            Review ${data.needsReview} files &rarr;
          </a>` : ''}
        </div>
        <div style="padding: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
          Compliance Copilot — Automated document management
        </div>
      </div>
    `;
  }
}
