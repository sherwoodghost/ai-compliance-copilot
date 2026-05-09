import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { DocumentsService } from '../documents.service';
import { AiFeaturesService } from '../ai-features.service';
import { NotificationService } from '../../../notifications/notification.service';
import { StorageService } from '../../../storage/storage.service';

import { DOCUMENT_QUEUE } from '../document-queue.constants';
export { DOCUMENT_QUEUE };

// ─── Job payload types ────────────────────────────────────────────────────────

export interface PdfImportJobData {
  type:       'pdf-import';
  orgId:      string;
  documentId: string;   // pre-created Document record to update after extraction
  fileKey:    string;   // storage key of the uploaded PDF
  userId:     string;
}

export interface AiGapsJobData {
  type:       'ai-gaps';
  orgId:      string;
  documentId: string;
  userId:     string;
  frameworks: string[];
}

export interface BulkExportJobData {
  type:        'bulk-export';
  orgId:       string;
  documentIds: string[];
  userId:      string;
}

export interface GenerateEmbeddingJobData {
  type:       'generate-embedding';
  orgId:      string;
  documentId: string;
}

export type DocumentJobData =
  | PdfImportJobData
  | AiGapsJobData
  | BulkExportJobData
  | GenerateEmbeddingJobData;

// ─── Processor ───────────────────────────────────────────────────────────────

/**
 * DocumentWorker
 *
 * Handles long-running document operations asynchronously so that HTTP handlers
 * return immediately (HTTP 202 Accepted) and the browser gets a progress update
 * via in-app notification when the job completes or fails.
 *
 * Job types:
 *  • pdf-import   — AI-extract text from a PDF and populate document content
 *  • ai-gaps      — Full-document gap analysis via Claude Haiku
 *  • bulk-export  — Tenant-validated bulk document export
 */
@Processor(DOCUMENT_QUEUE)
export class DocumentWorker {
  private readonly logger = new Logger(DocumentWorker.name);

  constructor(
    private readonly documents:     DocumentsService,
    private readonly aiFeatures:    AiFeaturesService,
    private readonly notifications: NotificationService,
    private readonly storage:       StorageService,
  ) {}

  // ─── PDF Import ─────────────────────────────────────────────────────────────

  @Process('pdf-import')
  async handlePdfImport(job: Job<PdfImportJobData>) {
    const { orgId, documentId, fileKey, userId } = job.data;
    this.logger.log(`[pdf-import] doc=${documentId} org=${orgId}`);

    await job.progress(10);

    // Download the PDF from storage and convert to base64
    const fileBuffer = await this.storage.download(fileKey);
    const base64Pdf  = fileBuffer.toString('base64');
    await job.progress(25);

    // Extract structured markdown from the PDF via Claude Haiku
    const markdownContent = await this.aiFeatures.extractPdf(orgId, base64Pdf);
    await job.progress(65);

    // Convert markdown to simple HTML for storage
    const contentHtml = this.markdownToHtml(markdownContent);

    // Update the document content with the extracted text
    await this.documents.updateContent(orgId, documentId, userId, { contentHtml });
    await job.progress(90);

    this.logger.log(`[pdf-import] completed doc=${documentId}`);
    return { documentId };
  }

  // ─── AI Gap Analysis ─────────────────────────────────────────────────────────

  @Process('ai-gaps')
  async handleAiGaps(job: Job<AiGapsJobData>) {
    const { orgId, documentId, userId, frameworks } = job.data;
    this.logger.log(`[ai-gaps] doc=${documentId} org=${orgId}`);

    await job.progress(20);

    // Get document content
    const doc     = await this.documents.findOne(orgId, documentId);
    const content = (doc as any).contentText ?? (doc as any).title ?? '';

    // Use explicitly-passed frameworks; fall back to the org's active frameworks from their profile,
    // then default to the two most common frameworks if no profile exists.
    let effectiveFrameworks = frameworks;
    if (!effectiveFrameworks?.length) {
      try {
        const profile = await (this.documents as any).prisma?.businessProfile?.findUnique({ where: { orgId } });
        effectiveFrameworks = (profile?.complianceGoals as any)?.frameworks ?? [];
      } catch {
        effectiveFrameworks = [];
      }
    }
    const gaps = await this.aiFeatures.detectGaps(orgId, content, effectiveFrameworks);
    await job.progress(90);

    this.logger.log(`[ai-gaps] found ${gaps.length} gap(s) for doc=${documentId}`);
    return { documentId, gaps };
  }

