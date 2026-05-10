import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { IngestionClassifierService } from '../ingestion-classifier.service';
import { INGESTION_QUEUE } from '../ingestion.service';

interface ProcessBatchJob {
  batchId: string;
  orgId: string;
  jobStatusId: string;
}

@Processor(INGESTION_QUEUE)
export class IngestionWorker {
  private readonly logger = new Logger(IngestionWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly classifier: IngestionClassifierService,
  ) {}

  @Process('process-batch')
  async processBatch(job: Job<ProcessBatchJob>) {
    const { batchId, orgId, jobStatusId } = job.data;
    this.logger.log(`Processing ingestion batch ${batchId} for org ${orgId}`);

    try {
      await this.prisma.ingestionBatch.update({
        where: { id: batchId },
        data: { status: 'processing' },
      });
      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: { status: 'processing', progress: 5 },
      });

      const files = await this.prisma.ingestionFile.findMany({
        where: { batchId, orgId, status: 'queued' },
      });

      let processed = 0;

      for (const file of files) {
        try {
          // Verify tenant isolation
          this.storage.assertOrgOwnership(orgId, file.storageKey);

          await this.prisma.ingestionFile.update({
            where: { id: file.id },
            data: { status: 'classifying', tier: 1 },
          });

          // Tier 1 classification
          const result = this.classifier.classifyTier1({
            filename: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            folderPath: file.folderPath ?? undefined,
          });

          if (result && result.confidence >= 85) {
            // Auto-place: create Document record
            const doc = await this.prisma.document.create({
              data: {
                orgId,
                title: file.originalName.replace(/\.[^.]+$/, ''),
                docType: result.detectedType as any,
                controlIds: result.suggestedControlIds,
                detectedFrameworks: result.detectedFrameworks,
                activeForOrg: true,
                ingestionFileId: file.id,
                content: {},
                contentHtml: '',
              },
            });

            await this.prisma.ingestionFile.update({
              where: { id: file.id },
              data: {
                status: 'mapped',
                tier: 1,
                detectedType: result.detectedType,
                detectedFrameworks: result.detectedFrameworks,
                suggestedControlIds: result.suggestedControlIds,
                confidence: result.confidence,
                classificationReason: result.classificationReason,
                documentId: doc.id,
              },
            });
          } else {
            // Needs human review or Tier 2 (for now, queue for review)
            await this.prisma.ingestionFile.update({
              where: { id: file.id },
              data: {
                status: 'needs_review',
                tier: 1,
                detectedType: result?.detectedType,
                detectedFrameworks: result?.detectedFrameworks ?? [],
                suggestedControlIds: result?.suggestedControlIds ?? [],
                confidence: result?.confidence ?? 0,
                classificationReason: result?.classificationReason ?? 'Confidence below threshold — human review required',
              },
            });
          }
        } catch (fileErr: any) {
          this.logger.warn(`Error classifying file ${file.id}: ${fileErr.message}`);
          await this.prisma.ingestionFile.update({
            where: { id: file.id },
            data: { status: 'error', errorMessage: fileErr.message },
          }).catch(() => {});
        }

        processed++;
        const progress = Math.round((processed / files.length) * 85) + 5;
        await this.prisma.jobStatus.update({
          where: { id: jobStatusId },
          data: { progress },
        }).catch(() => {});
      }

      // Recalculate batch counters
      const counts = await this.prisma.ingestionFile.groupBy({
        by: ['status'],
        where: { batchId },
        _count: { id: true },
      });

      const mapped     = counts.find((c) => c.status === 'mapped')?._count.id ?? 0;
      const review     = counts.find((c) => c.status === 'needs_review')?._count.id ?? 0;
      const failed     = counts.find((c) => c.status === 'error')?._count.id ?? 0;
      const skipped    = counts.find((c) => c.status === 'skipped')?._count.id ?? 0;
      const doneStatus = review > 0 ? 'review_pending' : 'completed';

      await this.prisma.ingestionBatch.update({
        where: { id: batchId },
        data: {
          processedFiles: mapped + review + failed + skipped,
          autoPlaced: mapped,
          needsReview: review,
          failed,
          status: doneStatus,
        },
      });

      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: {
          status: 'completed',
          progress: 100,
          resultPayload: { batchId, mapped, review, failed },
        },
      });

      this.logger.log(`Batch ${batchId} complete: ${mapped} auto-placed, ${review} needs review, ${failed} failed`);
    } catch (err: any) {
      this.logger.error(`Batch ${batchId} failed: ${err.message}`, err.stack);
      await this.prisma.ingestionBatch.update({
        where: { id: batchId },
        data: { status: 'failed' },
      }).catch(() => {});
      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: { status: 'failed', errorMessage: err.message },
      }).catch(() => {});
      throw err;
    }
  }
}
