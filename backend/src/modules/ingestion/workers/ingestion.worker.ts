import { Processor, Process, InjectQueue } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { IngestionClassifierService, ClassificationResult } from '../ingestion-classifier.service';
import { IngestionNotificationService } from '../ingestion-notification.service';
import { PiiRedactorService } from '../pii-redactor.service';
import { TipTapConverterService } from '../tiptap-converter.service';
import { INGESTION_QUEUE } from '../ingestion.service';
import { INGESTION_CONVERT_QUEUE } from './conversion.worker';
import { ComplianceGateway } from '../../../gateways/compliance.gateway';

interface ProcessBatchJob {
  batchId: string;
  orgId: string;
  jobStatusId: string;
}

interface ClassificationContext {
  companyName: string;
  industry: string;
  employeeCount: string;
  targetFrameworks: string[];
  cloudProviders: string[];
  dataTypes: string[];
  applicableControlCodes: string[];
  existingDocTitles: string[];
}

interface Tier2QueueItem {
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  folderPath?: string;
  redactedText: string;
  t1Hints: ClassificationResult | null;
}

@Processor(INGESTION_QUEUE)
export class IngestionWorker {
  private readonly logger = new Logger(IngestionWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly classifier: IngestionClassifierService,
    private readonly notification: IngestionNotificationService,
    private readonly piiRedactor: PiiRedactorService,
    private readonly converter: TipTapConverterService,
    @InjectQueue(INGESTION_CONVERT_QUEUE) private readonly convertQueue: Queue,
    private readonly gateway: ComplianceGateway,
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
      await this.updateJobProgress(jobStatusId, 'processing', 5);

      // Load classification context from BusinessProfile
      const context = await this.buildClassificationContext(orgId);

      const files = await this.prisma.ingestionFile.findMany({
        where: { batchId, orgId, status: 'queued' },
      });

      let processed = 0;
      const tier2Queue: Tier2QueueItem[] = [];
      const tier3Queue: Array<{ fileId: string; originalName: string; storageKey: string; mimeType: string }> = [];

      // ── Pass 1: Tier 1 (deterministic) + collect Tier 2 candidates ────────
      for (const file of files) {
        try {
          this.storage.assertOrgOwnership(orgId, file.storageKey);

          await this.prisma.ingestionFile.update({
            where: { id: file.id },
            data: { status: 'classifying', tier: 1 },
          });

          // Tier 1 classification
          const t1 = this.classifier.classifyTier1({
            filename: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            folderPath: file.folderPath ?? undefined,
          });

          if (t1 && t1.confidence >= 85) {
            // Auto-place via Tier 1
            await this.autoPlace(file.id, orgId, file.originalName, file.storageKey, file.mimeType, t1, batchId);
          } else {
            // Extract text for Tier 2
            try {
              const buffer = await this.storage.download(file.storageKey);
              const rawText = await this.converter.extractText(buffer, file.mimeType, 2000);
              const redacted = this.piiRedactor.redact(rawText);

              // Update PII detection status
              if (redacted.piiDetected) {
                await this.prisma.ingestionFile.update({
                  where: { id: file.id },
                  data: { piiDetected: true, piiFields: redacted.piiFields },
                });
              }

              tier2Queue.push({
                fileId: file.id,
                originalName: file.originalName,
                mimeType: file.mimeType,
                sizeBytes: file.sizeBytes,
                folderPath: file.folderPath ?? undefined,
                redactedText: redacted.text,
                t1Hints: t1,
              });
            } catch (extractErr: any) {
              this.logger.warn(`Text extraction failed for ${file.id}: ${extractErr.message}`);
              // If we can't extract text, go straight to needs_review
              await this.markNeedsReview(file.id, null, orgId, batchId);
            }
          }
        } catch (fileErr: any) {
          this.logger.warn(`Error classifying file ${file.id}: ${fileErr.message}`);
          await this.markError(file.id, fileErr.message);
        }

        processed++;
        const progress = Math.round((processed / files.length) * 40) + 5;
        await this.updateJobProgress(jobStatusId, 'processing', progress);
        this.gateway.emitIngestionBatchProgress(orgId, batchId, progress, processed, files.length);
      }

      // ── Pass 2: Tier 2 (Haiku batch) ─────────────────────────────────────
      if (tier2Queue.length > 0) {
        this.logger.log(`Tier 2: classifying ${tier2Queue.length} files with Haiku`);

        // Process in batches of 10
        for (let i = 0; i < tier2Queue.length; i += 10) {
          const batch = tier2Queue.slice(i, i + 10);

          try {
            const results = await this.classifier.classifyTier2Batch(batch, context);

            for (const { fileId, result } of results) {
              if (result && result.confidence >= 70) {
                const queueItem = batch.find((b) => b.fileId === fileId);
                const file = await this.prisma.ingestionFile.findUnique({ where: { id: fileId } });
                if (file) {
                  await this.autoPlace(
                    fileId, orgId, file.originalName, file.storageKey, file.mimeType,
                    result, batchId,
                  );
                }
              } else {
                // Escalate to Tier 3
                const file = await this.prisma.ingestionFile.findUnique({ where: { id: fileId } });
                if (file) {
                  tier3Queue.push({
                    fileId, originalName: file.originalName,
                    storageKey: file.storageKey, mimeType: file.mimeType,
                  });
                }

                // Update with partial classification info from Tier 2
                if (result) {
                  await this.prisma.ingestionFile.update({
                    where: { id: fileId },
                    data: {
                      tier: 2,
                      detectedType: result.detectedType,
                      detectedFrameworks: result.detectedFrameworks,
                      suggestedControlIds: result.suggestedControlIds,
                      confidence: result.confidence,
                      classificationReason: result.classificationReason,
                    },
                  });
                }
              }
            }
          } catch (batchErr: any) {
            this.logger.warn(`Tier 2 batch failed: ${batchErr.message}`);
            // Fall all files in this batch to needs_review
            for (const item of batch) {
              await this.markNeedsReview(item.fileId, null, orgId, batchId);
            }
          }

          const t2Progress = 45 + Math.round(((i + batch.length) / tier2Queue.length) * 25);
          await this.updateJobProgress(jobStatusId, 'processing', t2Progress);
          this.gateway.emitIngestionBatchProgress(orgId, batchId, t2Progress, processed, files.length);
        }
      }

      // ── Pass 3: Tier 3 (Sonnet, one at a time) ───────────────────────────
      if (tier3Queue.length > 0) {
        this.logger.log(`Tier 3: classifying ${tier3Queue.length} files with Sonnet`);

        for (let i = 0; i < tier3Queue.length; i++) {
          const item = tier3Queue[i];

          try {
            const buffer = await this.storage.download(item.storageKey);
            const fullText = await this.converter.extractText(buffer, item.mimeType, 8000);
            const redacted = this.piiRedactor.redact(fullText);

            const t3 = await this.classifier.classifyTier3(
              {
                filename: item.originalName,
                mimeType: item.mimeType,
                sizeBytes: buffer.length,
              },
              redacted.text,
              context,
            );

            if (t3 && t3.confidence >= 60) {
              await this.markNeedsReview(item.fileId, t3, orgId, batchId);
            } else {
              await this.markNeedsReview(item.fileId, t3, orgId, batchId);
            }
          } catch (t3Err: any) {
            this.logger.warn(`Tier 3 classification failed for ${item.fileId}: ${t3Err.message}`);
            await this.markNeedsReview(item.fileId, null, orgId, batchId);
          }

          const t3Progress = 70 + Math.round(((i + 1) / tier3Queue.length) * 20);
          await this.updateJobProgress(jobStatusId, 'processing', t3Progress);
          this.gateway.emitIngestionBatchProgress(orgId, batchId, t3Progress, processed, files.length);
        }
      }

      // ── Finalize batch ───────────────────────────────────────────────────
      await this.recalcBatchCounters(batchId);

      // Emit real-time batch completed event
      const finalBatch = await this.prisma.ingestionBatch.findUnique({ where: { id: batchId } });
      if (finalBatch) {
        this.gateway.emitIngestionBatchCompleted(orgId, batchId, finalBatch.autoPlaced, finalBatch.needsReview, finalBatch.failed);
      }

      // Send batch completion email
      await this.notification.notifyBatchCompleted(batchId, orgId);

      await this.updateJobProgress(jobStatusId, 'completed', 100, { batchId });

      this.logger.log(`Batch ${batchId} processing complete`);
    } catch (err: any) {
      this.logger.error(`Batch ${batchId} failed: ${err.message}`, err.stack);
      await this.prisma.ingestionBatch.update({
        where: { id: batchId },
        data: { status: 'failed' },
      }).catch(() => {});
      await this.updateJobProgress(jobStatusId, 'failed', 0, undefined, err.message);
      throw err;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async autoPlace(
    fileId: string, orgId: string, originalName: string,
    storageKey: string, mimeType: string,
    result: ClassificationResult, batchId: string,
  ) {
    const doc = await this.prisma.document.create({
      data: {
        orgId,
        title: originalName.replace(/\.[^.]+$/, ''),
        docType: result.detectedType,
        controlIds: result.suggestedControlIds,
        detectedFrameworks: result.detectedFrameworks,
        activeForOrg: true,
        sourceStorageKey: storageKey,
        content: {},
        contentHtml: '',
      },
    });

    await this.prisma.ingestionFile.update({
      where: { id: fileId },
      data: {
        status: 'mapped',
        tier: result.tier,
        detectedType: result.detectedType,
        detectedFrameworks: result.detectedFrameworks,
        suggestedControlIds: result.suggestedControlIds,
        confidence: result.confidence,
        classificationReason: result.classificationReason,
        documentId: doc.id,
      },
    });

    // Emit real-time file classified event
    this.gateway.emitIngestionFileClassified(orgId, fileId, batchId, 'mapped', result.detectedType, result.confidence, result.tier);

    // Enqueue TipTap conversion
    await this.convertQueue.add(
      'convert-file',
      { fileId, orgId, batchId, storageKey, mimeType, documentId: doc.id },
      { attempts: 2, backoff: { type: 'exponential', delay: 3000 } },
    );
  }

  private async markNeedsReview(fileId: string, result: ClassificationResult | null, orgId?: string, batchId?: string) {
    await this.prisma.ingestionFile.update({
      where: { id: fileId },
      data: {
        status: 'needs_review',
        tier: result?.tier ?? 1,
        detectedType: result?.detectedType,
        detectedFrameworks: result?.detectedFrameworks ?? [],
        suggestedControlIds: result?.suggestedControlIds ?? [],
        confidence: result?.confidence ?? 0,
        classificationReason: result?.classificationReason ?? 'Confidence below threshold — human review required',
      },
    });

    // Emit real-time file classified event
    if (orgId && batchId) {
      this.gateway.emitIngestionFileClassified(orgId, fileId, batchId, 'needs_review', result?.detectedType ?? null, result?.confidence ?? 0, result?.tier ?? 0);
    }
  }

  private async markError(fileId: string, message: string) {
    await this.prisma.ingestionFile.update({
      where: { id: fileId },
      data: { status: 'error', errorMessage: message },
    }).catch(() => {});
  }

  private async recalcBatchCounters(batchId: string) {
    const counts = await this.prisma.ingestionFile.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { id: true },
    });

