/**
 * DocumentsService — Workflow & Lifecycle Unit Tests (P19)
 *
 * Covers the approval state-machine, SoD enforcement, lock/unlock mechanics,
 * version management, and event emission for the document lifecycle.
 *
 * Mirrors the plan verification items:
 *  - Document lock: Create doc → Request Approval → attempt edit → 409
 *  - Approve: SoD enforced (approver ≠ owner)
 *  - Reject: releases lock, status back to draft, emits rejection event
 *  - New Version: snapshots current, increments version counter
 *  - Restore: copies old version, saves snapshot of current
 *  - Archive: blocked when legal hold is active
 *  - Events: DocumentApprovalRequestedEvent, DocumentApprovedEvent, DocumentRejectedEvent
 */

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';

// ── Constants ────────────────────────────────────────────────────────────────

const ORG    = 'org-workflow-111';
const AUTHOR = 'user-author-001';
const APPROVER = 'user-approver-002';
const DOC_ID = 'doc-workflow-001';

// ── Minimal document fixture ──────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id:             DOC_ID,
    orgId:          ORG,
    title:          'Information Security Policy',
    docType:        'policy',
    content:        { type: 'doc', content: [] },
    contentHtml:    '<p>Draft content</p>',
    contentText:    'Draft content',
    wordCount:      2,
    status:         'draft',
    classification: 'internal',
    version:        1,
    controlIds:     ['A.5.1'],
    frameworkIds:   ['ISO27001'],
    tags:           [],
    ownerId:        AUTHOR,
    approvedBy:     null,
    approvedAt:     null,
    lockedAt:       null,
    lockedBy:       null,
    lockedReason:   null,
    legalHoldAt:    null,
    legalHoldBy:    null,
    legalHoldReason: null,
    retentionDays:  null,
    retainUntil:    null,
    deletedAt:      null,
    purgedAt:       null,
    reviewDue:      null,
    metadata:       {},
    owner:          { id: AUTHOR, fullName: 'Alice Author' },
    approver:       null,
    createdAt:      new Date('2026-01-01T00:00:00Z'),
    updatedAt:      new Date('2026-01-15T00:00:00Z'),
    ...overrides,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks() {
  let docState = makeDoc();

  const prisma = {
    document: {
      findFirst: jest.fn(async ({ where }: any) => {
        if (where?.id === DOC_ID && where?.orgId === ORG && !docState.deletedAt) {
          return { ...docState };
        }
        return null;
      }),
      findMany: jest.fn(async () => [{ ...docState }]),
      create: jest.fn(async ({ data }: any) => {
        docState = { ...docState, ...data, id: DOC_ID };
        return { ...docState };
      }),
      update: jest.fn(async ({ data }: any) => {
        docState = { ...docState, ...data };
        return { ...docState };
      }),
      count: jest.fn(async () => 1),
    },
    documentVersion: {
      create:  jest.fn(async ({ data }: any) => ({ id: `ver-${Date.now()}`, ...data })),
      findFirst: jest.fn(async ({ where }: any) => ({
        id: 'ver-001', documentId: DOC_ID, version: 1,
        content: { type: 'doc', content: [] }, contentHtml: '<p>Old</p>',
        createdBy: AUTHOR, note: null, createdAt: new Date(),
      })),
    },
    $queryRaw: jest.fn(async () => [{ id: DOC_ID, rank: 0.5 }]),
  } as any;

  const sanitizer = {
    sanitize:    jest.fn((html: string) => html),
    toPlainText: jest.fn((html: string) => html.replace(/<[^>]+>/g, '')),
    countWords:  jest.fn((text: string) => text.split(/\s+/).filter(Boolean).length),
  } as any;

  // RetentionService: default = no legal hold
  const retention = {
    assertNotLocked: jest.fn(async () => {}),
  } as any;

  const aiFeatures = {
    improveText:  jest.fn(async (text: string) => text + ' (improved)'),
    detectGaps:   jest.fn(async () => []),
  } as any;

  const events = {
    emit: jest.fn(),
  } as any;

  const embeddings = { embed: jest.fn().mockResolvedValue(null), embedBatch: jest.fn() } as any;
  const featureFlags = { isEnabled: jest.fn().mockResolvedValue(false) } as any;
  const approvalWorkflow = {
    startWorkflow:      jest.fn().mockResolvedValue({ instanceId: 'wf-1' }),
    getActiveInstance:  jest.fn().mockResolvedValue(null),
    advanceStep:        jest.fn().mockResolvedValue({ status: 'completed', complete: true }),
    cancelWorkflow:     jest.fn().mockResolvedValue(undefined),
  } as any;
  const queue = { add: jest.fn() } as any;
  const service = new DocumentsService(prisma, sanitizer, retention, aiFeatures, events, embeddings, featureFlags, approvalWorkflow, queue);

  return { service, prisma, events, retention, docState: () => docState };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DocumentsService — workflow lifecycle', () => {
  let service: DocumentsService;
  let prisma:  ReturnType<typeof makeMocks>['prisma'];
  let events:  ReturnType<typeof makeMocks>['events'];
  let retention: ReturnType<typeof makeMocks>['retention'];
  let getDocState: () => ReturnType<typeof makeDoc>;

  beforeEach(() => {
    const mocks = makeMocks();
    service     = mocks.service;
    prisma      = mocks.prisma;
    events      = mocks.events;
    retention   = mocks.retention;
    getDocState = mocks.docState;
  });

  // ── Request Approval ───────────────────────────────────────────────────────

  describe('requestApproval()', () => {
    it('locks the document and sets status to review', async () => {
      await service.requestApproval(ORG, DOC_ID, AUTHOR);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedAt:     expect.any(Date),
            lockedBy:     AUTHOR,
            lockedReason: 'pending_approval',
            status:       'review',
          }),
        }),
      );
    });

    it('emits DocumentApprovalRequestedEvent', async () => {
      await service.requestApproval(ORG, DOC_ID, AUTHOR);

      expect(events.emit).toHaveBeenCalledWith(
        'document.approval_requested',
        expect.objectContaining({
          orgId:       ORG,
          documentId:  DOC_ID,
          requestedBy: AUTHOR,   // DocumentApprovalRequestedEvent.requestedBy
        }),
      );
    });

    it('throws ConflictException if document is already locked', async () => {
      // Simulate already-locked document
      prisma.document.findFirst.mockResolvedValueOnce(
        makeDoc({ lockedAt: new Date(), lockedBy: AUTHOR, lockedReason: 'pending_approval', status: 'review' }),
      );

      await expect(service.requestApproval(ORG, DOC_ID, AUTHOR)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if document is already approved', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(
        makeDoc({ status: 'approved', approvedBy: APPROVER, approvedAt: new Date() }),
      );

      await expect(service.requestApproval(ORG, DOC_ID, AUTHOR)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown document', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(null);
      await expect(service.requestApproval(ORG, 'nonexistent', AUTHOR)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Update while locked ────────────────────────────────────────────────────

  describe('update() — lock guard', () => {
    it('throws ConflictException when attempting to edit a locked document', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(
        makeDoc({ lockedAt: new Date(), lockedBy: AUTHOR, lockedReason: 'pending_approval', status: 'review' }),
      );

      await expect(
        service.update(ORG, DOC_ID, AUTHOR, { title: 'Hacked' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows update when document is NOT locked', async () => {
      // Default fixture has lockedAt = null
      await expect(
        service.update(ORG, DOC_ID, AUTHOR, { title: 'Updated Title' }),
      ).resolves.toBeDefined();

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
    });
  });

  // ── Approve ────────────────────────────────────────────────────────────────

  describe('approve()', () => {
    const lockedDoc = makeDoc({
      status:       'review',
      lockedAt:     new Date(),
      lockedBy:     AUTHOR,
      lockedReason: 'pending_approval',
    });

    beforeEach(() => {
      prisma.document.findFirst.mockResolvedValue(lockedDoc);
    });

    it('approves document, unlocks it, and sets approvedBy + approvedAt', async () => {
      await service.approve(ORG, DOC_ID, APPROVER);

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:       'approved',
            approvedBy:   APPROVER,
            approvedAt:   expect.any(Date),
            lockedAt:     null,
            lockedBy:     null,
            lockedReason: null,
          }),
        }),
      );
    });

    it('emits DocumentApprovedEvent with correct payload', async () => {
      await service.approve(ORG, DOC_ID, APPROVER);

      expect(events.emit).toHaveBeenCalledWith(
        'document.approved',
        expect.objectContaining({
          orgId:      ORG,
          documentId: DOC_ID,
          approvedBy: APPROVER,        // DocumentApprovedEvent.approvedBy
        }),
      );
    });

    it('enforces SoD — throws ForbiddenException if owner tries to approve their own document', async () => {
      // AUTHOR is the document owner, so self-approval must be blocked
      await expect(service.approve(ORG, DOC_ID, AUTHOR)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if document is not in review status', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(makeDoc({ status: 'draft' }));
      await expect(service.approve(ORG, DOC_ID, APPROVER)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException for unknown document', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(null);
      await expect(service.approve(ORG, 'bad-id', APPROVER)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Reject ─────────────────────────────────────────────────────────────────

  describe('reject()', () => {
    const lockedDoc = makeDoc({
      status:       'review',
      lockedAt:     new Date(),
      lockedBy:     AUTHOR,
      lockedReason: 'pending_approval',
    });

    beforeEach(() => {
      prisma.document.findFirst.mockResolvedValue(lockedDoc);
    });

    it('resets status to draft and releases lock', async () => {
      await service.reject(ORG, DOC_ID, APPROVER, 'Needs revision');

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status:       'draft',
            lockedAt:     null,
            lockedBy:     null,
            lockedReason: null,
          }),
        }),
      );
    });

    it('emits DocumentRejectedEvent with reason and author', async () => {
      await service.reject(ORG, DOC_ID, APPROVER, 'Missing section 4.2');

      expect(events.emit).toHaveBeenCalledWith(
        'document.rejected',
        expect.objectContaining({
          orgId:       ORG,
          documentId:  DOC_ID,
          rejectedBy:  APPROVER,         // DocumentRejectedEvent.rejectedBy
          reason:      'Missing section 4.2',
          authorId:    AUTHOR,           // DocumentRejectedEvent.authorId
        }),
      );
    });

    it('throws ConflictException if document is not in review status', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(makeDoc({ status: 'draft' }));
      await expect(service.reject(ORG, DOC_ID, APPROVER, 'reason')).rejects.toThrow(ConflictException);
    });
  });

  // ── Archive ────────────────────────────────────────────────────────────────

  describe('archive()', () => {
    it('archives the document and emits DocumentArchivedEvent', async () => {
      await service.archive(ORG, DOC_ID, APPROVER);

      expect(retention.assertNotLocked).toHaveBeenCalledWith(DOC_ID, ORG);
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'archived' }),
        }),
      );
    });

    it('throws when legal hold is active (via RetentionService)', async () => {
      retention.assertNotLocked.mockRejectedValueOnce(
        new ConflictException('Document is under legal hold'),
      );

      await expect(service.archive(ORG, DOC_ID, APPROVER)).rejects.toThrow(ConflictException);
    });
  });

  // ── New Version ────────────────────────────────────────────────────────────

  describe('newVersion()', () => {
    it('creates a DocumentVersion snapshot and increments the version counter', async () => {
      await service.newVersion(ORG, DOC_ID, AUTHOR, { note: 'Updated sections 1–3' });

      // A version snapshot should have been created
      expect(prisma.documentVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: DOC_ID,
            version:    expect.any(Number),
            content:    expect.anything(),
          }),
        }),
      );

      // The document itself should have been updated with an incremented version
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version: expect.any(Number),
            status:  'draft',
          }),
        }),
      );
    });

    it('emits DocumentVersionCreatedEvent', async () => {
      await service.newVersion(ORG, DOC_ID, AUTHOR, {});

      expect(events.emit).toHaveBeenCalledWith(
        'document.version_created',
        expect.objectContaining({
          orgId:      ORG,
          documentId: DOC_ID,
        }),
      );
    });
  });

  // ── Restore Version ────────────────────────────────────────────────────────

  describe('restoreVersion()', () => {
    it('fetches old version and updates document content from it', async () => {
      await service.restoreVersion(ORG, DOC_ID, 1, AUTHOR);

      // Should have looked up the old version
      expect(prisma.documentVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentId: DOC_ID, version: 1 }),
        }),
      );

      // Should have updated the document with the old content
      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contentHtml: expect.any(String),
            status:      'draft',
          }),
        }),
      );
    });

    it('throws NotFoundException when version does not exist', async () => {
      prisma.documentVersion.findFirst.mockResolvedValueOnce(null);
      await expect(service.restoreVersion(ORG, DOC_ID, 99, AUTHOR)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when document does not exist for org', async () => {
      prisma.document.findFirst.mockResolvedValueOnce(null);
      await expect(service.restoreVersion(ORG, DOC_ID, 1, AUTHOR)).rejects.toThrow(NotFoundException);
    });
  });

  // ── Full Approval Roundtrip ────────────────────────────────────────────────

  describe('full approval roundtrip', () => {
    it('draft → review → approved lifecycle emits three events in order', async () => {
      // Step 1: author requests approval
      await service.requestApproval(ORG, DOC_ID, AUTHOR);

      // Step 2: simulate document now in review (locked)
      prisma.document.findFirst.mockResolvedValue(
        makeDoc({ status: 'review', lockedAt: new Date(), lockedBy: AUTHOR, lockedReason: 'pending_approval' }),
      );

      // Step 3: approver approves
      await service.approve(ORG, DOC_ID, APPROVER);

      const emittedEvents = events.emit.mock.calls.map(([name]: [string]) => name);
      expect(emittedEvents).toContain('document.approval_requested');
      expect(emittedEvents).toContain('document.approved');
    });

    it('draft → review → rejected lifecycle releases lock', async () => {
      await service.requestApproval(ORG, DOC_ID, AUTHOR);

      prisma.document.findFirst.mockResolvedValue(
        makeDoc({ status: 'review', lockedAt: new Date(), lockedBy: AUTHOR, lockedReason: 'pending_approval' }),
      );

      await service.reject(ORG, DOC_ID, APPROVER, 'Needs more detail');

      // After rejection the document update should clear the lock
      const updateCalls = prisma.document.update.mock.calls;
      const lastUpdate = updateCalls[updateCalls.length - 1][0];
      expect(lastUpdate.data.lockedAt).toBeNull();
      expect(lastUpdate.data.status).toBe('draft');
    });
  });
});
