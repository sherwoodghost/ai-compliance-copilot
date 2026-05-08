import {
  Controller, Get, Post, Param, Body, Query,
  ParseUUIDPipe, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ControlEffectivenessService } from './control-effectiveness.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('control-effectiveness')
@UseGuards(JwtAuthGuard)
export class ControlEffectivenessController {
  constructor(private readonly service: ControlEffectivenessService) {}

  /** Summary: latest result + 90-day pass rate per control */
  @Get('summary')
  getSummary(@CurrentUser() user: any) {
    return this.service.getSummary(user.orgId);
  }

  /** Full sample history (optionally filtered by controlId) */
  @Get('samples')
  getSamples(
    @CurrentUser() user: any,
    @Query('controlId') controlId?: string,
  ) {
    return this.service.getSamples(user.orgId, controlId);
  }

  /** Manually sample a single control */
  @Post('sample/:controlId')
  @HttpCode(HttpStatus.CREATED)
  sampleControl(
    @CurrentUser() user: any,
    @Param('controlId', ParseUUIDPipe) controlId: string,
    @Body() body: { notes?: string },
  ) {
    return this.service.sampleControl(user.orgId, controlId, user.sub, body.notes);
  }

  /** Run batch sample for all integration-testable controls + generate Evidence */
  @Post('batch-sample')
  @HttpCode(HttpStatus.CREATED)
  batchSample(@CurrentUser() user: any) {
    return this.service.runBatchSample(user.orgId, user.sub);
  }
}
