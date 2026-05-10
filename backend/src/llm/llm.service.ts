import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnthropicProvider } from './providers/anthropic.provider';
import { LLMMessage, LLMOptions, LLMResponse, LLMProvider } from './llm.interface';

// Agents that need deep reasoning use Claude; data extraction tasks can use cheaper models
const AGENT_MODEL_ROUTING: Record<string, string> = {
  review:              'claude-sonnet-4-6',
  onboarding:          'claude-sonnet-4-6',
  policy:              'claude-sonnet-4-6',
  'threat-intel':      'claude-sonnet-4-6',
  'gap-analysis':      'claude-sonnet-4-6',
  validator:           'claude-sonnet-4-6',
  'remediation-advisor': 'claude-sonnet-4-6',
  planner:             'claude-sonnet-4-6',
  evidence:            'claude-haiku-4-5-20251001',
  benchmark:           'claude-haiku-4-5-20251001',
  'vendor-risk':       'claude-haiku-4-5-20251001',
  task:                'claude-haiku-4-5-20251001',
  audit:               'claude-sonnet-4-6',
  'risk-scoring':      'claude-haiku-4-5-20251001',
  'drift-detector':    'claude-haiku-4-5-20251001',
  interview:           'claude-sonnet-4-6',

  // Framework expert agents — Sonnet for deep framework knowledge
  'framework-expert-iso27001': 'claude-sonnet-4-6',
  'framework-expert-soc2':     'claude-sonnet-4-6',
  'framework-expert-iso9001':  'claude-sonnet-4-6',
  'framework-expert-gdpr':     'claude-sonnet-4-6',
  'framework-expert-hipaa':    'claude-sonnet-4-6',
  'framework-expert-pci-dss':  'claude-sonnet-4-6',
  'framework-expert-nist-csf': 'claude-haiku-4-5-20251001',
  'framework-expert-fedramp':  'claude-sonnet-4-6',
};

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly provider: LLMProvider;

  constructor(
    private readonly configService: ConfigService,
    private readonly anthropicProvider: AnthropicProvider,
  ) {
    this.provider = this.anthropicProvider;
  }

  async complete(
    messages: LLMMessage[],
    options: LLMOptions & { agentName?: string } = {},
  ): Promise<LLMResponse> {
    const { agentName, ...llmOptions } = options;

    if (agentName && !llmOptions.model) {
      llmOptions.model = AGENT_MODEL_ROUTING[agentName] ?? 'claude-sonnet-4-6';
    }

    this.logger.debug(
      `LLM call | agent: ${agentName ?? 'unknown'} | model: ${llmOptions.model}`,
    );

    return this.provider.complete(messages, llmOptions);
  }

  async completeWithRetry(
    messages: LLMMessage[],
    options: LLMOptions & { agentName?: string } = {},
    maxRetries = 3,
  ): Promise<LLMResponse> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.complete(messages, options);
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`LLM attempt ${attempt}/${maxRetries} failed: ${error.message}`);
        if (attempt < maxRetries) await this.sleep(1000 * attempt);
      }
    }

    throw lastError;
  }

  parseJSON<T>(content: string): T {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      // Try to find the first valid JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (objectMatch) return JSON.parse(objectMatch[0]) as T;
      throw new Error(`Failed to parse LLM JSON response: ${content.slice(0, 200)}`);
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
