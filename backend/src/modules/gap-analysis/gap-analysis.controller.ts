import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { GapAnalysisService } from './gap-analysis.service';
import { AuditChecklistService } from './audit-checklist.service';
import { ActionPlanService } from './action-plan.service';
import { ComplianceTimelineService } from './compliance-timeline.service';

@Controller('gap-analysis')
@UseGuards(JwtAuthGuard)
export class GapAnalysisController {
  constructor(
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly auditChecklistService: AuditChecklistService,
    private readonly actionPlanService: ActionPlanService,
    private readonly complianceTimelineService: ComplianceTimelineService,
  ) {}

  /** Full gap analysis with per-control breakdown */
  @Get()
  async analyze(
    @CurrentUser() user: JwtPayload,
    @Query('frameworkId') frameworkId?: string,
  ) {
    return this.gapAnalysisService.analyze(user.orgId, frameworkId);
  }

  /** Coverage matrix: framework x category breakdown */
  @Get('coverage')
  async getCoverageMatrix(@CurrentUser() user: JwtPayload) {
    return this.gapAnalysisService.getCoverageMatrix(user.orgId);
  }

  /** Framework crosswalk: control mappings across frameworks */
  @Get('crosswalk')
  async getFrameworkCrosswalk(@CurrentUser() user: JwtPayload) {
    return this.gapAnalysisService.getFrameworkCrosswalk(user.orgId);
  }

  /** Pre-audit readiness checklist */
  @Get('checklist')
  async getAuditChecklist(
    @CurrentUser() user: JwtPayload,
    @Query('framework') framework?: string,
  ) {
    return this.auditChecklistService.generateChecklist(user.orgId, framework);
  }

  /** Smart prioritized action plan */
  @Get('action-plan')
  async getActionPlan(
    @CurrentUser() user: JwtPayload,
    @Query('frameworkId') frameworkId?: string,
  ) {
    return this.actionPlanService.generateActionPlan(user.orgId, frameworkId);
  }

  /** Compliance timeline with milestones and velocity tracking */
  @Get('timeline')
  async getTimeline(@CurrentUser() user: JwtPayload) {
    return this.complianceTimelineService.getTimeline(user.orgId);
  }
}
