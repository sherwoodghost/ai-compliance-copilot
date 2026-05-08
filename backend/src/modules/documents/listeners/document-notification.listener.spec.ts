/**
 * DocumentNotificationListener — Unit Tests (P19 — E2)
 *
 * Verifies that notification routing is correct for all document lifecycle events:
 *  - approval_requested → notify all admin users in org (except requester)
 *  - approved           → notify document owner (skip if owner = approver)
 *  - rejected           → notify document author (skip if author = rejector)
 *  - legal_hold.set     → notify all admin users in org (except actor)
 */

import { DocumentNotificationListener } from './document-notification.listener';
import {
  DocumentApprovalRequestedEvent,
  DocumentApprovedEvent,
  DocumentRejectedEvent,
  DocumentLegalHoldSetEvent,
} from '../events/document.events';

// ── Constants ────────────────────────────────────────────────────────────────

const ORG      = 'org-001';
const ACTOR_A  = 'user-a';  // Author / requester
const ACTOR_B  = 'user-b';  // Approver / admin
const ACTOR_C  = 'user-c';  // Another admin
const DOC_ID   = 'doc-001';
const DOC_TITLE = 'Information Security Policy';

// ── Mock factory ─────────────────────────────────────────────────────────────

function makeMockPrisma(admins: Array<{ id: string }> = [{ id: ACTOR_B }, { id: ACTOR_C }]) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(admins),
    },
    document: {
      findFirst: jest.fn().mockResolvedValue({ ownerId: ACTOR_A }),
    },
  };
}

function makeMockNotifications() {
  return {
    send: jest.fn().mockResolvedValue(undefined),
  };
}

