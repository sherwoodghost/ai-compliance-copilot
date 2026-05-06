import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EmbeddingsService } from './embeddings.service';

export type RagSourceType =
  | 'control'
  | 'policy_template'
  | 'evidence'
  | 'agent_output'
  | 'business_profile'
  | 'risk_register';

export interface RagChunk {
  id: string;
  sourceType: RagSourceType;
  sourceId: string | null;
  chunkIndex: number;
  chunkText: string;
  metadata: Record<string, any>;
  similarityScore: number;
}

export interface RagIndexRequest {
  orgId?: string;         // null/undefined = global (control library, policy templates)
  sourceType: RagSourceType;
  sourceId: string;
  chunks: Array<{
    index: number;
    text: string;
    metadata?: Record<string, any>;
  }>;
}

const CHUNK_SIZE = 1500;          // characters per chunk
const CHUNK_OVERLAP = 200;        // overlap between chunks
const DEFAULT_TOP_K = 8;

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  /** In-memory vector store: id → embedding vector. Used when pgvector is unavailable. */
  private readonly memoryStore = new Map<string, number[]>();
  private pgvectorAvailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  async onModuleInit() {
    await this.checkPgvector();
  }

  // ── Retrieval ─────────────────────────────────────────────────────────────

  /**
   * Retrieve top-K most relevant chunks for a query.
   * Enforces tenant isolation: org-specific documents + global (org_id IS NULL).
   */
  async retrieve(
    query: string,
    orgId: string | undefined,
    options: {
      sourceTypes?: RagSourceType[];
      topK?: number;
    } = {},
  ): Promise<RagChunk[]> {
    const { sourceTypes, topK = DEFAULT_TOP_K } = options;

    try {
      const queryEmbedding = await this.embeddings.embed(query);

      if (this.pgvectorAvailable) {
        return await this.retrieveFromPgvector(queryEmbedding.embedding, orgId, sourceTypes, topK);
      } else {
        return await this.retrieveFromMemory(query, queryEmbedding.embedding, orgId, sourceTypes, topK);
      }
    } catch (error: any) {
      this.logger.error(`RAG retrieval failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Format retrieved chunks into a string suitable for injection into a system prompt.
   */
  formatForPrompt(chunks: RagChunk[], label = 'RETRIEVED CONTEXT'): string {
    if (!chunks.length) return '';

    const formatted = chunks
      .map(
        (c, i) =>
          `[${i + 1}] Source: ${c.sourceType}${c.sourceId ? ` (${c.sourceId})` : ''} | Score: ${c.similarityScore.toFixed(3)}\n${c.chunkText}`,
      )
      .join('\n\n---\n\n');

    return `=== ${label} ===\n${formatted}\n=== END ${label} ===`;
  }

  // ── Indexing ──────────────────────────────────────────────────────────────

  /**
   * Index a document into the vector store.
   * Splits into chunks, generates embeddings, and persists.
   */
  async index(request: RagIndexRequest): Promise<void> {
    const { orgId, sourceType, sourceId, chunks } = request;

    // Delete existing chunks for this source (re-index)
    await this.prisma.vectorEmbedding.deleteMany({
      where: { sourceType, sourceId },
    });

    for (const chunk of chunks) {
      const { embedding } = await this.embeddings.embed(chunk.text);

      const record = await this.prisma.vectorEmbedding.create({
        data: {
          orgId: orgId ?? null,
          sourceType,
          sourceId,
          chunkIndex: chunk.index,
          chunkText: chunk.text,
          metadata: chunk.metadata ?? {},
        },
      });

      // Store in memory for fallback retrieval
      this.memoryStore.set(record.id, embedding);

      // Persist to pgvector if available
      if (this.pgvectorAvailable) {
        await this.upsertPgvectorEmbedding(record.id, embedding);
      }
    }

    this.logger.debug(
      `Indexed ${chunks.length} chunks for ${sourceType}/${sourceId} (org: ${orgId ?? 'global'})`,
    );
  }

  /**
   * Index text as chunks from a long document (auto-splits).
   */
  async indexDocument(
    orgId: string | undefined,
    sourceType: RagSourceType,
    sourceId: string,
    text: string,
    metadata: Record<string, any> = {},
  ): Promise<void> {
    const chunks = this.splitIntoChunks(text);
    await this.index({
      orgId,
      sourceType,
      sourceId,
      chunks: chunks.map((text, index) => ({ index, text, metadata })),
    });
  }

  /**
   * Index the full control library (global — org_id = null).
   * Called at startup by ControlLibraryService.
   */
  async indexControlLibrary(
    controls: Array<{
      id: string;
      code: string;
      title: string;
      description: string;
      framework: string;
    }>,
  ): Promise<void> {
    this.logger.log(`Indexing ${controls.length} controls into RAG...`);

    for (const control of controls) {
      const text = [
        `Control ${control.code}: ${control.title}`,
        `Framework: ${control.framework}`,
        `Description: ${control.description}`,
      ].join('\n');

      await this.index({
        orgId: undefined, // global
        sourceType: 'control',
        sourceId: control.id,
        chunks: [{ index: 0, text, metadata: { code: control.code, framework: control.framework } }],
      });
    }

    this.logger.log(`Control library RAG index complete`);
  }

  // ── Chunk splitting ───────────────────────────────────────────────────────

  splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));

      if (end === text.length) break;
      start = end - CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.trim().length > 0);
  }

  // ── Private implementations ───────────────────────────────────────────────

  private async checkPgvector(): Promise<void> {
    try {
      await this.prisma.$queryRaw`SELECT 1 FROM pg_extension WHERE extname = 'vector'`;
      this.pgvectorAvailable = true;
      this.logger.log('pgvector extension detected — using database vector search');
    } catch {
      this.pgvectorAvailable = false;
      this.logger.warn(
        'pgvector not available — using in-memory cosine similarity fallback. ' +
        'Run: CREATE EXTENSION vector; ALTER TABLE vector_embeddings ADD COLUMN embedding VECTOR(1536);',
      );
      // Pre-load existing embeddings into memory store
      await this.loadEmbeddingsIntoMemory();
    }
  }

  private async loadEmbeddingsIntoMemory(): Promise<void> {
    try {
      const records = await this.prisma.vectorEmbedding.findMany({
        select: { id: true },
        take: 10000,
      });
      this.logger.debug(`Loaded ${records.length} embedding record IDs into memory index`);
      // Note: actual vectors are not stored in the DB without pgvector,
      // so the memory store will only have vectors indexed in this session.
    } catch (error: any) {
      this.logger.warn(`Could not pre-load embeddings: ${error.message}`);
    }
  }

  private async retrieveFromPgvector(
    queryEmbedding: number[],
    orgId: string | undefined,
    sourceTypes: RagSourceType[] | undefined,
    topK: number,
  ): Promise<RagChunk[]> {
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const orgFilter = orgId
      ? `(org_id = '${orgId}' OR org_id IS NULL)`
      : `org_id IS NULL`;
    const typeFilter = sourceTypes?.length
      ? `AND source_type IN (${sourceTypes.map((t) => `'${t}'`).join(',')})`
      : '';

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, org_id, source_type, source_id, chunk_index, chunk_text, metadata,
              1 - (embedding <=> $1::vector) AS similarity_score
       FROM vector_embeddings
       WHERE ${orgFilter} ${typeFilter}
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vectorStr,
      topK,
    );

    return rows.map((row) => ({
      id: row.id,
      sourceType: row.source_type as RagSourceType,
      sourceId: row.source_id,
      chunkIndex: row.chunk_index,
      chunkText: row.chunk_text,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      similarityScore: parseFloat(row.similarity_score ?? '0'),
    }));
  }

  private async retrieveFromMemory(
    _query: string,
    queryEmbedding: number[],
    orgId: string | undefined,
    sourceTypes: RagSourceType[] | undefined,
    topK: number,
  ): Promise<RagChunk[]> {
    // Fetch candidates from DB (without vector similarity)
    const where: any = {
      OR: [
        { orgId: orgId ?? undefined },
        { orgId: null },
      ],
    };
    if (sourceTypes?.length) where.sourceType = { in: sourceTypes };

    const candidates = await this.prisma.vectorEmbedding.findMany({
      where,
      take: 500, // fetch top-N for in-memory scoring
    });

    // Score against in-memory vectors
    const scored = candidates
      .map((candidate) => {
        const storedEmbedding = this.memoryStore.get(candidate.id);
        const score = storedEmbedding
          ? this.embeddings.cosineSimilarity(queryEmbedding, storedEmbedding)
          : 0;
        return { candidate, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scored.map(({ candidate, score }) => ({
      id: candidate.id,
      sourceType: candidate.sourceType as RagSourceType,
      sourceId: candidate.sourceId,
      chunkIndex: candidate.chunkIndex,
      chunkText: candidate.chunkText,
      metadata: typeof candidate.metadata === 'string'
        ? JSON.parse(candidate.metadata as string)
        : (candidate.metadata as Record<string, any>) ?? {},
      similarityScore: score,
    }));
  }

  private async upsertPgvectorEmbedding(recordId: string, embedding: number[]): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE vector_embeddings SET embedding = $1::vector WHERE id = $2`,
      vectorStr,
      recordId,
    );
  }
}
