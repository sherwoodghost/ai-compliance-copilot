import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IncidentService, CreateIncidentDto, UpdateIncidentDto, CloseIncidentDto, CreateCorrectiveActionDto } from './incident.service';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  // ─── List / Get ───────────────────────────────────────────────────────────────

  @Get()
  listIncidents(
    @CurrentUser() user: any,
    @Query('status')   status?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
  ) {
    return this.incidentService.listIncidents(user.orgId, { status, severity, category });
  }

  @Get('metrics')
  getMetrics(@CurrentUser() user: any) {
    return this.incidentService.getMetrics(user.orgId);
  }

  @Get(':id')
  getIncident(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentService.getIncident(user.orgId, id);
  }

  // ─── Create ───────────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createIncident(@CurrentUser() user: any, @Body() dto: CreateIncidentDto) {
    return this.incidentService.createIncident(user.orgId, user.sub, dto);
  }

  // ─── Update ───────────────────────────────────────────────────────────────────

  @Patch(':id')
  updateIncident(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidentService.updateIncident(user.orgId, id, user.sub, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { status: string; note?: string },
  ) {
    return this.incidentService.updateStatus(user.orgId, id, user.sub, body.status, body.note);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  closeIncident(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CloseIncidentDto,
  ) {
    return this.incidentService.closeIncident(user.orgId, id, user.sub, dto);
  }

  // ─── Corrective Actions ───────────────────────────────────────────────────────

  @Post(':id/corrective-actions')
  @HttpCode(HttpStatus.CREATED)
  addCorrectiveAction(
    @CurrentUser() user: any,
    @Param('id') incidentId: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.incidentService.addCorrectiveAction(user.orgId, incidentId, user.sub, dto);
  }

  @Post(':id/corrective-actions/:actionId/close')
  @HttpCode(HttpStatus.OK)
  closeCorrectiveAction(
    @CurrentUser() user: any,
    @Param('id') incidentId: string,
    @Param('actionId') actionId: string,
  ) {
    return this.incidentService.closeCorrectiveAction(user.orgId, incidentId, actionId, user.sub);
  }
}
