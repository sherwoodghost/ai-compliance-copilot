# RAG System

## Overview

The RAG (Retrieval-Augmented Generation) system provides semantic search over compliance documents, controls, policies, evidence, and other compliance artifacts. It enriches LLM prompts with relevant context retrieved from a vector store scoped to the requesting tenant.

Key components:

- **pgvector** — PostgreSQL extension that stores and queries `VECTOR(1536)` embeddings using approximate nearest-neighbor search via IVFFlat indexes.
- **EmbeddingsService** — wraps embedding providers (Anthropic or OpenAI). The active provider is selected at runtime via environment configuration. When `ENABLE_MOCK_EMBEDDINGS=true`, it returns deterministic mock vectors instead of calling an external API.
- **RagService** — the primary retrieval interface. `RagService.retrieve(query, orgId, options)` generates an embedding for the query, runs a cosine-similarity search against `vector_embeddings`, and returns the top-K matching chunks scoped to the requesting tenant.
- **Tenant isolation** — every query enforces `WHERE org_id = $1 OR org_id IS NULL`, ensuring an organization can only retrieve its own data plus global (shared) reference content.
- **In-memory fallback** — when the pgvector extension is not available (or `ENABLE_RAG_IN_MEMORY_FALLBACK=true`), RagService falls back to an in-memory vector store with JavaScript-computed cosine similarity.

---

## Source Types

Every document indexed into the vector store carries a `source_type` label. The table below lists the supported types, whether they are global or tenant-scoped, and when they are indexed.

| Source Type        | `org_id`            | Indexed when                         |
|--------------------|---------------------|--------------------------------------|
| `control`          | `NULL` (global)     | Seed time (SOC2 + ISO 27001 library) |
| `policy_template`  | `NULL` (global)     | Seed time                            |
| `policy`           | tenant `org_id`     | On policy approval                   |
| `evidence`         | tenant `org_id`     | On evidence upload                   |
| `agent_output`     | tenant `org_id`     | After each agent run                 |
| `business_profile` | tenant `org_id`     | On profile update                    |
| `risk_item`        | tenant `org_id`     | On risk creation / update            |

Global rows (`org_id IS NULL`) are shared across all tenants and represent the read-only compliance reference library. Tenant rows are private to the organization that owns them.

---

## `vector_embeddings` Table

```sql
CREATE TABLE vector_embeddings (
  id           UUID        PRIMARY KEY,
  org_id       UUID,                        -- NULL = global (control library, policy templates)
  source_type  VARCHAR,                     -- from SourceType enum
  source_id    UUID,
  chunk_index  INT,
  chunk_text   TEXT,
  embedding    VECTOR(1536),
  metadata     JSONB       DEFAULT '{}',
  created_at   TIMESTAMP   DEFAULT NOW()
);

CREATE INDEX ON vector_embeddings USING ivfflat (embedding vector_cosine_ops);
```

**Column notes:**

- `org_id` — `NULL` for global content; set to the tenant UUID for private content.
- `source_type` — discriminator that maps to the `SourceType` enum. Used to filter retrieval by document category.
- `source_id` — UUID of the originating record (e.g., `controls.id`, `policies.id`).
- `chunk_index` — 0-based index of the chunk within the source document (long documents are split into overlapping chunks before indexing).
- `embedding` — 1536-dimensional vector produced by the embedding provider.
- `metadata` — arbitrary JSON attached at index time (e.g., `{ "controlCode": "CC6.1", "framework": "SOC2" }`).

The IVFFlat index enables approximate cosine-distance queries at scale. For small datasets the index is not required, but it is created unconditionally so behavior is consistent as data grows.

---

## Tenant Isolation Query

RagService always executes the following query pattern. No path through the service omits the `org_id` filter.

```sql
SELECT *
FROM   vector_embeddings
WHERE  (org_id = $1 OR org_id IS NULL)
  AND  source_type = ANY($2)
ORDER  BY embedding <=> $3
LIMIT  $4
```

Parameters:

| Position | Value                                          |
|----------|------------------------------------------------|
| `$1`     | Requesting tenant's `org_id` UUID              |
| `$2`     | Array of `source_type` values to include       |
| `$3`     | Query embedding vector (1536 floats)           |
| `$4`     | `topK` limit (default 6)                       |

The `<=>` operator is the pgvector cosine-distance operator. Results are ordered ascending by distance (closest first).

---

## Retrieval Flow

The following steps describe how a RAG retrieval request flows from an agent through to the LLM prompt.

1. **Agent request** — the agent invocation payload includes a `ragQuery` string and a `ragSourceTypes` array specifying which source types to search.
2. **LlmGatewayService** — receives the request and delegates context assembly to `ContextPackerService.build()`.
3. **ContextPackerService** — calls `RagService.retrieve(query, orgId, { sourceTypes, topK: 6 })`.
4. **RagService** — generates an embedding for the query string via `EmbeddingsService`.
5. **Vector similarity search** — RagService executes the tenant-scoped cosine-distance query against pgvector.
6. **Top-K chunks returned** — each result includes `chunk_text`, `similarity_score`, `source_type`, `source_id`, and `metadata`.
7. **Context injection** — ContextPackerService appends the retrieved chunks to the context pack under a `RAG_CONTEXT` section, which is included in the system or user message sent to the LLM.
8. **Retrieval logging** — after the LLM call completes, each retrieved chunk is logged to `llm_retrieval_sources` linked to `llm_calls.id`, with an `included_in_prompt` flag indicating whether the chunk fit within the context window.

