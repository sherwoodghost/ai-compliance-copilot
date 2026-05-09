import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';
import { SanitizerService } from './sanitizer.service';
import { RetentionService } from './retention.service';
import { AiFeaturesService } from './ai-features.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  NewVersionDto,
  AiImproveDto,
  ListDocumentsDto,
} from './dto/documents.dto';
import {
  DocumentApprovedEvent,
  DocumentApprovalRequestedEvent,
  DocumentArchivedEvent,
  DocumentCreatedEvent,
  DocumentRejectedEvent,
  DocumentUpdatedEvent,
  DocumentVersionCreatedEvent,
} from './events/document.events';
import { Prisma } from '@prisma/client';
import { EmbeddingService } from '../../embeddings/embedding.service';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DOCUMENT_QUEUE } from './document-queue.constants';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma:        PrismaService,
    private readonly sanitizer:     SanitizerService,
    private readonly retention:     RetentionService,
    private readonly aiFeatures:    AiFeaturesService,
    private readonly events:        EventEmitter2,
    private readonly embeddings:    EmbeddingService,
    private readonly featureFlags:  FeatureFlagService,
    @InjectQueue(DOCUMENT_QUEUE) private readonly queue: Queue,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private deriveText(html: string): string {
    return this.sanitizer.toPlainText(html);
  }

  private async findOrThrow(orgId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where:   { id, orgId, deletedAt: null },
      include: { owner: { select: { id: true, fullName: true } }, approver: { select: { id: true, fullName: true } } },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    return doc;
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async list(orgId: string, filters: ListDocumentsDto) {
    const page     = filters.page     ?? 1;
    const pageSize = filters.pageSize ?? 20;

    // Base Prisma filters (always applied, whether searching or not)
    const baseWhere: Prisma.DocumentWhereInput = {
      orgId,
      deletedAt: null,
      ...(filters.docType        && { docType:        filters.docType        as any }),
      ...(filters.status         && { status:         filters.status         as any }),
      ...(filters.classification && { classification: filters.classification as any }),
      ...(filters.ownerId        && { ownerId:        filters.ownerId }),
    };

    // ── Semantic (vector) search path ────────────────────────────────────────
    // Requires: pgvector extension + pgvector_setup.sql + feature flag enabled
    if (filters.semanticSearch?.trim()) {
      const flagEnabled = await this.featureFlags.isEnabled('documents.vectorSearch', orgId).catch(() => false);
      if (flagEnabled) {
        const semanticResults = await this.semanticSearch(orgId, filters.semanticSearch.trim(), pageSize, page);
        if (semanticResults) return semanticResults;
        // If semantic search fails, fall through to FTS/ILIKE
      }
    }

    // ── Full-text search path (PostgreSQL tsvector + GIN index) ─────────────
    // Requires documents_fts_setup.sql migration to have been applied.
    if (filters.search?.trim()) {
      const query = filters.search.trim();

      // Fetch ranked IDs from the generated search_vector column.
      // ts_headline() not used here to keep response lean — snippets can be added later.
      let ftsRows: { id: string; rank: number }[] = [];
      try {
        ftsRows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
          SELECT id,
                 ts_rank(search_vector, plainto_tsquery('english', ${query})) AS rank
          FROM   documents
          WHERE  org_id    = ${orgId}
            AND  deleted_at IS NULL
            AND  search_vector @@ plainto_tsquery('english', ${query})
          ORDER  BY rank DESC
          LIMIT  500
        `;
      } catch {
        // Graceful fallback: search_vector column may not exist yet (migration not run).
        // Fall through to the basic ILIKE path below.
        this.logger.warn('FTS search_vector unavailable — falling back to ILIKE search');
        ftsRows = [];
      }

      if (ftsRows.length > 0) {
        const rankedIds = ftsRows.map((r) => r.id);
        const where: Prisma.DocumentWhereInput = { ...baseWhere, id: { in: rankedIds } };

        const [total, rawItems] = await Promise.all([
          this.prisma.document.count({ where }),
          this.prisma.document.findMany({
            where,
            include: { owner: { select: { id: true, fullName: true } } },
            skip:  (page - 1) * pageSize,
            take:  pageSize,
          }),
        ]);

        // Re-order items by FTS rank (Prisma `findMany` with `id IN` loses rank order)
        const rankMap = new Map(ftsRows.map((r) => [r.id, r.rank]));
        const items   = rawItems.sort((a, b) => (rankMap.get(b.id) ?? 0) - (rankMap.get(a.id) ?? 0));

        return { total, page, pageSize, items, searchMode: 'fts' as const };
      }

      // Fallback: basic case-insensitive LIKE (pre-migration or empty FTS result)
      const fallbackWhere: Prisma.DocumentWhereInput = {
        ...baseWhere,
        OR: [
          { title:       { contains: query, mode: 'insensitive' } },
          { contentText: { contains: query, mode: 'insensitive' } },
          { tags:        { has: query } },
        ],
      };

      const [total, items] = await Promise.all([
        this.prisma.document.count({ where: fallbackWhere }),
        this.prisma.document.findMany({
          where:   fallbackWhere,
          include: { owner: { select: { id: true, fullName: true } } },
          orderBy: { updatedAt: 'desc' },
          skip:  (page - 1) * pageSize,
          take:  pageSize,
        }),
      ]);

      return { total, page, pageSize, items, searchMode: 'ilike' as const };
    }

    // ── Standard listing (no search) ────────────────────────────────────────
    const [total, items] = await Promise.all([
      this.prisma.document.count({ where: baseWhere }),
      this.prisma.document.findMany({
        where:   baseWhere,
        include: { owner: { select: { id: true, fullName: true } } },
        orderBy: { updatedAt: 'desc' },
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
    ]);

    return { total, page, pageSize, items };
  }

  // ── Get one ─────────────────────────────────────────────────────────────────

  async get(orgId: string, id: string) {
    return this.findOrThrow(orgId, id);
  }

  /** Alias for `get()` — used by the document worker for tenant-safe lookup */
  async findOne(orgId: string, id: string) {
    return this.findOrThrow(orgId, id);
  }

  /**
   * Update only the HTML content (and derived text/wordCount) of a document.
   * Used by the document worker after async operations like PDF import.
   * Bypasses lock check because the worker is called as part of the import flow
   * (doc is in a transient "processing" state, not under review).
   */
  async updateContent(
    orgId:     string,
    id:        string,
    actorId:   string,
    dto:       { contentHtml: string; title?: string },
  ) {
    const sanitized   = this.sanitizer.sanitize(dto.contentHtml);
    const contentText = this.deriveText(sanitized);
    const wordCount   = this.sanitizer.countWords(contentText);

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.title && { title: dto.title }),
        contentHtml: sanitized,
        contentText,
        wordCount,
        updatedAt:   new Date(),
      },
    });
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(orgId: string, actorId: string, dto: CreateDocumentDto) {
    const contentHtml  = dto.contentHtml ? this.sanitizer.sanitize(dto.contentHtml) : '';
    const contentText  = this.deriveText(contentHtml);
    const wordCount    = this.sanitizer.countWords(contentText);
    const retainUntil  = await this.defaultRetainUntil(orgId);

    const doc = await this.prisma.document.create({
      data: {
        orgId,
        title:          dto.title,
        docType:        (dto.docType as any) ?? 'policy',
        content:        (dto.content ?? {}) as Prisma.InputJsonValue,
        contentHtml,
        contentText,
        wordCount,
        classification: (dto.classification as any) ?? 'internal',
        controlIds:     dto.controlIds     ?? [],
        frameworkIds:   dto.frameworkIds   ?? [],
        tags:           dto.tags           ?? [],
        ownerId:        dto.ownerId        ?? actorId,
        reviewDue:      dto.reviewDue ? new Date(dto.reviewDue) : null,
        retainUntil,
      },
    });

    this.events.emit('document.created', new DocumentCreatedEvent(orgId, doc.id, doc.title, actorId));
    // Enqueue embedding generation (fire-and-forget, requires vectorSearch flag)
    this.enqueueEmbeddingJob(orgId, doc.id).catch(() => {});
    return doc;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(orgId: string, id: string, actorId: string, dto: UpdateDocumentDto) {
    const doc = await this.findOrThrow(orgId, id);

    // Block edits under legal hold (423 Locked — ISO A.5.33 / SOC2 CC6.5)
    if ((doc as any).legalHoldAt) {
      throw new ConflictException(
        `Document is under legal hold${(doc as any).legalHoldReason ? ': ' + (doc as any).legalHoldReason : ''}. ` +
        `Release the hold before editing.`,
      );
    }

    // Block edits when document is locked for approval
    if (doc.lockedAt) {
      throw new ConflictException(`Document is locked: ${doc.lockedReason ?? 'pending approval'}`);
    }

    const contentHtml = dto.contentHtml !== undefined
      ? this.sanitizer.sanitize(dto.contentHtml)
      : doc.contentHtml;
    const contentText = this.deriveText(contentHtml);
    const wordCount   = this.sanitizer.countWords(contentText);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        title:          dto.title          ?? doc.title,
        content:        dto.content        ? (dto.content as Prisma.InputJsonValue) : (doc.content ?? Prisma.JsonNull),
        contentHtml,
        contentText,
        wordCount,
        classification: dto.classification ? (dto.classification as any) : doc.classification,
        controlIds:     dto.controlIds     ?? doc.controlIds,
        frameworkIds:   dto.frameworkIds   ?? doc.frameworkIds,
        tags:           dto.tags           ?? doc.tags,
        ownerId:        dto.ownerId        ?? doc.ownerId,
        reviewDue:      dto.reviewDue ? new Date(dto.reviewDue) : doc.reviewDue,
      },
    });

    this.events.emit('document.updated', new DocumentUpdatedEvent(orgId, id, actorId));
    this.enqueueEmbeddingJob(orgId, id).catch(() => {});
    return updated;
  }

  // ── Request approval (locks document) ───────────────────────────────────────

  async requestApproval(orgId: string, id: string, actorId: string) {
    const doc = await this.findOrThrow(orgId, id);
    if (doc.lockedAt) throw new ConflictException('Document is already locked');
    if (doc.status === 'approved') throw new ConflictException('Document is already approved');

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        lockedAt:     new Date(),
        lockedBy:     actorId,
        lockedReason: 'pending_approval',
        status:       'review',
      },
    });

    this.events.emit(
      'document.approval_requested',
      new DocumentApprovalRequestedEvent(orgId, id, doc.title, actorId, doc.ownerId),
    );
    return updated;
  }

  // ── Approve ─────────────────────────────────────────────────────────────────

  async approve(orgId: string, id: string, actorId: string) {
    const doc = await this.findOrThrow(orgId, id);

    // SoD: approver must not be the document owner/author
    if (doc.ownerId === actorId) {
      throw new ForbiddenException('Approver cannot be the document owner (SoD violation)');
    }
    if (doc.status !== 'review') {
      throw new ConflictException(`Cannot approve document in status: ${doc.status}`);
    }

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status:       'approved',
        approvedBy:   actorId,
        approvedAt:   new Date(),
        lockedAt:     null,
        lockedBy:     null,
        lockedReason: null,
      },
    });

    this.events.emit(
      'document.approved',
      new DocumentApprovedEvent(orgId, id, doc.title, actorId, doc.classification, doc.controlIds),
    );
    // Re-index embedding on approval (approved docs get higher search priority)
    this.enqueueEmbeddingJob(orgId, id).catch(() => {});
    return updated;
  }

  // ── Reject ──────────────────────────────────────────────────────────────────

  async reject(orgId: string, id: string, actorId: string, reason: string) {
    const doc = await this.findOrThrow(orgId, id);
    if (doc.status !== 'review') throw new ConflictException(`Cannot reject document in status: ${doc.status}`);

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        status:       'draft',
        lockedAt:     null,
        lockedBy:     null,
        lockedReason: null,
      },
    });

    this.events.emit(
      'document.rejected',
      new DocumentRejectedEvent(orgId, id, doc.title, actorId, reason, doc.ownerId),
    );
    return updated;
  }

  // ── Archive ─────────────────────────────────────────────────────────────────

  async archive(orgId: string, id: string, actorId: string) {
    await this.retention.assertNotLocked(id, orgId);
    const doc = await this.findOrThrow(orgId, id);

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: 'archived', deletedAt: new Date() },
    });

    this.events.emit('document.archived', new DocumentArchivedEvent(orgId, id, actorId));
    return updated;
  }

  // ── New version ──────────────────────────────────────────────────────────────

  async newVersion(orgId: string, id: string, actorId: string, dto: NewVersionDto) {
    await this.retention.assertNotLocked(id, orgId);
    const doc = await this.findOrThrow(orgId, id);

    // Snapshot current version
    await this.prisma.documentVersion.create({
      data: {
        documentId:  id,
        version:     doc.version,
        content:     doc.content as Prisma.InputJsonValue,
        contentHtml: doc.contentHtml,
        createdBy:   actorId,
        note:        dto.note,
      },
    });

    const updated = await this.prisma.document.update({
      where: { id },
      data: {
        version:      doc.version + 1,
        status:       'draft',
        lockedAt:     null,
        lockedBy:     null,
        lockedReason: null,
        approvedBy:   null,
        approvedAt:   null,
      },
    });

    this.events.emit(
      'document.version_created',
      new DocumentVersionCreatedEvent(orgId, id, updated.version, actorId),
    );
    return updated;
  }

  // ── Version history ──────────────────────────────────────────────────────────

  async getVersions(orgId: string, id: string) {
    await this.findOrThrow(orgId, id); // ensure org isolation
    return this.prisma.documentVersion.findMany({
      where:   { documentId: id },
      orderBy: { version: 'desc' },
    });
  }

  // ── Restore version ──────────────────────────────────────────────────────────

  async restoreVersion(orgId: string, id: string, version: number, actorId: string) {
    const doc = await this.findOrThrow(orgId, id);
    const snap = await this.prisma.documentVersion.findFirst({
      where: { documentId: id, version },
    });
    if (!snap) throw new NotFoundException(`Version ${version} not found`);

    // Snapshot current before overwriting
    await this.prisma.documentVersion.create({
      data: {
        documentId:  id,
        version:     doc.version,
        content:     doc.content as Prisma.InputJsonValue,
        contentHtml: doc.contentHtml,
        createdBy:   actorId,
        note:        `Auto-snapshot before restore to v${version}`,
      },
    });

    return this.prisma.document.update({
      where: { id },
      data: {
        content:      snap.content as Prisma.InputJsonValue,
        contentHtml:  snap.contentHtml,
        contentText:  this.deriveText(snap.contentHtml),
        wordCount:    this.sanitizer.countWords(this.deriveText(snap.contentHtml)),
        version:      doc.version + 1,
        status:       'draft',
        lockedAt:     null,
        lockedBy:     null,
        lockedReason: null,
      },
    });
  }

  // ── AI: improve selection ─────────────────────────────────────────────────────

  async aiImprove(orgId: string, id: string, dto: AiImproveDto) {
    await this.findOrThrow(orgId, id);
    const improved = await this.aiFeatures.improveText(orgId, dto.selectedHtml, dto.instruction);
    return { improved: this.sanitizer.sanitize(improved) };
  }

  // ── AI: detect gaps ──────────────────────────────────────────────────────────

  async aiGaps(orgId: string, id: string) {
    const doc  = await this.findOrThrow(orgId, id);
    const text = doc.contentText ?? this.deriveText(doc.contentHtml);
    const gaps = await this.aiFeatures.detectGaps(orgId, text, doc.frameworkIds);
    return { gaps };
  }

  // ── Import PDF (AI extraction) ────────────────────────────────────────────────

  async importPdf(orgId: string, actorId: string, fileBuffer: Buffer, filename: string) {
    const base64 = fileBuffer.toString('base64');
    const markdown = await this.aiFeatures.extractPdf(orgId, base64);
    // Return extracted markdown — frontend will open in editor
    return { title: filename.replace(/\.pdf$/i, ''), content: markdown };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async defaultRetainUntil(orgId: string): Promise<Date> {
    const org = await this.prisma.organization.findUnique({
      where:  { id: orgId },
      select: { documentRetentionDays: true },
    });
    const days = org?.documentRetentionDays ?? 2555;
    const d    = new Date();
    d.setDate(d.getDate() + days);
    return d;
  }

  // ── Semantic Search (pgvector) ────────────────────────────────────────────────

  /**
   * Perform cosine-similarity semantic search over documents.
   *
   * Requirements:
   *  1. pgvector Postgres extension installed
   *  2. pgvector_setup.sql applied (creates `embedding` VECTOR(1536) on vector_embeddings)
   *  3. Documents indexed via `indexDocumentEmbedding()`
   *  4. Feature flag `documents.vectorSearch` enabled for the org
   *
   * Falls back to null on any failure (caller will use FTS/ILIKE instead).
   */
  async semanticSearch(
    orgId:    string,
    query:    string,
    pageSize: number,
    page:     number,
  ): Promise<{ total: number; page: number; pageSize: number; items: any[]; searchMode: 'semantic' } | null> {
    try {
      const result = await this.embeddings.embed(query);
      if (!result) return null;

      const vectorStr = `[${result.embedding.join(',')}]`;

      // Use pgvector cosine distance operator (<->) to rank by similarity
      // Only search embeddings for documents in this org (sourceType='document')
      const rows: { source_id: string; distance: number }[] = await this.prisma.$queryRawUnsafe(`
        SELECT source_id, embedding <-> $1::vector AS distance
        FROM   vector_embeddings
        WHERE  org_id      = $2
          AND  source_type = 'document'
          AND  embedding   IS NOT NULL
        ORDER  BY distance ASC
        LIMIT  100
      `, vectorStr, orgId);

      if (!rows || rows.length === 0) return null;

      // Map source_ids back to document IDs
      const docIds = rows.map((r) => r.source_id).filter(Boolean);
      const distMap = new Map(rows.map((r) => [r.source_id, r.distance]));

      // Fetch matching documents (apply base filters)
      const docs = await this.prisma.document.findMany({
        where:   { id: { in: docIds }, orgId, deletedAt: null },
        include: { owner: { select: { id: true, fullName: true } } },
      });

      // Sort by vector distance (lower = more similar)
      const sorted = docs.sort((a, b) => (distMap.get(a.id) ?? 1) - (distMap.get(b.id) ?? 1));
      const total  = sorted.length;
      const items  = sorted.slice((page - 1) * pageSize, page * pageSize);

      return { total, page, pageSize, items, searchMode: 'semantic' as const };
    } catch (err) {
      this.logger.warn(`Semantic search failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Index a document's content as a vector embedding in the `vector_embeddings` table.
   * Called after create/update/approve. Idempotent — upserts by (orgId, sourceType, sourceId).
   */
  async indexDocumentEmbedding(orgId: string, documentId: string): Promise<void> {
    try {
      const doc = await this.prisma.document.findFirst({
        where:  { id: documentId, orgId, deletedAt: null },
        select: { id: true, title: true, contentText: true, contentHtml: true, tags: true },
      });
      if (!doc) return;

      const text = `${doc.title}\n\n${doc.contentText ?? doc.contentHtml.replace(/<[^>]+>/g, ' ')}`.trim();
      if (!text) return;

      const result = await this.embeddings.embed(text);
      if (!result) return;

      const vectorStr = `[${result.embedding.join(',')}]`;

      // Check if embedding row already exists for this document
      const existing: any[] = await this.prisma.$queryRawUnsafe(`
        SELECT id FROM vector_embeddings
        WHERE  org_id      = $1
          AND  source_type = 'document'
          AND  source_id   = $2
          AND  chunk_index = 0
        LIMIT 1
      `, orgId, documentId);

      if (existing.length > 0) {
        // Update existing row
        await this.prisma.$executeRawUnsafe(`
          UPDATE vector_embeddings
          SET    chunk_text = $1,
                 embedding  = $2::vector,
                 created_at = NOW()
          WHERE  org_id      = $3
            AND  source_type = 'document'
            AND  source_id   = $4
            AND  chunk_index = 0
        `, text.slice(0, 4000), vectorStr, orgId, documentId);
      } else {
        // Insert new row (two steps: insert then set vector)
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO vector_embeddings (id, org_id, source_type, source_id, chunk_index, chunk_text, metadata, created_at)
          VALUES (gen_random_uuid(), $1, 'document', $2, 0, $3, '{}', NOW())
        `, orgId, documentId, text.slice(0, 4000));

        await this.prisma.$executeRawUnsafe(`
          UPDATE vector_embeddings
          SET    embedding = $1::vector
          WHERE  org_id      = $2
            AND  source_type = 'document'
            AND  source_id   = $3
            AND  chunk_index = 0
        `, vectorStr, orgId, documentId);
      }

      this.logger.debug(`Indexed embedding for document ${documentId}`);
    } catch (err) {
      // Non-blocking — if pgvector isn't set up, this just fails silently
      this.logger.debug(`Embedding indexing skipped for ${documentId}: ${(err as Error).message}`);
    }
  }

  /**
   * Enqueue an embedding generation job if the feature flag is enabled.
   * Called fire-and-forget after document create/update.
   */
  async enqueueEmbeddingJob(orgId: string, documentId: string): Promise<void> {
    try {
      const enabled = await this.featureFlags.isEnabled('documents.vectorSearch', orgId);
      if (!enabled) return;

      await this.queue.add('generate-embedding', {
        type:       'generate-embedding',
        orgId,
        documentId,
      }, {
        attempts:        2,
        backoff:         { type: 'exponential', delay: 5000 },
        removeOnComplete: 50,
        removeOnFail:    20,
      });
    } catch (err) {
      this.logger.warn(`Failed to enqueue embedding job: ${(err as Error).message}`);
    }
  }
  /**
   * Enqueue embedding jobs for all org documents (admin/manual trigger).
   * Returns immediately with a count of queued jobs.
   */
  async bulkReindexEmbeddings(orgId: string): Promise<{ queued: number; message: string }> {
    const docs = await this.prisma.document.findMany({
      where:  { orgId, deletedAt: null },
      select: { id: true },
      take:   500,
    });
    let queued = 0;
    for (const doc of docs) {
      await this.enqueueEmbeddingJob(orgId, doc.id).catch(() => {});
      queued++;
    }
    return { queued, message: 'Embedding indexing queued for ' + queued + ' document(s)' };
  }

}
