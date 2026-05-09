import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [RisksController],
})
export class RisksModule {}
