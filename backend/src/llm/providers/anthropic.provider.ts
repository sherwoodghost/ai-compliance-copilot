import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMOptions, LLMResponse, calculateCost } from '../llm.interface';

export interface EmbeddingResult {
  embedding:   number[];
  inputTokens: number;
  model:       string;
}

@Injectable()
export class AnthropicProvider implements LLMProvider {
  readonly providerName = 'anthropic';
  private readonly client: Anthropic;
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('llm.anthropicApiKey'),
    });
    this.defaultModel = this.configService.get<string>('llm.defaultModel') ?? 'claude-sonnet-4-6';
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const model = options.model ?? this.defaultModel;
    const maxTokens = options.maxTokens ?? 4096;

    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as any }));

    const systemContent = options.systemPrompt ??
      messages.find((m) => m.role === 'system')?.content;
    // system field only accepts string (not image blocks)
    const systemPrompt = typeof systemContent === 'string' ? systemContent : undefined;

    try {
      const response = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        ...(options.temperature !== undefined && { temperature: options.temperature }),
        ...(systemPrompt && { system: systemPrompt }),
        messages: anthropicMessages,
      });

      const content = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('');

      const tokensIn = response.usage.input_tokens;
      const tokensOut = response.usage.output_tokens;

      return {
        content,
        tokensIn,
        tokensOut,
        model,
        costUsd: calculateCost(model, tokensIn, tokensOut),
      };
    } catch (error: any) {
      this.logger.error(`Anthropic API error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`LLM call failed: ${error.message}`);
    }
  }

  /**
   * Generate an embedding for a chunk of text via Anthropic/Voyage API.
   * Falls back to a deterministic mock vector when the API call fails.
   * Called by EmbeddingsService — centralises the Anthropic SDK instance here.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    const truncated = text.slice(0, 8192);
    try {
      const response = await (this.client as any).post('/v1/embeddings', {
        model:       'voyage-3',
        input:       truncated,
        input_type:  'document',
      });
      return {
        embedding:   response.data?.[0]?.embedding ?? this.mockEmbedding(truncated),
        inputTokens: response.usage?.total_tokens ?? 0,
        model:       'voyage-3',
      };
    } catch (error: any) {
      this.logger.warn(`Embedding API call failed (${error.message}), using mock vector`);
      return { embedding: this.mockEmbedding(truncated), inputTokens: 0, model: 'mock' };
    }
  }

  /** Deterministic hash-based mock vector — same input → same vector. */
  private mockEmbedding(text: string, dims = 1536): number[] {
    const v = new Array(dims).fill(0);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      v[(i * 31 + c) % dims] = (v[(i * 31 + c) % dims] + c / 255) / 2;
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
    return v.map((x) => x / norm);
  }
}
