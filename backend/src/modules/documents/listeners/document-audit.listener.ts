import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import {
  DocumentApprovedEvent,
  DocumentApprovalRequestedEvent,
  DocumentArchivedEvent,
  DocumentCreatedEvent,
  DocumentLegalHoldReleasedEvent,
  DocumentLegalHoldSetEvent,
  DocumentRejectedEvent,
  DocumentUpdatedEvent,
  DocumentVersionCreatedEvent,
} from '../events/document.events';

@Injectable()
export class DocumentAuditListener {
  private readonly logger = new Logger(DocumentAuditListener.name);

  constructor(private readonly prisma: PrismaService) {}

  private async log(
    orgId:      string,
    actorId:    string,
    action:     string,
    targetId:   string,
    after?:     Record<string, unknown>,
  ) {
    try {
      await this.prisma.teamAuditLog.create({
        data: {
          orgId,
          actorId,
          action,
          targetType: 'Document',
          targetId,
          after: (after ?? {}) as Record<string, string>,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log write failed: ${(err as Error).message}`);
    }
  }

  @OnEvent('document.created')
  async onCreated(e: DocumentCreatedEvent) {
    await this.log(e.orgId, e.actorId, 'document.created', e.documentId, { title: e.title });
  }

  @OnEvent('document.updated')
  async onUpdated(e: DocumentUpdatedEvent) {
    await this.log(e.orgId, e.actorId, 'document.updated', e.documentId);
  }

  @OnEvent('document.approval_requested')
  async onApprovalRequested(e: DocumentApprovalRequestedEvent) {
    await this.log(e.orgId, e.requestedBy, 'document.approval_requested', e.documentId, { title: e.title });
  }

  @OnEvent('document.approved')
  async onApproved(e: DocumentApprovedEvent) {
    await this.log(e.orgId, e.approvedBy, 'document.approved', e.documentId, { title: e.title, classification: e.classification });
  }

  @OnEvent('document.rejected')
  async onRejected(e: DocumentRejectedEvent) {
    await this.log(e.orgId, e.rejectedBy, 'document.rejected', e.documentId, { title: e.title, reason: e.reason });
  }

  @OnEvent('document.archived')
  async onArchived(e: DocumentArchivedEvent) {
    await this.log(e.orgId, e.actorId, 'document.archived', e.documentId);
  }

  @OnEvent('document.version_created')
  async onVersionCreated(e: DocumentVersionCreatedEvent) {
    await this.log(e.orgId, e.actorId, 'document.version_created', e.documentId, { version: e.version });
  }

  @OnEvent('document.legal_hold.set')
  async onLegalHoldSet(e: DocumentLegalHoldSetEvent) {
    await this.log(e.orgId, e.actorId, 'document.legal_hold.set', e.documentId, { reason: e.reason });
  }

  @OnEvent('document.legal_hold.released')
  async onLegalHoldReleased(e: DocumentLegalHoldReleasedEvent) {
    await this.log(e.orgId, e.actorId, 'document.legal_hold.released', e.documentId);
  }
}
