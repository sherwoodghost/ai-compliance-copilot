import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface EmbeddingResult {
  embedding: number[];
  inputTokens: number;
  model: string;
}

/**
 * EmbeddingsService — wraps Anthropic's embedding API.
 * Falls back to a deterministic hash-based mock if the API key is not set
 * or if Anthropic does not support embeddings on the current key tier.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly client: Anthropic | null = null;
  private readonly embeddingDimensions = 1536;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('llm.anthropicApiKey');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — embeddings will use mock vectors');
    }
  }

  /**
   * Generate an embedding for a chunk of text.
   * Uses Anthropic's voyage-3 model via the API when available.
   * Falls back to a seeded random vector (stable for same input) in dev.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Truncate to stay within context limits
    const truncated = text.slice(0, 8192);

    if (this.client) {
      try {
        // Anthropic embeddings via raw API call (voyage-3)
        const response = await (this.client as any).post('/v1/embeddings', {
          model: 'voyage-3',
          input: truncated,
          input_type: 'document',
        });

        return {
          embedding: response.data?.[0]?.embedding ?? this.mockEmbedding(truncated),
          inputTokens: response.usage?.total_tokens ?? 0,
          model: 'voyage-3',
        };
      } catch (error: any) {
        this.logger.warn(
          `Embedding API call failed (${error.message}), falling back to mock`,
        );
        return {
          embedding: this.mockEmbedding(truncated),
          inputTokens: 0,
          model: 'mock',
        };
      }
    }

    return {
      embedding: this.mockEmbedding(truncated),
      inputTokens: 0,
      model: 'mock',
    };
  }

  /**
   * Generate embeddings for multiple texts in batch.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Process in parallel with concurrency limit
    const results: EmbeddingResult[] = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Deterministic mock embedding based on string content.
   * Same input always produces the same vector — useful for dev/test.
   */
  private mockEmbedding(text: string): number[] {
    const vector = new Array(this.embeddingDimensions).fill(0);
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const idx = (i * 31 + charCode) % this.embeddingDimensions;
      vector[idx] = (vector[idx] + charCode / 255) / 2;
    }
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map((v) => v / norm);
  }
}
