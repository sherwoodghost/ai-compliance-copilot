import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { GdprService } from './gdpr.service';
import {
  CreateProcessingActivityDto, UpdateProcessingActivityDto,
  CreateDsarDto, UpdateDsarDto,
  CreateDpiaDto,
  CreateBreachNotificationDto, UpdateBreachNotificationDto,
} from './dto/gdpr.dto';

@Controller('gdpr')
@UseGuards(JwtAuthGuard)
export class GdprController {
  constructor(private readonly svc: GdprService) {}

  // Dashboard stats
  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.svc.getDashboardStats(user.orgId);
  }

  // ROPA
  @Get('activities')
  listActivities(@CurrentUser() user: JwtPayload) {
    return this.svc.listActivities(user.orgId);
  }

  @Post('activities')
  createActivity(@CurrentUser() user: JwtPayload, @Body() dto: CreateProcessingActivityDto) {
    return this.svc.createActivity(user.orgId, dto);
  }

  @Put('activities/:id')
  updateActivity(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProcessingActivityDto) {
    return this.svc.updateActivity(user.orgId, id, dto);
  }

  @Delete('activities/:id')
  deleteActivity(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.deleteActivity(user.orgId, id);
  }

  // DSAR
  @Get('dsars')
  listDsars(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listDsars(user.orgId, status);
  }

  @Post('dsars')
  createDsar(@CurrentUser() user: JwtPayload, @Body() dto: CreateDsarDto) {
    return this.svc.createDsar(user.orgId, dto);
  }

  @Patch('dsars/:id')
  updateDsar(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateDsarDto) {
    return this.svc.updateDsar(user.orgId, id, dto);
  }

  // DPIA
  @Get('dpias')
  listDpias(@CurrentUser() user: JwtPayload) {
    return this.svc.listDpias(user.orgId);
  }

  @Post('dpias')
  createDpia(@CurrentUser() user: JwtPayload, @Body() dto: CreateDpiaDto) {
    return this.svc.createDpia(user.orgId, dto);
  }

  // Breach notifications
  @Get('breaches')
  listBreaches(@CurrentUser() user: JwtPayload) {
    return this.svc.listBreaches(user.orgId);
  }

  @Post('breaches')
  createBreach(@CurrentUser() user: JwtPayload, @Body() dto: CreateBreachNotificationDto) {
    return this.svc.createBreach(user.orgId, dto);
  }

  @Patch('breaches/:id')
  updateBreach(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateBreachNotificationDto) {
    return this.svc.updateBreach(user.orgId, id, dto);
  }
}
