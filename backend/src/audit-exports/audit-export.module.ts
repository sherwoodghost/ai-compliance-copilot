import { Module } from '@nestjs/common';
import { AuditExportService } from './audit-export.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AuditExportService],
  exports: [AuditExportService],
})
export class AuditExportModule {}
