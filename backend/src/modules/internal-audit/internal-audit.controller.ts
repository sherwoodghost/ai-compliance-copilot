import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  InternalAuditService,
  CreateAuditDto,
  AddFindingDto,
  CloseAuditDto,
} from './internal-audit.service';

@Controller('internal-audit')
@UseGuards(JwtAuthGuard)
export class InternalAuditController {
  constructor(private readonly auditService: InternalAuditService) {}

  // ─── Audits ───────────────────────────────────────────────────────────────────

  @Get()
  listAudits(@CurrentUser() user: any) {
    return this.auditService.listAudits(user.orgId);
  }

  @Get(':id')
  getAudit(@CurrentUser() user: any, @Param('id') id: string) {
    return this.auditService.getAudit(user.orgId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createAudit(@CurrentUser() user: any, @Body() dto: CreateAuditDto) {
    return this.auditService.createAudit(user.orgId, user.id, dto);
  }

  @Post(':id/start-fieldwork')
  @HttpCode(HttpStatus.OK)
  startFieldwork(@CurrentUser() user: any, @Param('id') id: string) {
    return this.auditService.startFieldwork(user.orgId, id, user.id);
  }

  @Post(':id/start-reporting')
  @HttpCode(HttpStatus.OK)
  startReporting(@CurrentUser() user: any, @Param('id') id: string) {
    return this.auditService.startReporting(user.orgId, id, user.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  closeAudit(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CloseAuditDto) {
    return this.auditService.closeAudit(user.orgId, id, user.id, dto);
  }

  // ─── Findings ─────────────────────────────────────────────────────────────────

  @Post(':id/findings')
  @HttpCode(HttpStatus.CREATED)
  addFinding(@CurrentUser() user: any, @Param('id') auditId: string, @Body() dto: AddFindingDto) {
    return this.auditService.addFinding(user.orgId, auditId, user.id, dto);
  }

  @Post(':id/findings/:findingId/close')
  @HttpCode(HttpStatus.OK)
  closeFinding(
    @CurrentUser() user: any,
    @Param('id') auditId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.auditService.closeFinding(user.orgId, auditId, findingId, user.id);
  }

  @Post(':id/findings/:findingId/accept-risk')
  @HttpCode(HttpStatus.OK)
  acceptRisk(
    @CurrentUser() user: any,
    @Param('id') auditId: string,
    @Param('findingId') findingId: string,
  ) {
    return this.auditService.acceptRiskFinding(user.orgId, auditId, findingId, user.id);
  }
}
