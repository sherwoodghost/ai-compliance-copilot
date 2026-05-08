import { Module } from '@nestjs/common';
import { AuditExportsController } from './audit-exports.controller';
import { AuditExportModule } from '../../audit-exports/audit-export.module';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';
import { ReadinessModule } from '../../readiness/readiness.module';

@Module({
  imports: [AuditExportModule, LlmModule, DatabaseModule, ReadinessModule],
  controllers: [AuditExportsController],
})
export class AuditExportsApiModule {}