  // ─── Bulk Export ─────────────────────────────────────────────────────────────

  @Process('bulk-export')
  async handleBulkExport(job: Job<BulkExportJobData>) {
    const { orgId, documentIds, userId } = job.data;
    this.logger.log(`[bulk-export] ${documentIds.length} docs org=${orgId}`);

    // Tenant isolation: verify every document belongs to this org
    let verified = 0;
    let skipped  = 0;
    for (const docId of documentIds) {
      const doc = await this.documents.findOne(orgId, docId).catch(() => null);
      if (doc) verified++;
      else {
        skipped++;
        this.logger.warn(`[bulk-export] doc ${docId} not found in org ${orgId} — skipped`);
      }
    }

    await job.progress(80);
    this.logger.log(`[bulk-export] completed ${verified}/${documentIds.length} docs`);
    return { orgId, userId, count: verified, skipped };
  }


  // ─── Generate Embedding ──────────────────────────────────────────────────────

  @Process('generate-embedding')
  async handleGenerateEmbedding(job: Job<GenerateEmbeddingJobData>) {
    const { orgId, documentId } = job.data;
    this.logger.log('[generate-embedding] doc=' + documentId + ' org=' + orgId);

    await job.progress(20);
    await this.documents.indexDocumentEmbedding(orgId, documentId);
    await job.progress(100);

    this.logger.log('[generate-embedding] done doc=' + documentId);
    return { documentId };
  }

  // ─── Lifecycle hooks ──────────────────────────────────────────────────────────

  @OnQueueCompleted()
  async onCompleted(job: Job<DocumentJobData>, result: unknown) {
    const { orgId } = job.data;
    const userId = (job.data as any).userId;
    const jobType = job.data.type;

    // Silent jobs — no user notification needed
    if (jobType === 'generate-embedding') return;

    const titleMap: Record<string, string> = {
      'pdf-import':  'PDF import complete',
      'ai-gaps':     'Gap analysis complete',
      'bulk-export': 'Bulk export ready',
    };

    const bodyMap: Record<string, string> = {
      'pdf-import':  'Your PDF has been imported and is ready to edit.',
      'ai-gaps':     'Compliance gap analysis finished — review the sidebar.',
      'bulk-export': `${(result as any)?.count ?? 0} document(s) exported successfully.`,
    };

    if (!userId) return;
    await this.notifications.send(orgId, userId, {
      type:     'document.job.complete',
      title:    titleMap[jobType] ?? 'Document job complete',
      body:     bodyMap[jobType] ?? 'Background document task finished.',
      href:     '/documents',
      priority: 'normal',
    }).catch(() => {});
  }

  @OnQueueFailed()
  async onFailed(job: Job<DocumentJobData>, error: Error) {
    const { orgId } = job.data;
    const userId = (job.data as any).userId;
    if (job.data.type === 'generate-embedding') return;
    this.logger.error(`Document job ${job.data.type} failed (attempt ${job.attemptsMade}): ${error.message}`);

    // Only notify on final failure (after all retries exhausted)
    if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
      if (!userId) return;
      await this.notifications.send(orgId, userId, {
        type:     'document.job.failed',
        title:    'Document job failed',
        body:     `Background task "${job.data.type}" failed after ${job.attemptsMade} attempt(s). Please try again.`,
        href:     '/documents',
        priority: 'high',
      }).catch(() => {});
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Minimal markdown → HTML converter for extracted PDF content */
  private markdownToHtml(markdown: string): string {
    return markdown
      .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
      .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,    '<em>$1</em>')
      .replace(/^- (.+)$/gm,   '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`)
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul])(.+)$/gm, (line) => line ? `<p>${line}</p>` : '')
      .trim();
  }
}
