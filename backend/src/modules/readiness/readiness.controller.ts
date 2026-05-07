import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ReadinessService } from '../../readiness/readiness.service';
import { VelocityService } from './velocity.service';
import { BenchmarkService } from './benchmark.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('readiness')
@UseGuards(JwtAuthGuard)
export class ReadinessController {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly velocityService: VelocityService,
    private readonly benchmarkService: BenchmarkService,
  ) {}

  @Get()
  async getCurrent(@Req() req: any) {
    return this.readinessService.getLatest(req.user.orgId);
  }

  @Get('history')
  async getHistory(@Req() req: any, @Query('limit') limit?: string) {
    return this.readinessService.getHistory(req.user.orgId, limit ? parseInt(limit) : 30);
  }

  @Get('breakdown')
  async getBreakdown(@Req() req: any) {
    const latest = await this.readinessService.getLatest(req.user.orgId);
    if (!latest) return { message: 'No readiness score computed yet. Run /readiness/recalculate first.' };
    return {
      overall: latest.overallScore,
      breakdown: {
        controlDesign: latest.controlDesignScore,
        evidence: latest.evidenceScore,
        policy: latest.policyScore,
        operational: latest.operationalScore,
        riskManagement: latest.riskManagementScore,
      },
      framework: latest.framework,
      formulaVersion: latest.formulaVersion,
      scoreInputs: latest.scoreInputs,
      snapshotAt: latest.snapshotAt,
    };
  }

  @Post('recalculate')
  async recalculate(@Req() req: any, @Query('frameworks') frameworks?: string) {
    const frameworkList = frameworks ? frameworks.split(',') : undefined;
    const result = await this.readinessService.calculate(req.user.orgId, frameworkList);
    return {
      success: true,
      overall: result.overall,
      soc2: result.soc2?.overall,
      iso27001: result.iso27001?.overall,
      computedAt: result.computedAt,
    };
  }

  @Get('velocity')
  async getVelocity(@Req() req: any) {
    return this.velocityService.getVelocity(req.user.orgId);
  }

  @Get('benchmark')
  async getBenchmark(@Req() req: any) {
    return this.benchmarkService.getBenchmark(req.user.orgId);
  }
}
