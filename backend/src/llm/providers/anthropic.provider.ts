import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMMessage, LLMOptions, LLMResponse, calculateCost } from '../llm.interface';

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
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    const systemPrompt = options.systemPrompt ??
      messages.find((m) => m.role === 'system')?.content;

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
}
