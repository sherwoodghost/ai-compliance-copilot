import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { AnthropicProvider } from './providers/anthropic.provider';

@Global()
@Module({
  providers: [LlmService, AnthropicProvider],
  exports: [LlmService],
})
export class LlmModule {}
