export type LLMContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | LLMContentBlock[];
}

export interface LLMOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  orgApiKey?: string;
}

export interface LLMResponse {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  costUsd: number;
}

export interface LLMProvider {
  complete(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  readonly providerName: string;
}

// Token cost per 1M tokens (input / output) in USD
export const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':            { input: 3.0,   output: 15.0  },
  'claude-opus-4-7':              { input: 15.0,  output: 75.0  },
  'claude-haiku-4-5-20251001':    { input: 0.25,  output: 1.25  },
  'gpt-4o':                       { input: 2.5,   output: 10.0  },
  'gpt-4o-mini':                  { input: 0.15,  output: 0.60  },
};

export function calculateCost(model: string, tokensIn: number, tokensOut: number): number {
  const costs = MODEL_COSTS[model] ?? { input: 3.0, output: 15.0 };
  return (tokensIn * costs.input + tokensOut * costs.output) / 1_000_000;
}
