import {
  Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ControlTestRunnerService } from '../../control-tests/control-test-runner.service';
import { ControlTestRegistry } from '../../control-tests/control-test.registry';
import { MonitoringService } from '../../monitoring/monitoring.service';

@ApiTags('control-tests')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('control-tests')
export class ControlTestsApiController {
  private readonly logger = new Logger(ControlTestsApiController.name);

  constructor(
    private readonly runner:     ControlTestRunnerService,
    private readonly registry:   ControlTestRegistry,
    private readonly monitoring: MonitoringService,
  ) {}

  /** Latest result for each test registered for this org. */
  @Get('results')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'Get latest control test results for the org' })
  async getResults(@CurrentUser() user: JwtPayload) {
    return this.runner.getLatestResults(user.orgId);
  }

  /** Pass/fail/skip summary with overall pass rate. */
  @Get('summary')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'Get control test pass rate summary' })
  async getSummary(@CurrentUser() user: JwtPayload) {
    return this.runner.getPassRateSummary(user.orgId);
  }

  /** List all registered test definitions (static metadata). */
  @Get('definitions')
  @Roles('admin', 'auditor', 'member')
  @ApiOperation({ summary: 'List all registered control test definitions' })
  async getDefinitions() {
    return this.registry.getAll().map((t) => t.meta);
  }

  /** Trigger all tests for the org immediately (queues a BullMQ job). */
  @Post('run')
  @Roles('admin', 'auditor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger all control tests for the org (async)' })
  async runAll(@CurrentUser() user: JwtPayload) {
    const result = await this.monitoring.triggerImmediateRun(user.orgId);
    this.logger.log(`Manual test run triggered for org ${user.orgId}: ${result.queued} queued`);
    return { message: `${result.queued} tests queued`, ...result };
  }

  /** Trigger a single test for the org immediately. */
  @Post('run/:testId')
  @Roles('admin', 'auditor')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger a single control test for the org (async)' })
  async runOne(@Param('testId') testId: string, @CurrentUser() user: JwtPayload) {
    await this.runner.runTest(testId, user.orgId);
    return { message: `Test ${testId} executed`, testId, orgId: user.orgId };
  }
}
