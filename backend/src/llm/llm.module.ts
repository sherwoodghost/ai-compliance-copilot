import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { AnthropicProvider } from './providers/anthropic.provider';
import { OpenRouterProvider } from './providers/openrouter.provider';

@Global()
@Module({
  providers: [LlmService, AnthropicProvider, OpenRouterProvider],
  exports: [LlmService, AnthropicProvider],
})
export class LlmModule {}
