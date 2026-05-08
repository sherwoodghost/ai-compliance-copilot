import { Module } from '@nestjs/common';
import { AuditMemoryService } from './audit-memory.service';
import { AuditMemoryController } from './audit-memory.controller';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [LlmModule, DatabaseModule],
  providers: [AuditMemoryService],
  controllers: [AuditMemoryController],
  exports: [AuditMemoryService],
})
export class AuditMemoryModule {}
