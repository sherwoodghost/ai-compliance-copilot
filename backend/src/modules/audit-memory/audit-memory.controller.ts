import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  AuditMemoryService,
  CreateAuditCycleDto,
  UpdateAuditCycleDto,
  CreateFindingDto,
  UpdateFindingDto,
} from './audit-memory.service';

@ApiTags('audit-memory')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('audit-memory')
export class AuditMemoryController {
  constructor(private readonly service: AuditMemoryService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Audit memory summary stats' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.service.getStats(user.orgId);
  }

  // ─── Cycles ───────────────────────────────────────────────────────────────────

  @Get('cycles')
  listCycles(@CurrentUser() user: JwtPayload) {
    return this.service.listCycles(user.orgId);
  }

  @Get('cycles/:cycleId')
  getCycle(
    @CurrentUser() user: JwtPayload,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return this.service.getCycle(user.orgId, cycleId);
  }

  @Post('cycles')
  createCycle(@CurrentUser() user: JwtPayload, @Body() dto: CreateAuditCycleDto) {
    return this.service.createCycle(user.orgId, dto, user.sub);
  }

  @Patch('cycles/:cycleId')
  updateCycle(
    @CurrentUser() user: JwtPayload,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: UpdateAuditCycleDto,
  ) {
    return this.service.updateCycle(user.orgId, cycleId, dto);
  }

  // ─── Findings ─────────────────────────────────────────────────────────────────

  @Get('findings')
  listFindings(
    @CurrentUser() user: JwtPayload,
    @Query('cycleId') cycleId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listFindings(user.orgId, cycleId, status);
  }

  @Post('findings')
  createFinding(@CurrentUser() user: JwtPayload, @Body() dto: CreateFindingDto) {
    return this.service.createFinding(user.orgId, dto);
  }

  @Patch('findings/:findingId')
  updateFinding(
    @CurrentUser() user: JwtPayload,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.service.updateFinding(user.orgId, findingId, dto, user.sub);
  }
}