    const mapped = counts.find((c) => c.status === 'mapped')?._count.id ?? 0;
    const review = counts.find((c) => c.status === 'needs_review')?._count.id ?? 0;
    const failed = counts.find((c) => c.status === 'error')?._count.id ?? 0;
    const skipped = counts.find((c) => c.status === 'skipped')?._count.id ?? 0;
    const total = counts.reduce((s, c) => s + c._count.id, 0);
    const processedCount = mapped + review + failed + skipped;
    const doneStatus = review > 0 ? 'review_pending' : 'completed';

    await this.prisma.ingestionBatch.update({
      where: { id: batchId },
      data: {
        processedFiles: processedCount,
        autoPlaced: mapped,
        needsReview: review,
        failed,
        status: processedCount >= total ? doneStatus : 'processing',
      },
    });
  }

  private async updateJobProgress(
    jobStatusId: string, status: string, progress: number,
    resultPayload?: any, errorMessage?: string,
  ) {
    await this.prisma.jobStatus.update({
      where: { id: jobStatusId },
      data: {
        status,
        progress,
        ...(resultPayload ? { resultPayload } : {}),
        ...(errorMessage ? { errorMessage } : {}),
      },
    }).catch(() => {});
  }

  private async buildClassificationContext(orgId: string): Promise<ClassificationContext> {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      include: { organization: { select: { name: true } } },
    });

    const goals = (profile as any)?.complianceGoals ?? {};
    const infra = (profile as any)?.infrastructure ?? {};
    const dataHandling = (profile as any)?.dataHandling ?? {};

    // Load applicable control codes
    const applicability = await this.prisma.controlApplicability.findMany({
      where: { orgId, applicabilityStatus: 'applicable' },
      select: { control: { select: { code: true } } },
      take: 200,
    });

    // Load existing document titles for dedup detection
    const existingDocs = await this.prisma.document.findMany({
      where: { orgId, activeForOrg: true },
      select: { title: true },
      take: 100,
    });

    return {
      companyName: (profile as any)?.companyName ?? 'Unknown',
      industry: (profile as any)?.industry ?? 'Unknown',
      employeeCount: (profile as any)?.employeeCount ?? 'Unknown',
      targetFrameworks: goals.targetFrameworks ?? [],
      cloudProviders: infra.cloudProviders ?? [],
      dataTypes: dataHandling.dataTypes ?? [],
      applicableControlCodes: applicability.map((a) => a.control.code),
      existingDocTitles: existingDocs.map((d) => d.title),
    };
  }
}
