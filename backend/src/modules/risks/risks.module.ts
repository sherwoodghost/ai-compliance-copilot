import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [LlmModule],
  controllers: [RisksController],
})
export class RisksModule {}
