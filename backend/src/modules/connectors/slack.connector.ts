import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { ComplianceConnector, ConnectorEvidence } from './connector.interface';
import { DocumentApprovedEvent, DocumentRejectedEvent, DocumentLegalHoldSetEvent } from '../documents/events/document.events';

@Injectable()
export class SlackConnector implements ComplianceConnector {
  readonly id                = 'slack';
  readonly name              = 'Slack';
  readonly logoUrl           = 'https://a.slack-edge.com/80588/marketing/img/meta/favicon-32.png';
  readonly supportedControls = []; // Slack doesn't directly map to controls

  private readonly logger = new Logger(SlackConnector.name);

  constructor(private readonly prisma: PrismaService) {}

  async connect(orgId: string, credentials: Record<string, string>): Promise<void> {
    await this.prisma.connectorCredential.upsert({
      where:  { orgId_connectorId: { orgId, connectorId: this.id } },
      create: { orgId, connectorId: this.id, credentials, status: 'active' },
      update: { credentials, status: 'active' },
    });
  }

  async disconnect(orgId: string): Promise<void> {
    await this.prisma.connectorCredential.updateMany({
      where: { orgId, connectorId: this.id },
      data:  { status: 'disconnected' },
    });
  }

  async testConnection(orgId: string): Promise<{ ok: boolean; error?: string }> {
    const cred = await this.prisma.connectorCredential.findUnique({
      where: { orgId_connectorId: { orgId, connectorId: this.id } },
    });
    if (!cred || cred.status !== 'active') {
      return { ok: false, error: 'Not connected' };
    }
    const token = (cred.credentials as Record<string, string>).botToken;
    if (!token) return { ok: false, error: 'Missing bot token' };

    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json() as { ok: boolean; error?: string };
      return data.ok ? { ok: true } : { ok: false, error: data.error };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async collectEvidence(_orgId: string, _controlId: string): Promise<ConnectorEvidence[]> {
    return []; // Slack does not provide compliance evidence directly
  }

  // ── Event-driven notifications ───────────────────────────────────────────────

  @OnEvent('document.approved')
  async onDocumentApproved(event: DocumentApprovedEvent): Promise<void> {
    await this.sendMessage(event.orgId,
      `✅ *Document Approved*: "${event.title}" (${event.classification.toUpperCase()}) was approved. Controls covered: ${event.controlIds.join(', ') || 'none'}.`
    );
  }

  @OnEvent('document.rejected')
  async onDocumentRejected(event: DocumentRejectedEvent): Promise<void> {
    await this.sendMessage(event.orgId,
      `❌ *Document Rejected*: "${event.title}" was rejected. Reason: ${event.reason}`
    );
  }

  @OnEvent('document.legal_hold.set')
  async onLegalHoldSet(event: DocumentLegalHoldSetEvent): Promise<void> {
    await this.sendMessage(event.orgId,
      `🔒 *Legal Hold Set*: Document ID ${event.documentId} is now under legal hold. Reason: ${event.reason}`
    );
  }

  // ── Internal helper ──────────────────────────────────────────────────────────

  private async sendMessage(orgId: string, text: string): Promise<void> {
    try {
      const cred = await this.prisma.connectorCredential.findUnique({
        where: { orgId_connectorId: { orgId, connectorId: this.id } },
      });
      if (!cred || cred.status !== 'active') return;

      const { botToken, channelId } = cred.credentials as Record<string, string>;
      if (!botToken || !channelId) return;

      await fetch('https://slack.com/api/chat.postMessage', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${botToken}`,
        },
        body: JSON.stringify({ channel: channelId, text }),
      });
    } catch (err) {
      this.logger.warn(`Slack notification failed for org ${orgId}: ${(err as Error).message}`);
    }
  }
}
