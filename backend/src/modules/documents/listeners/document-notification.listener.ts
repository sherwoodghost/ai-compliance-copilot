import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationService } from '../../../notifications/notification.service';
import {
  DocumentApprovedEvent,
  DocumentApprovalRequestedEvent,
  DocumentRejectedEvent,
  DocumentLegalHoldSetEvent,
} from '../events/document.events';

/**
 * Sends in-app notifications for key document lifecycle events.
 *
 * Routing logic:
 *  - approval_requested → notify all users with COMPLIANCE_LEAD or approver platform role
 *  - approved           → notify document owner (queried from DB)
 *  - rejected           → notify document author (authorId from event)
 *  - legal_hold.set     → notify all COMPLIANCE_LEAD users in the org
 */
@Injectable()
export class DocumentNotificationListener {
  private readonly logger = new Logger(DocumentNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ── Approval requested ───────────────────────────────────────────────────────

  @OnEvent('document.approval_requested')
  async onApprovalRequested(e: DocumentApprovalRequestedEvent): Promise<void> {
    try {
      // Notify users who can approve: admins + owners in the org (excluding requester)
      const approvers = await this.prisma.user.findMany({
        where: {
          orgId:    e.orgId,
          role:     { in: ['admin'] },
          isActive: true,
          id:       { not: e.requestedBy },
        },
        select: { id: true },
      });

      await Promise.all(
        approvers.map((u) =>
          this.notifications.send(e.orgId, u.id, {
            type:     'document.approval_requested',
            title:    `Document awaiting your approval`,
            body:     `"${e.title}" has been submitted for review`,
            href:     `/documents`,
            priority: 'normal',
          }).catch(() => {}),
        ),
      );
    } catch (err) {
      this.logger.warn(`Failed to send approval-request notifications: ${(err as Error).message}`);
    }
  }

  // ── Document approved ────────────────────────────────────────────────────────

  @OnEvent('document.approved')
  async onApproved(e: DocumentApprovedEvent): Promise<void> {
    try {
      // Find the document owner to notify them
      const doc = await this.prisma.document.findFirst({
        where:  { id: e.documentId, orgId: e.orgId },
        select: { ownerId: true },
      });

      if (!doc?.ownerId || doc.ownerId === e.approvedBy) return;

      await this.notifications.send(e.orgId, doc.ownerId, {
        type:     'document.approved',
        title:    `Your document was approved`,
        body:     `"${e.title}" is now approved and active`,
        href:     `/documents`,
        priority: 'normal',
      });
    } catch (err) {
      this.logger.warn(`Failed to send document-approved notification: ${(err as Error).message}`);
    }
  }

  // ── Document rejected ────────────────────────────────────────────────────────

  @OnEvent('document.rejected')
  async onRejected(e: DocumentRejectedEvent): Promise<void> {
    if (!e.authorId || e.authorId === e.rejectedBy) return;
    try {
      await this.notifications.send(e.orgId, e.authorId, {
        type:     'document.rejected',
        title:    `Document review: changes requested`,
        body:     `"${e.title}" — ${e.reason}`,
        href:     `/documents`,
        priority: 'high',
      });
    } catch (err) {
      this.logger.warn(`Failed to send document-rejected notification: ${(err as Error).message}`);
    }
  }

  // ── Legal hold set ───────────────────────────────────────────────────────────

  @OnEvent('document.legal_hold.set')
  async onLegalHoldSet(e: DocumentLegalHoldSetEvent): Promise<void> {
    try {
      // Notify all compliance leads and admins in the org
      const leads = await this.prisma.user.findMany({
        where: {
          orgId:    e.orgId,
          role:     { in: ['admin'] },
          isActive: true,
          id:       { not: e.actorId },
        },
        select: { id: true },
      });

      await Promise.all(
        leads.map((u) =>
          this.notifications.send(e.orgId, u.id, {
            type:     'document.legal_hold',
            title:    `Legal hold applied to a document`,
            body:     `Document ${e.documentId} is now under legal hold`,
            href:     `/documents`,
            priority: 'high',
          }).catch(() => {}),
        ),
      );
    } catch (err) {
      this.logger.warn(`Failed to send legal-hold notification: ${(err as Error).message}`);
    }
  }
}
