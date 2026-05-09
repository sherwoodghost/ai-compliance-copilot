import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { IngestionClassifierService } from './ingestion-classifier.service';

export const INGESTION_QUEUE = 'ingestion';

export interface IngestFile {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
  folderPath?: string;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly classifier: IngestionClassifierService,
    @InjectQueue(INGESTION_QUEUE) private readonly queue: Queue,
  ) {}

  /** Create a batch, stage files to storage, enqueue processing job */
  async createBatch(orgId: string, files: IngestFile[]) {
    // Validate org budget
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    const batch = await this.prisma.ingestionBatch.create({
      data: {
        orgId,
        totalFiles: files.length,
        status: 'queued',
      },
    });

    // Create JobStatus record
    const jobStatus = await this.prisma.jobStatus.create({
      data: {
        orgId,
        type: 'ingestion-batch',
        status: 'queued',
        progress: 0,
      },
    });

    // Stage files to storage + create IngestionFile records
    const fileRecords: Array<{ id: string; storageKey: string; filename: string; folderPath: string | null }> = [];

    for (const file of files) {
      const key = this.storage.ingestionKey(orgId, batch.id, file.originalname);
      this.storage.assertOrgOwnership(orgId, key);

      await this.storage.upload(key, file.buffer, file.mimetype);

      const record = await this.prisma.ingestionFile.create({
        data: {
          batchId: batch.id,
          orgId,
          originalName: file.originalname,
          storageKey: key,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          folderPath: file.folderPath ?? null,
          status: 'queued',
        },
      });

      fileRecords.push({ id: record.id, storageKey: key, filename: file.originalname, folderPath: file.folderPath ?? null });
    }

    // Enqueue processing job
    await this.queue.add('process-batch', {
      batchId: batch.id,
      orgId,
      jobStatusId: jobStatus.id,
    });

    await this.prisma.ingestionBatch.update({
      where: { id: batch.id },
      data: { status: 'processing' },
    });

    return { batchId: batch.id, jobStatusId: jobStatus.id, totalFiles: files.length };
  }

  async getBatchStatus(orgId: string, batchId: string) {
    const batch = await this.prisma.ingestionBatch.findFirst({
      where: { id: batchId, orgId },
      include: { _count: { select: { files: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async getBatchFiles(orgId: string, batchId: string, status?: string) {
    await this.getBatchStatus(orgId, batchId); // verify ownership
    return this.prisma.ingestionFile.findMany({
      where: {
        batchId,
        orgId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewFile(orgId: string, fileId: string, dto: {
    status: 'mapped' | 'skipped' | 'needs_review';
    suggestedControlIds?: string[];
    detectedType?: string;
    detectedFrameworks?: string[];
  }) {
    const file = await this.prisma.ingestionFile.findFirst({
      where: { id: fileId, orgId },
    });
    if (!file) throw new NotFoundException('File not found');

    const updated = await this.prisma.ingestionFile.update({
      where: { id: fileId },
      data: {
        status: dto.status,
        ...(dto.suggestedControlIds && { suggestedControlIds: dto.suggestedControlIds }),
        ...(dto.detectedType && { detectedType: dto.detectedType }),
        ...(dto.detectedFrameworks && { detectedFrameworks: dto.detectedFrameworks }),
      },
    });

    await this.recalcBatchCounters(file.batchId);
    return updated;
  }

  async bulkReview(orgId: string, batchId: string, fileIds: string[], status: 'mapped' | 'skipped') {
    await this.getBatchStatus(orgId, batchId); // verify ownership

    await this.prisma.ingestionFile.updateMany({
      where: { id: { in: fileIds }, batchId, orgId },
      data: { status },
    });

    await this.recalcBatchCounters(batchId);
    return { updated: fileIds.length };
  }

  async listBatches(orgId: string) {
    return this.prisma.ingestionBatch.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recalcBatchCounters(batchId: string) {
    const counts = await this.prisma.ingestionFile.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });

    const autoPlaced = counts.find(c => c.status === 'mapped')?._count._all ?? 0;
    const needsReview = counts.find(c => c.status === 'needs_review')?._count._all ?? 0;
    const failed = counts.find(c => c.status === 'error')?._count._all ?? 0;
    const processed = counts.reduce((acc, c) => acc + c._count._all, 0);
    const total = await this.prisma.ingestionFile.count({ where: { batchId } });

    const isDone = processed === total;

    await this.prisma.ingestionBatch.update({
      where: { id: batchId },
      data: {
        autoPlaced,
        needsReview,
        failed,
        processedFiles: processed,
        status: isDone ? (needsReview > 0 ? 'review_pending' : 'completed') : 'processing',
      },
    });
  }
}
