import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLMProvider, LLMMessage, LLMOptions, LLMResponse, calculateCost } from '../llm.interface';

// OpenRouter model name → cost mapping (per 1M tokens, USD)
const OPENROUTER_MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'anthropic/claude-3.5-sonnet':   { input: 3.0,  output: 15.0 },
  'anthropic/claude-3.5-haiku':    { input: 0.80, output: 4.0  },
  'anthropic/claude-3-haiku':      { input: 0.25, output: 1.25 },
  'anthropic/claude-3-opus':       { input: 15.0, output: 75.0 },
  'openai/gpt-4o':                 { input: 2.5,  output: 10.0 },
  'openai/gpt-4o-mini':            { input: 0.15, output: 0.60 },
  'google/gemini-pro-1.5':         { input: 1.25, output: 5.0  },
  'meta-llama/llama-3.1-70b-instruct': { input: 0.52, output: 0.75 },
};

// Translate Anthropic SDK model IDs → OpenRouter namespaced IDs.
// The LLM service routes agents with Anthropic-style names (claude-sonnet-4-6,
// claude-haiku-4-5-20251001, …).  When OpenRouter is the active provider we
// must convert them before sending to the API.
const ANTHROPIC_TO_OPENROUTER: Record<string, string> = {
  // Sonnet variants
  'claude-sonnet-4-6':              'anthropic/claude-3.5-sonnet',
  'claude-sonnet-4-5':              'anthropic/claude-3.5-sonnet',
  'claude-3-5-sonnet-20241022':     'anthropic/claude-3.5-sonnet',
  'claude-3-5-sonnet-20240620':     'anthropic/claude-3.5-sonnet',
  // Haiku variants
  'claude-haiku-4-5-20251001':      'anthropic/claude-3.5-haiku',
  'claude-haiku-4-5':               'anthropic/claude-3.5-haiku',
  'claude-3-5-haiku-20241022':      'anthropic/claude-3.5-haiku',
  'claude-3-haiku-20240307':        'anthropic/claude-3-haiku',
  // Opus variants
  'claude-opus-4':                  'anthropic/claude-3-opus',
  'claude-opus-4-5':                'anthropic/claude-3-opus',
  'claude-3-opus-20240229':         'anthropic/claude-3-opus',
};

function toOpenRouterModel(model: string): string {
  // Already in provider/model format — pass through unchanged
  if (model.includes('/')) return model;
  return ANTHROPIC_TO_OPENROUTER[model] ?? 'anthropic/claude-3.5-sonnet';
}

@Injectable()
export class OpenRouterProvider implements LLMProvider {
  readonly providerName = 'openrouter';
  private readonly apiKey: string;
  private readonly baseUrl = 'https://openrouter.ai/api/v1';
  private readonly logger = new Logger(OpenRouterProvider.name);
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('llm.openrouterApiKey') ?? '';
    this.defaultModel = this.configService.get<string>('llm.openrouterDefaultModel') ?? 'anthropic/claude-3.5-sonnet';
  }

  async complete(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const apiKey = options.orgApiKey ?? this.apiKey;
    if (!apiKey) {
      throw new InternalServerErrorException('OpenRouter API key not configured');
    }

    // Normalize model ID: agents use Anthropic-style names; OpenRouter needs "anthropic/..."
    const model = toOpenRouterModel(options.model ?? this.defaultModel);
    const maxTokens = options.maxTokens ?? 4096;

    // Build messages in OpenAI format (OpenRouter is OpenAI-compatible)
    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Inject system prompt if provided as option and not already in messages
    if (options.systemPrompt && !messages.some((m) => m.role === 'system')) {
      formattedMessages.unshift({ role: 'system', content: options.systemPrompt });
    }

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-compliance-copilot.app',
          'X-Title': 'AI Compliance Copilot',
        },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          max_tokens: maxTokens,
          ...(options.temperature !== undefined && { temperature: options.temperature }),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const tokensIn = data.usage?.prompt_tokens ?? 0;
      const tokensOut = data.usage?.completion_tokens ?? 0;

      // Calculate cost using our table, fallback to generic pricing
      const costs = OPENROUTER_MODEL_COSTS[model] ?? { input: 3.0, output: 15.0 };
      const costUsd = (tokensIn * costs.input + tokensOut * costs.output) / 1_000_000;

      return { content, tokensIn, tokensOut, model, costUsd };
    } catch (error: any) {
      this.logger.error(`OpenRouter API error: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`LLM call failed (OpenRouter): ${error.message}`);
    }
  }
}
