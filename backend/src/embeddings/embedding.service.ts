import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingResult {
  embedding: number[];
  model:     string;
  tokens:    number;
}

/**
 * EmbeddingService
 *
 * Generates vector embeddings using OpenAI text-embedding-3-small via:
 *  1. OpenRouter (preferred — same API key as LLM calls)
 *  2. OpenAI direct (if OPENAI_API_KEY set)
 *  3. Returns null if neither is configured (graceful degradation)
 *
 * Model: text-embedding-3-small  → 1536 dimensions, ~$0.02/M tokens
 */
@Injectable()
export class EmbeddingService {
  private readonly logger        = new Logger(EmbeddingService.name);
  private readonly openrouterKey: string | undefined;
  private readonly openaiKey:     string | undefined;

  // 1536 for text-embedding-3-small
  static readonly DIMENSIONS = 1536;

  constructor(private readonly config: ConfigService) {
    this.openrouterKey = config.get<string>('llm.openrouterApiKey');
    this.openaiKey     = config.get<string>('llm.openaiApiKey');
  }

  /**
   * Generate a single embedding vector for a text string.
   * Returns null if no embedding provider is configured.
   */
  async embed(text: string): Promise<EmbeddingResult | null> {
    if (!text?.trim()) return null;

    // Truncate to ~8000 tokens to stay within model context window
    const truncated = this.truncateToTokens(text, 8000);

    if (this.openrouterKey) {
      return this.embedViaOpenRouter(truncated);
    }
    if (this.openaiKey) {
      return this.embedViaOpenAI(truncated);
    }

    this.logger.warn('No embedding provider configured (set OPENROUTER_API_KEY or OPENAI_API_KEY)');
    return null;
  }

  /**
   * Batch embed multiple texts. Returns array aligned with input (nulls for failures).
   */
  async embedBatch(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    // OpenRouter/OpenAI support batch embeddings in one request (more efficient)
    const truncated = texts
      .map((t) => this.truncateToTokens(t ?? '', 8000))
      .filter((t) => t.trim().length > 0);

    if (truncated.length === 0) return texts.map(() => null);

    try {
      if (this.openrouterKey) {
        return await this.batchEmbedViaOpenRouter(truncated);
      }
      if (this.openaiKey) {
        return await this.batchEmbedViaOpenAI(truncated);
      }
    } catch (err) {
      this.logger.error(`Batch embed failed: ${(err as Error).message}`);
    }

    return texts.map(() => null);
  }

  // ─── OpenRouter path ──────────────────────────────────────────────────────

  private async embedViaOpenRouter(text: string): Promise<EmbeddingResult | null> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type':  'application/json',
          'HTTP-Referer':  'https://ai-compliance-copilot.app',
          'X-Title':       'AI Compliance Copilot',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        this.logger.warn(`OpenRouter embed error ${res.status}: ${err}`);
        return null;
      }

      const data: any = await res.json();
      return {
        embedding: data.data[0].embedding,
        model:     data.model ?? 'openai/text-embedding-3-small',
        tokens:    data.usage?.prompt_tokens ?? 0,
      };
    } catch (err) {
      this.logger.error(`OpenRouter embed failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async batchEmbedViaOpenRouter(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterKey}`,
          'Content-Type':  'application/json',
          'HTTP-Referer':  'https://ai-compliance-copilot.app',
          'X-Title':       'AI Compliance Copilot',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: texts,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`OpenRouter batch embed error ${res.status}`);
        return texts.map(() => null);
      }

      const data: any = await res.json();
      return (data.data as any[]).map((d) => ({
        embedding: d.embedding,
        model:     data.model ?? 'openai/text-embedding-3-small',
        tokens:    Math.ceil((data.usage?.prompt_tokens ?? 0) / texts.length),
      }));
    } catch (err) {
      this.logger.error(`OpenRouter batch embed failed: ${(err as Error).message}`);
      return texts.map(() => null);
    }
  }

  // ─── OpenAI direct path ────────────────────────────────────────────────────

  private async embedViaOpenAI(text: string): Promise<EmbeddingResult | null> {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text,
        }),
      });

      if (!res.ok) {
        this.logger.warn(`OpenAI embed error ${res.status}`);
        return null;
      }

      const data: any = await res.json();
      return {
        embedding: data.data[0].embedding,
        model:     'text-embedding-3-small',
        tokens:    data.usage?.prompt_tokens ?? 0,
      };
    } catch (err) {
      this.logger.error(`OpenAI embed failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async batchEmbedViaOpenAI(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    try {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: texts,
        }),
      });

      if (!res.ok) return texts.map(() => null);
      const data: any = await res.json();
      return (data.data as any[]).map((d) => ({
        embedding: d.embedding,
        model:     'text-embedding-3-small',
        tokens:    Math.ceil((data.usage?.prompt_tokens ?? 0) / texts.length),
      }));
    } catch {
      return texts.map(() => null);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Rough character-level truncation (~4 chars per token for English).
   */
  private truncateToTokens(text: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    return text.length > maxChars ? text.slice(0, maxChars) : text;
  }

  /**
   * Cosine similarity between two vectors (range: -1 to 1; higher = more similar).
   */
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot   += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }
}
