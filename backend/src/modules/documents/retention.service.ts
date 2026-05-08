import { Injectable, Logger, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { DocumentLegalHoldReleasedEvent, DocumentLegalHoldSetEvent } from './events/document.events';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** Set a legal hold — blocks all deletion / archival paths */
  async setLegalHold(
    orgId:      string,
    documentId: string,
    actorId:    string,
    reason:     string,
  ): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, orgId, deletedAt: null },
    });
    if (!doc) throw new ConflictException('Document not found');
    if (doc.legalHoldAt) throw new ConflictException('Legal hold already active');

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        legalHoldAt:     new Date(),
        legalHoldBy:     actorId,
        legalHoldReason: reason,
      },
    });

    this.events.emit('document.legal_hold.set', new DocumentLegalHoldSetEvent(orgId, documentId, actorId, reason));
  }

  /** Release a legal hold — requires COMPLIANCE_LEAD or LEGAL role (caller must enforce) */
  async releaseLegalHold(
    orgId:      string,
    documentId: string,
    actorId:    string,
  ): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, orgId, deletedAt: null },
    });
    if (!doc)             throw new ConflictException('Document not found');
    if (!doc.legalHoldAt) throw new ConflictException('No active legal hold');

    await this.prisma.document.update({
      where: { id: documentId },
      data: { legalHoldAt: null, legalHoldBy: null, legalHoldReason: null },
    });

    this.events.emit('document.legal_hold.released', new DocumentLegalHoldReleasedEvent(orgId, documentId, actorId));
  }

  /** Guard: throw 423 Locked if document has an active legal hold */
  async assertNotLocked(documentId: string, orgId: string): Promise<void> {
    const doc = await this.prisma.document.findFirst({
      where:  { id: documentId, orgId },
      select: { legalHoldAt: true, legalHoldReason: true },
    });
    if (doc?.legalHoldAt) {
      throw new ForbiddenException(
        `Document is under legal hold: ${doc.legalHoldReason ?? 'reason not specified'}`,
      );
    }
  }

  /**
   * Soft-delete documents that have passed their retainUntil date and have no legal hold.
   * Called by a daily BullMQ cron job.
   */
  async archiveExpired(): Promise<number> {
    const result = await this.prisma.document.updateMany({
      where: {
        deletedAt:   null,
        legalHoldAt: null,
        status:      { not: 'approved' }, // don't auto-expire approved docs
        retainUntil: { lte: new Date() },
      },
      data: {
        deletedAt: new Date(),
        status:    'archived',
      },
    });
    if (result.count > 0) {
      this.logger.log(`Soft-deleted ${result.count} expired documents`);
    }
    return result.count;
  }

  /**
   * Permanently purge documents that were soft-deleted >30 days ago with no legal hold.
   * Called by a monthly BullMQ cron job.
   */
  async purgeExpired(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const docs = await this.prisma.document.findMany({
      where: {
        deletedAt:   { lte: cutoff },
        legalHoldAt: null,
        purgedAt:    null,
      },
      select: { id: true },
    });

    for (const doc of docs) {
      // Delete versions first, then the document
      await this.prisma.documentVersion.deleteMany({ where: { documentId: doc.id } });
      await this.prisma.document.update({
        where: { id: doc.id },
        data:  { purgedAt: new Date() },
      });
    }

    if (docs.length > 0) {
      this.logger.log(`Purged ${docs.length} documents past retention`);
    }
    return docs.length;
  }
}
