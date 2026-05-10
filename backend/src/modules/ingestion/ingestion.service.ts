import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ReviewIngestionFileDto, BulkReviewDto, CreatePresignedBatchDto } from './dto/ingestion.dto';
import { v4 as uuidv4 } from 'uuid';

export const INGESTION_QUEUE = 'ingestion';

/** Resolve application/octet-stream to correct MIME type based on file extension */
function resolveMimeType(mimetype: string, filename: string): string {
  if (mimetype !== 'application/octet-stream') return mimetype;
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    pdf: 'application/pdf',
    csv: 'text/csv',
    md: 'text/markdown',
    txt: 'text/plain',
  };
  return map[ext ?? ''] ?? mimetype;
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  async createPresignedBatch(orgId: string, dto: CreatePresignedBatchDto): Promise<any> {
    if (!dto.files || dto.files.length === 0) {
      throw new BadRequestException('No files specified');
    }
    if (dto.files.length > 500) {
      throw new BadRequestException('Maximum 500 files per batch');
    }

    // Create job status + batch record
    const jobStatus = await this.prisma.jobStatus.create({
      data: { orgId, type: 'ingestion-batch', status: 'uploading', progress: 0 },
    });

    const batch = await this.prisma.ingestionBatch.create({
      data: {
        orgId,
        totalFiles: dto.files.length,
        status: 'uploading',
        jobStatusId: jobStatus.id,
      },
    });

    // Generate presigned URLs and create IngestionFile records
    const uploadUrls = await Promise.all(
      dto.files.map(async (file) => {
        const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = this.storage.ingestionKey(orgId, batch.id, `${uuidv4()}_${safeFilename}`);

        const uploadUrl = await this.storage.getPresignedUploadUrl(key, file.mimeType, 3600);

        await this.prisma.ingestionFile.create({
          data: {
            batchId: batch.id,
            orgId,
            originalName: file.filename,
            storageKey: key,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            folderPath: file.folderPath ?? null,
            status: 'uploading',
          },
        });

        return { filename: file.filename, uploadUrl, storageKey: key };
      }),
    );

    return {
      batchId: batch.id,
      jobStatusId: jobStatus.id,
      uploadUrls,
    };
  }

  async confirmBatch(orgId: string, batchId: string): Promise<any> {
    const batch = await this.prisma.ingestionBatch.findFirst({
      where: { id: batchId, orgId, status: 'uploading' },
    });
    if (!batch) throw new NotFoundException('Batch not found or already confirmed');

    // Mark all files as queued
    await this.prisma.ingestionFile.updateMany({
      where: { batchId, orgId, status: 'uploading' },
      data: { status: 'queued' },
    });

    await this.prisma.ingestionBatch.update({
      where: { id: batchId },
      data: { status: 'queued' },
    });

    // Enqueue processing
    await this.ingestionQueue.add(
      'process-batch',
      { batchId, orgId, jobStatusId: batch.jobStatusId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return { batchId, status: 'queued', totalFiles: batch.totalFiles };
  }

  async createBatch(orgId: string, files: Express.Multer.File[], folderPaths: Record<string, string> = {}): Promise<any> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }
    if (files.length > 500) {
      throw new BadRequestException('Maximum 500 files per batch');
    }

    const batchId = uuidv4();

    // Create job status
    const jobStatus = await this.prisma.jobStatus.create({
      data: {
        orgId,
        type: 'ingestion-batch',
        status: 'queued',
        progress: 0,
      },
    });

    // Create batch record
    const batch = await this.prisma.ingestionBatch.create({
      data: {
        orgId,
        totalFiles: files.length,
        status: 'queued',
        jobStatusId: jobStatus.id,
      },
    });

    // Stage files to storage and create IngestionFile records
    const ingestionFiles = await Promise.all(
      files.map(async (file) => {
        const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        const key = this.storage.ingestionKey(orgId, batch.id, `${uuidv4()}_${safeFilename}`);
        const resolvedMime = resolveMimeType(file.mimetype, file.originalname);

        // Verify org ownership before writing
        this.storage.assertOrgOwnership(orgId, key);

        // Upload to staging storage
        await this.storage.upload(key, file.buffer, resolvedMime);

        return this.prisma.ingestionFile.create({
          data: {
            batchId: batch.id,
            orgId,
            originalName: file.originalname,
            storageKey: key,
            mimeType: resolvedMime,
            sizeBytes: file.size,
            folderPath: folderPaths[file.originalname] ?? null,
            status: 'queued',
          },
        });
      }),
    );

    // Enqueue processing job
    await this.ingestionQueue.add(
      'process-batch',
      { batchId: batch.id, orgId, jobStatusId: jobStatus.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return {
      batchId: batch.id,
      jobStatusId: jobStatus.id,
      totalFiles: files.length,
      status: 'queued',
    };
  }

  async getBatchStatus(orgId: string, batchId: string): Promise<any> {
    const batch = await this.prisma.ingestionBatch.findFirst({
      where: { id: batchId, orgId },
      include: { files: true },
    });
    if (!batch) throw new NotFoundException('Ingestion batch not found');

    const byStatus: Record<string, number> = {};
    for (const f of batch.files) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    }

    return {
      id: batch.id,
      status: batch.status,
      totalFiles: batch.totalFiles,
      processedFiles: batch.processedFiles,
      autoPlaced: batch.autoPlaced,
      needsReview: batch.needsReview,
      failed: batch.failed,
      filesByStatus: byStatus,
      jobStatusId: batch.jobStatusId,
    };
  }

  async getBatchFiles(orgId: string, batchId: string, statusFilter?: string): Promise<any[]> {
    const batch = await this.prisma.ingestionBatch.findFirst({
      where: { id: batchId, orgId },
    });
    if (!batch) throw new NotFoundException('Ingestion batch not found');

    return this.prisma.ingestionFile.findMany({
      where: {
        batchId,
        orgId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewFile(orgId: string, fileId: string, dto: ReviewIngestionFileDto, skipRecalc = false): Promise<any> {
    const file = await this.prisma.ingestionFile.findFirst({
      where: { id: fileId, orgId },
    });
    if (!file) throw new NotFoundException('Ingestion file not found');

    if (dto.skipFile) {
      return this.prisma.ingestionFile.update({
        where: { id: fileId },
        data: { status: 'skipped' },
      });
    }

    // Create Document from the file
    let documentId = dto.documentId;
    if (documentId) {
      // Verify the target document belongs to the same organization
      const targetDoc = await this.prisma.document.findFirst({
        where: { id: documentId, orgId },
      });
      if (!targetDoc) throw new NotFoundException('Target document not found in this organization');
    }
    if (!documentId) {
      const doc = await this.prisma.document.create({
        data: {
          orgId,
          title: file.originalName.replace(/\.[^.]+$/, ''), // strip extension
          docType: dto.documentType ?? 'other',
          controlIds: dto.controlIds ?? file.suggestedControlIds,
          detectedFrameworks: file.detectedFrameworks,
          sourceStorageKey: file.storageKey,
          content: {},
          contentHtml: '',
        },
      });
      documentId = doc.id;
    }

    await this.prisma.ingestionFile.update({
      where: { id: fileId },
      data: {
        status: 'mapped',
        documentId,
        ...(dto.controlIds && { suggestedControlIds: dto.controlIds }),
        ...(dto.documentType && { detectedType: dto.documentType }),
      },
    });

    // Update batch counters (skipped during bulk operations)
    if (!skipRecalc) {
      await this.recalcBatchCounters(file.batchId);
    }

    return { fileId, documentId, status: 'mapped' };
  }

  async bulkReview(orgId: string, batchId: string, dto: BulkReviewDto): Promise<any> {
    const results = await Promise.allSettled(
      dto.fileIds.map((fid) =>
        this.reviewFile(orgId, fid, {
          documentType: dto.documentType,
          controlIds: dto.controlIds,
        }, true),
      ),
    );

    // Single batch recalc at the end instead of one per file
    await this.recalcBatchCounters(batchId);

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return { succeeded, failed, batchId };
  }

  async listBatches(orgId: string): Promise<any[]> {
    return this.prisma.ingestionBatch.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  // TODO: DRY - also duplicated in ingestion.worker.ts
  async recalcBatchCounters(batchId: string) {
    const counts = await this.prisma.ingestionFile.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { id: true },
    });

    const mapped   = counts.find((c) => c.status === 'mapped')?._count.id ?? 0;
    const review   = counts.find((c) => c.status === 'needs_review')?._count.id ?? 0;
    const failed   = counts.find((c) => c.status === 'error')?._count.id ?? 0;
    const total    = counts.reduce((s, c) => s + c._count.id, 0);
    const processed = mapped + review + failed + (counts.find((c) => c.status === 'skipped')?._count.id ?? 0);

    const allDone = processed >= total;

    await this.prisma.ingestionBatch.update({
      where: { id: batchId },
      data: {
        processedFiles: processed,
        autoPlaced: mapped,
        needsReview: review,
        failed,
        status: allDone ? (review > 0 ? 'review_pending' : 'completed') : 'processing',
      },
    });
  }
}
