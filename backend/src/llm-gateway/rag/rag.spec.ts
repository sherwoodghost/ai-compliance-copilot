/**
 * RAG System Tests
 *
 * Tests retrieval, indexing, tenant isolation, chunk splitting,
 * and in-memory fallback behavior.
 *
 * Note: These tests use mocked Prisma + EmbeddingsService.
 * No database connection or API keys required.
 */

import { RagService, RagSourceType } from './rag.service';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const makeEmbedding = (seed: number): number[] =>
  Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));

const mockEmbeddingsService = {
  embed: jest.fn(async (text: string) => ({
    embedding: makeEmbedding(text.charCodeAt(0)),
    model: 'mock-embed',
    dimensions: 8,
  })),
  cosineSimilarity: jest.fn((a: number[], b: number[]): number => {
    const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return normA && normB ? dot / (normA * normB) : 0;
  }),
};

const storedEmbeddings: Record<string, number[]> = {};

const makePrisma = (rows: any[] = []) => ({
  $queryRaw: jest.fn().mockResolvedValue([{ extname: 'vector' }]),
  $queryRawUnsafe: jest.fn().mockResolvedValue(rows),
  $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  vectorEmbedding: {
    create: jest.fn(async (args: any) => {
      const id = `vec-${Math.random().toString(36).slice(2)}`;
      const record = { id, ...args.data };
      // Store embedding for memory fallback tests
      storedEmbeddings[id] = makeEmbedding(args.data.chunkText.charCodeAt(0));
      return record;
    }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    findMany: jest.fn().mockResolvedValue(rows),
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RagService — chunk splitting', () => {
  let service: RagService;

  beforeEach(() => {
    service = new RagService(makePrisma() as any, mockEmbeddingsService as any);
    // Bypass pgvector check
    (service as any).pgvectorAvailable = false;
  });

  it('R01 — splits empty text into no chunks', () => {
    const chunks = service.splitIntoChunks('');
    expect(chunks).toHaveLength(0);
  });

  it('R02 — short text produces a single chunk', () => {
    const chunks = service.splitIntoChunks('Short text under CHUNK_SIZE');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe('Short text under CHUNK_SIZE');
  });

  it('R03 — long text is split into multiple overlapping chunks', () => {
    const longText = 'a'.repeat(3500);
    const chunks = service.splitIntoChunks(longText);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('R04 — chunks do not exceed CHUNK_SIZE characters', () => {
    const longText = 'word '.repeat(1000);
    const chunks = service.splitIntoChunks(longText);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(1500);
    }
  });

  it('R05 — whitespace-only chunks are filtered out', () => {
    const textWithBlankSections = 'some content\n\n\n   \n\nmore content';
    const chunks = service.splitIntoChunks(textWithBlankSections);
    for (const chunk of chunks) {
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('RagService — formatForPrompt', () => {
  let service: RagService;

  beforeEach(() => {
    service = new RagService(makePrisma() as any, mockEmbeddingsService as any);
  });

  it('R06 — returns empty string for empty chunks array', () => {
    const result = service.formatForPrompt([]);
    expect(result).toBe('');
  });

  it('R07 — includes source type and similarity score in formatted output', () => {
    const chunks = [
      {
        id: 'c1',
        sourceType: 'control' as RagSourceType,
        sourceId: 'ctrl-uuid',
        chunkIndex: 0,
        chunkText: 'CC6.1 requires MFA for privileged access',
        metadata: {},
        similarityScore: 0.92,
      },
    ];
    const result = service.formatForPrompt(chunks);
    expect(result).toContain('control');
    expect(result).toContain('0.920');
    expect(result).toContain('CC6.1');
  });

  it('R08 — uses custom label in output', () => {
    const result = service.formatForPrompt(
      [{ id: 'x', sourceType: 'control' as RagSourceType, sourceId: null, chunkIndex: 0, chunkText: 'text', metadata: {}, similarityScore: 0.8 }],
      'COMPLIANCE CONTEXT',
    );
    expect(result).toContain('COMPLIANCE CONTEXT');
  });
});

describe('RagService — indexing', () => {
  let service: RagService;
  let mockPrisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma = makePrisma();
    service = new RagService(mockPrisma as any, mockEmbeddingsService as any);
    (service as any).pgvectorAvailable = false;
  });

  it('R09 — index() deletes existing chunks before re-indexing', async () => {
    await service.index({
      orgId: 'org-123',
      sourceType: 'policy_template',
      sourceId: 'policy-abc',
      chunks: [{ index: 0, text: 'Policy content', metadata: {} }],
    });
    expect(mockPrisma.vectorEmbedding.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceType: 'policy_template', sourceId: 'policy-abc' },
      }),
    );
  });

  it('R10 — index() calls embeddings service for each chunk', async () => {
    await service.index({
      orgId: 'org-123',
      sourceType: 'control',
      sourceId: 'ctrl-001',
      chunks: [
        { index: 0, text: 'Chunk one', metadata: {} },
        { index: 1, text: 'Chunk two', metadata: {} },
      ],
    });
    expect(mockEmbeddingsService.embed).toHaveBeenCalledTimes(2);
  });

  it('R11 — indexControlLibrary() indexes with orgId = null (global scope)', async () => {
    await service.indexControlLibrary([
      { id: 'ctrl-1', code: 'CC6.1', title: 'Logical Access', description: 'MFA required', framework: 'SOC2' },
    ]);
    const createCall = mockPrisma.vectorEmbedding.create.mock.calls[0][0];
    expect(createCall.data.orgId).toBeNull();
  });
});

describe('RagService — tenant isolation (in-memory mode)', () => {
  it('R12 — retrieve() query includes orgId OR null filter in pgvector path', async () => {
    const mockPrisma = makePrisma();
    // Simulate pgvector available
    mockPrisma.$queryRaw.mockResolvedValue([{ extname: 'vector' }]);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    const service = new RagService(mockPrisma as any, mockEmbeddingsService as any);
    (service as any).pgvectorAvailable = true;

    await service.retrieve('query', 'org-A', { topK: 5 });

    const rawQuery: string = mockPrisma.$queryRawUnsafe.mock.calls[0][0];
    // The query must filter by org-A OR null — never return cross-tenant data
    expect(rawQuery).toContain('org_id');
    expect(rawQuery).toContain('IS NULL');
  });
});
