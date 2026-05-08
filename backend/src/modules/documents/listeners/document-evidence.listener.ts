import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../database/prisma.service';
import { DocumentApprovedEvent } from '../events/document.events';

/**
 * Automatically creates an Evidence record + ControlEvidence mappings
 * when a document is approved — satisfying ISO A.5.1 (policy approved ≡ evidence of control).
 */
@Injectable()
export class DocumentEvidenceListener {
  private readonly logger = new Logger(DocumentEvidenceListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('document.approved')
  async onApproved(e: DocumentApprovedEvent) {
    if (!e.controlIds || e.controlIds.length === 0) return;

    try {
      // Create one Evidence record for the approved document
      const evidence = await this.prisma.evidence.create({
        data: {
          orgId:       e.orgId,
          title:   `Approved Document: ${e.title}`,
          type:    'document',
          source:      'manual_upload',
          // Map to the first control (multi-control via ControlEvidence join below)
          controlId:   e.controlIds[0],
          reviewedBy:  e.approvedBy,
          metadata:    { documentId: e.documentId, autoCreated: true },
        },
      });

      // Create ControlEvidence join records for all mapped controls
      await this.prisma.controlEvidence.createMany({
        data: e.controlIds.map((controlId) => ({
          evidenceId: evidence.id,
          controlId,
          orgId:      e.orgId,
          confidence: 90,
          mappedBy:   e.approvedBy,
        })),
        skipDuplicates: true,
      });

      this.logger.log(`Auto-created evidence for approved document ${e.documentId} → ${e.controlIds.length} controls`);
    } catch (err) {
      // Non-fatal — log and continue
      this.logger.warn(`Failed to auto-create evidence for document ${e.documentId}: ${(err as Error).message}`);
    }
  }
}
