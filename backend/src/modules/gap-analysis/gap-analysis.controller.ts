import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { GapAnalysisService } from './gap-analysis.service';
import { AuditChecklistService } from './audit-checklist.service';

@Controller('gap-analysis')
@UseGuards(JwtAuthGuard)
export class GapAnalysisController {
  constructor(
    private readonly gapAnalysisService: GapAnalysisService,
    private readonly auditChecklistService: AuditChecklistService,
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
}
