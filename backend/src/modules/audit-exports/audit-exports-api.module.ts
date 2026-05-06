import { Module } from '@nestjs/common';
import { AuditExportsController } from './audit-exports.controller';
import { AuditExportModule } from '../../audit-exports/audit-export.module';

@Module({
  imports: [AuditExportModule],
  controllers: [AuditExportsController],
})
export class AuditExportsApiModule {}