function makeListener(
  prisma = makeMockPrisma(),
  notifications = makeMockNotifications(),
) {
  return new DocumentNotificationListener(prisma as any, notifications as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DocumentNotificationListener', () => {
  // ── approval_requested ────────────────────────────────────────────────────

  describe('onApprovalRequested', () => {
    it('should notify all admins except the requester', async () => {
      const prisma = makeMockPrisma([{ id: ACTOR_B }, { id: ACTOR_C }]);
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovalRequestedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_A, null);
      await listener.onApprovalRequested(event);

      // Should query admins in the same org, excluding the requester
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId:    ORG,
            role:     { in: ['admin'] },
            isActive: true,
            id:       { not: ACTOR_A },
          }),
        }),
      );

      // Both admins should receive notifications
      expect(notifications.send).toHaveBeenCalledTimes(2);
      expect(notifications.send).toHaveBeenCalledWith(
        ORG,
        ACTOR_B,
        expect.objectContaining({
          type:  'document.approval_requested',
          title: 'Document awaiting your approval',
        }),
      );
      expect(notifications.send).toHaveBeenCalledWith(
        ORG,
        ACTOR_C,
        expect.objectContaining({ type: 'document.approval_requested' }),
      );
    });

    it('should send no notifications when there are no admins', async () => {
      const prisma = makeMockPrisma([]);
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovalRequestedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_A, null);
      await listener.onApprovalRequested(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not throw even when notification.send rejects', async () => {
      const prisma = makeMockPrisma([{ id: ACTOR_B }]);
      const notifications = { send: jest.fn().mockRejectedValue(new Error('SMTP error')) };
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovalRequestedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_A, null);

      // Should resolve without throwing — errors are swallowed per .catch(() => {})
      await expect(listener.onApprovalRequested(event)).resolves.not.toThrow();
    });

    it('should not throw when prisma query fails', async () => {
      const prisma = {
        user: { findMany: jest.fn().mockRejectedValue(new Error('DB down')) },
        document: { findFirst: jest.fn() },
      };
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovalRequestedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_A, null);
      await expect(listener.onApprovalRequested(event)).resolves.not.toThrow();
    });
  });

  // ── approved ──────────────────────────────────────────────────────────────

  describe('onApproved', () => {
    it('should notify the document owner', async () => {
      const prisma = makeMockPrisma();
      (prisma.document.findFirst as jest.Mock).mockResolvedValue({ ownerId: ACTOR_A });
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []);
      await listener.onApproved(event);

      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send).toHaveBeenCalledWith(
        ORG,
        ACTOR_A,
        expect.objectContaining({
          type:  'document.approved',
          title: 'Your document was approved',
        }),
      );
    });

    it('should not notify when approver is also the owner (self-approval guard)', async () => {
      const prisma = makeMockPrisma();
      // Owner and approver are the same user
      (prisma.document.findFirst as jest.Mock).mockResolvedValue({ ownerId: ACTOR_B });
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []);
      await listener.onApproved(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not notify when document has no owner', async () => {
      const prisma = makeMockPrisma();
      (prisma.document.findFirst as jest.Mock).mockResolvedValue({ ownerId: null });
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []);
      await listener.onApproved(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not notify when document is not found', async () => {
      const prisma = makeMockPrisma();
      (prisma.document.findFirst as jest.Mock).mockResolvedValue(null);
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []);
      await listener.onApproved(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not throw when notification fails', async () => {
      const prisma = makeMockPrisma();
      (prisma.document.findFirst as jest.Mock).mockResolvedValue({ ownerId: ACTOR_A });
      const notifications = { send: jest.fn().mockRejectedValue(new Error('timeout')) };
      const listener = makeListener(prisma, notifications);

      const event = new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []);
      await expect(listener.onApproved(event)).resolves.not.toThrow();
    });
  });

  // ── rejected ──────────────────────────────────────────────────────────────

  describe('onRejected', () => {
    it('should notify the document author', async () => {
      const prisma = makeMockPrisma();
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentRejectedEvent(
        ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'Missing risk section', ACTOR_A,
      );
      await listener.onRejected(event);

      expect(notifications.send).toHaveBeenCalledTimes(1);
      expect(notifications.send).toHaveBeenCalledWith(
        ORG,
        ACTOR_A,
        expect.objectContaining({
          type:     'document.rejected',
          title:    'Document review: changes requested',
          priority: 'high',
          body:     expect.stringContaining('Missing risk section'),
        }),
      );
    });

    it('should not notify when author is also the rejector', async () => {
      const prisma = makeMockPrisma();
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      // Author and rejector are the same user
      const event = new DocumentRejectedEvent(
        ORG, DOC_ID, DOC_TITLE, ACTOR_A, 'reason', ACTOR_A,
      );
      await listener.onRejected(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not notify when there is no author (authorId is null)', async () => {
      const prisma = makeMockPrisma();
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentRejectedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'reason', null);
      await listener.onRejected(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not throw when notification fails', async () => {
      const prisma = makeMockPrisma();
      const notifications = { send: jest.fn().mockRejectedValue(new Error('error')) };
      const listener = makeListener(prisma, notifications);

      const event = new DocumentRejectedEvent(
        ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'reason', ACTOR_A,
      );
      await expect(listener.onRejected(event)).resolves.not.toThrow();
    });
  });

  // ── legal_hold.set ────────────────────────────────────────────────────────

  describe('onLegalHoldSet', () => {
    it('should notify all admin users except the actor', async () => {
      const prisma = makeMockPrisma([{ id: ACTOR_B }, { id: ACTOR_C }]);
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentLegalHoldSetEvent(ORG, DOC_ID, ACTOR_A, 'Litigation hold');
      await listener.onLegalHoldSet(event);

      // Should query admins excluding the actor
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orgId:    ORG,
            role:     { in: ['admin'] },
            isActive: true,
            id:       { not: ACTOR_A },
          }),
        }),
      );

      // Both admins should be notified
      expect(notifications.send).toHaveBeenCalledTimes(2);
      expect(notifications.send).toHaveBeenCalledWith(
        ORG,
        ACTOR_B,
        expect.objectContaining({
          type:     'document.legal_hold',
          title:    'Legal hold applied to a document',
          priority: 'high',
        }),
      );
    });

    it('should not notify when no admins found', async () => {
      const prisma = makeMockPrisma([]);
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentLegalHoldSetEvent(ORG, DOC_ID, ACTOR_A, 'hold reason');
      await listener.onLegalHoldSet(event);

      expect(notifications.send).not.toHaveBeenCalled();
    });

    it('should not throw when individual notification sends fail', async () => {
      const prisma = makeMockPrisma([{ id: ACTOR_B }]);
      const notifications = { send: jest.fn().mockRejectedValue(new Error('failed')) };
      const listener = makeListener(prisma, notifications);

      const event = new DocumentLegalHoldSetEvent(ORG, DOC_ID, ACTOR_A, 'hold reason');
      await expect(listener.onLegalHoldSet(event)).resolves.not.toThrow();
    });

    it('should not throw when prisma query fails', async () => {
      const prisma = {
        user: { findMany: jest.fn().mockRejectedValue(new Error('DB error')) },
        document: { findFirst: jest.fn() },
      };
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      const event = new DocumentLegalHoldSetEvent(ORG, DOC_ID, ACTOR_A, 'hold reason');
      await expect(listener.onLegalHoldSet(event)).resolves.not.toThrow();
    });
  });

  // ── href / deep links ─────────────────────────────────────────────────────

  describe('notification href routing', () => {
    it('should include /documents href in all notification types', async () => {
      const prisma = makeMockPrisma([{ id: ACTOR_B }]);
      (prisma.document.findFirst as jest.Mock).mockResolvedValue({ ownerId: ACTOR_A });
      const notifications = makeMockNotifications();
      const listener = makeListener(prisma, notifications);

      // Test approval_requested
      await listener.onApprovalRequested(
        new DocumentApprovalRequestedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_A, null),
      );
      expect(notifications.send).toHaveBeenLastCalledWith(
        ORG, ACTOR_B, expect.objectContaining({ href: '/documents' }),
      );

      notifications.send.mockClear();

      // Test approved
      await listener.onApproved(
        new DocumentApprovedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'internal', []),
      );
      expect(notifications.send).toHaveBeenLastCalledWith(
        ORG, ACTOR_A, expect.objectContaining({ href: '/documents' }),
      );

      notifications.send.mockClear();

      // Test rejected
      await listener.onRejected(
        new DocumentRejectedEvent(ORG, DOC_ID, DOC_TITLE, ACTOR_B, 'Missing section', ACTOR_A),
      );
      expect(notifications.send).toHaveBeenLastCalledWith(
        ORG, ACTOR_A, expect.objectContaining({ href: '/documents' }),
      );
    });
  });
});
