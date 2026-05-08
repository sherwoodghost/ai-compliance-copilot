import { Module } from '@nestjs/common';
import { ScopingController } from './scoping.controller';
import { ScopingModule } from '../../scoping/scoping.module';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [ScopingModule, LlmModule, DatabaseModule],
  controllers: [ScopingController],
})
export class ScopingApiModule {}
