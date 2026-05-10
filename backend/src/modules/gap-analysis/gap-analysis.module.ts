import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GapAnalysisService } from './gap-analysis.service';
import { AuditChecklistService } from './audit-checklist.service';
import { GapAnalysisController } from './gap-analysis.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [GapAnalysisController],
  providers: [GapAnalysisService, AuditChecklistService],
  exports: [GapAnalysisService, AuditChecklistService],
})
export class GapAnalysisModule {}
