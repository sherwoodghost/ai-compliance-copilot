import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GapAnalysisService } from './gap-analysis.service';
import { AuditChecklistService } from './audit-checklist.service';
import { ActionPlanService } from './action-plan.service';
import { ComplianceTimelineService } from './compliance-timeline.service';
import { GapAnalysisController } from './gap-analysis.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [GapAnalysisController],
  providers: [GapAnalysisService, AuditChecklistService, ActionPlanService, ComplianceTimelineService],
  exports: [GapAnalysisService, AuditChecklistService, ActionPlanService, ComplianceTimelineService],
})
export class GapAnalysisModule {}