---

## In-Memory Fallback

When `ENABLE_RAG_IN_MEMORY_FALLBACK=true` is set, or when RagService detects at startup that the pgvector extension is not installed, it switches to an in-memory vector store.

**Behavior:**

- All indexed chunks are stored in a JavaScript `Map` keyed by embedding UUID.
- Retrieval computes cosine similarity in JavaScript against every stored vector and returns the top-K results.
- The in-memory store is not persisted — it is lost on process restart.
- Tenant isolation is still enforced (the same `org_id` filter logic applies in memory).

**Startup warning logged when active:**

```
RagService: pgvector extension not available — falling back to in-memory similarity
```

**Limitations:**

- No persistence across restarts.
- Linear scan — does not scale beyond small datasets.
- Not recommended for production deployments.

Use the in-memory fallback only for local development or CI environments where a PostgreSQL instance with pgvector is not available.

---

## Mock Embeddings

When `ENABLE_MOCK_EMBEDDINGS=true`, `EmbeddingsService` bypasses all external API calls and returns deterministic mock vectors.

**How it works:**

- The mock implementation hashes the input text to derive a seed.
- It generates a 1536-dimensional vector from that seed using a deterministic PRNG.
- The same input text always produces the same vector, so similarity rankings are stable across test runs.

**Use cases:**

- CI pipelines that must not call Voyage AI or OpenAI.
- Local development without API keys.
- Unit and integration tests for RagService and ContextPackerService.

Mock vectors are not semantically meaningful — similarity scores will not reflect real-world relevance. Do not enable this flag in staging or production.

---

## Indexing at Seed Time

The compliance control library (SOC 2 Type II controls and ISO 27001 controls) is indexed into `vector_embeddings` during the database seed run, with `org_id = NULL`. This makes all controls available as global retrieval context for every tenant without duplication.

**What is indexed at seed time:**

- All SOC 2 controls (Common Criteria, Availability, Confidentiality, etc.)
- All ISO 27001 Annex A controls
- Built-in policy templates

**When it runs:**

- Automatically on first startup if the `vector_embeddings` table is empty.
- Explicitly via `npm run seed` (or equivalent seed script).

The seed process chunks each control's description and guidance text, generates embeddings for each chunk, and inserts rows with `source_type = 'control'` or `source_type = 'policy_template'` and `org_id = NULL`.

---

## RagService API

```typescript
/**
 * Retrieve the top-K most relevant chunks for a query,
 * scoped to the requesting tenant plus global content.
 */
retrieve(
  query: string,
  orgId: string | undefined,
  options: {
    sourceTypes?: RagSourceType[];  // filter by source category
    topK?: number;                  // default 6
    minScore?: number;              // default 0.7; chunks below this score are excluded
  }
): Promise<RagChunk[]>

/**
 * Chunk and index a document into the vector store.
 */
index(
  text: string,
  sourceType: RagSourceType,
  sourceId: string,
  orgId?: string,         // undefined = global
  metadata?: object
): Promise<void>
```

### `RagChunk`

```typescript
interface RagChunk {
  id: string;
  sourceType: RagSourceType;
  sourceId: string;
  chunkIndex: number;
  chunkText: string;
  similarityScore: number;   // 0–1, higher = more similar
  metadata: Record<string, unknown>;
}
```

### `RagSourceType` enum

```typescript
enum RagSourceType {
  Control         = 'control',
  PolicyTemplate  = 'policy_template',
  Policy          = 'policy',
  Evidence        = 'evidence',
  AgentOutput     = 'agent_output',
  BusinessProfile = 'business_profile',
  RiskItem        = 'risk_item',
}
```

---

## Retrieval Log

Every `RagService.retrieve()` call produces a retrieval log. After the LLM call that consumed the context pack completes, each chunk that was a candidate for inclusion is recorded in `llm_retrieval_sources`.

### `llm_retrieval_sources` table

| Column               | Type      | Description                                                     |
|----------------------|-----------|-----------------------------------------------------------------|
| `id`                 | UUID      | Primary key                                                     |
| `llm_call_id`        | UUID      | Foreign key to `llm_calls.id`                                   |
| `source_type`        | VARCHAR   | `RagSourceType` value                                           |
| `source_id`          | UUID      | UUID of the originating record                                  |
| `chunk_id`           | UUID      | UUID of the specific `vector_embeddings` row                    |
| `similarity_score`   | FLOAT     | Cosine similarity score returned by pgvector                    |
| `included_in_prompt` | BOOLEAN   | `true` if the chunk was included in the prompt sent to the LLM  |
| `created_at`         | TIMESTAMP | Row creation time                                               |

`included_in_prompt` is `false` when a chunk was retrieved but did not fit within the context window or was filtered out by a post-retrieval step. This log is the primary audit trail for understanding what information the LLM had access to during a given call.
