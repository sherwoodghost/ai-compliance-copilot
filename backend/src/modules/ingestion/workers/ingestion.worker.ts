import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { IngestionClassifierService } from '../ingestion-classifier.service';
import { IngestionService, INGESTION_QUEUE } from '../ingestion.service';

interface ProcessBatchPayload {
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
    private readonly ingestionService: IngestionService,
  ) {}

  @Process('process-batch')
  async processBatch(job: Job<ProcessBatchPayload>) {
    const { batchId, orgId, jobStatusId } = job.data;

    try {
      // Update job status to processing
      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: { status: 'processing' },
      });

      const files = await this.prisma.ingestionFile.findMany({
        where: { batchId, orgId, status: 'queued' },
      });

      let processed = 0;

      for (const file of files) {
        try {
          // Tenant isolation check
          this.storage.assertOrgOwnership(orgId, file.storageKey);

          // Tier 1: deterministic classification
          const result = this.classifier.classify(
            file.originalName,
            file.folderPath ?? undefined,
            file.sizeBytes,
            file.mimeType,
          );

          if (result && result.confidence >= 85) {
            // Auto-place
            await this.prisma.ingestionFile.update({
              where: { id: file.id },
              data: {
                status: 'mapped',
                detectedType: result.detectedType,
                detectedFrameworks: result.detectedFrameworks,
                suggestedControlIds: result.suggestedControlIds,
                confidence: result.confidence,
                tier: 1,
              },
            });
          } else {
            // Needs human review (Tier 2/3 would run here in production)
            await this.prisma.ingestionFile.update({
              where: { id: file.id },
              data: {
                status: 'needs_review',
                confidence: result?.confidence ?? null,
                detectedType: result?.detectedType ?? null,
                detectedFrameworks: result?.detectedFrameworks ?? [],
                tier: 1,
              },
            });
          }
        } catch (err) {
          this.logger.error(`Failed to process file ${file.id}: ${err}`);
          await this.prisma.ingestionFile.update({
            where: { id: file.id },
            data: { status: 'error', errorMessage: String(err) },
          });
        }

        processed++;

        // Update job progress
        const progressPct = Math.round((processed / files.length) * 100);
        await this.prisma.jobStatus.update({
          where: { id: jobStatusId },
          data: { progress: progressPct },
        });
      }

      // Final recalc
      await this.ingestionService.recalcBatchCounters(batchId);

      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: { status: 'completed', progress: 100 },
      });

    } catch (err) {
      this.logger.error(`Batch ${batchId} failed: ${err}`);
      await this.prisma.jobStatus.update({
        where: { id: jobStatusId },
        data: { status: 'failed', errorMessage: String(err) },
      });
    }
  }
}
