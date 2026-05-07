import { Module } from '@nestjs/common';
import { AuditMemoryService } from './audit-memory.service';
import { AuditMemoryController } from './audit-memory.controller';

@Module({
  providers: [AuditMemoryService],
  controllers: [AuditMemoryController],
  exports: [AuditMemoryService],
})
export class AuditMemoryModule {}
