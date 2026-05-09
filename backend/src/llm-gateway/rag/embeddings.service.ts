import { Injectable, Logger } from '@nestjs/common';
import { AnthropicProvider, EmbeddingResult } from '../../llm/providers/anthropic.provider';

export type { EmbeddingResult };

/**
 * EmbeddingsService — thin wrapper around AnthropicProvider.embed().
 *
 * All Anthropic SDK usage is centralised in AnthropicProvider (the single
 * authorised place for `new Anthropic()`).  EmbeddingsService delegates the
 * actual API call there and adds batch-processing and cosine-similarity helpers.
 */
@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);

  constructor(private readonly anthropicProvider: AnthropicProvider) {}

  /**
   * Generate an embedding for a chunk of text.
   * Uses Anthropic voyage-3 when the API key is set; falls back to a mock vector.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    return this.anthropicProvider.embed(text);
  }

  /**
   * Generate embeddings for multiple texts in batch (concurrency-limited).
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
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
   * Compute cosine similarity between two equal-length vectors.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
