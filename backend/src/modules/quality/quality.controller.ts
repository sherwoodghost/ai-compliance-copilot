import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { QualityService } from './quality.service';
import {
  CreateNonconformityDto, UpdateNonconformityDto,
  CreateQualityObjectiveDto, RecordMeasurementDto,
  CreateProcessAuditDto, UpdateProcessAuditDto,
} from './dto/quality.dto';

@Controller('quality')
@UseGuards(JwtAuthGuard)
export class QualityController {
  constructor(private readonly svc: QualityService) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.svc.getDashboardStats(user.orgId);
  }

  // NCRs
  @Get('ncrs')
  listNcrs(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listNcrs(user.orgId, status);
  }

  @Post('ncrs')
  createNcr(@CurrentUser() user: JwtPayload, @Body() dto: CreateNonconformityDto) {
    return this.svc.createNcr(user.orgId, dto);
  }

  @Patch('ncrs/:id')
  updateNcr(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateNonconformityDto) {
    return this.svc.updateNcr(user.orgId, id, dto);
  }

  // Quality Objectives
  @Get('objectives')
  listObjectives(@CurrentUser() user: JwtPayload) {
    return this.svc.listObjectives(user.orgId);
  }

  @Post('objectives')
  createObjective(@CurrentUser() user: JwtPayload, @Body() dto: CreateQualityObjectiveDto) {
    return this.svc.createObjective(user.orgId, dto);
  }

  @Post('objectives/:id/measurements')
  recordMeasurement(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RecordMeasurementDto) {
    return this.svc.recordMeasurement(user.orgId, id, dto);
  }

  // Process Audits
  @Get('audits')
  listAudits(@CurrentUser() user: JwtPayload) {
    return this.svc.listAudits(user.orgId);
  }

  @Post('audits')
  createAudit(@CurrentUser() user: JwtPayload, @Body() dto: CreateProcessAuditDto) {
    return this.svc.createAudit(user.orgId, dto);
  }

  @Patch('audits/:id')
  updateAudit(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProcessAuditDto) {
    return this.svc.updateAudit(user.orgId, id, dto);
  }
}
