import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
  Headers, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuditorPortalService, CreateAuditorSessionDto, CreateRfiDto, RespondRfiDto,
} from './auditor-portal.service';

@ApiTags('auditor-portal')
@Controller('auditor-portal')
export class AuditorPortalController {
  constructor(private readonly svc: AuditorPortalService) {}

  // ─── Org admin endpoints (JWT-protected) ────────────────────────────────────

  @Post('sessions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create an auditor access token' })
  createSession(@CurrentUser() user: JwtPayload, @Body() dto: CreateAuditorSessionDto) {
    return this.svc.createSession(user.orgId, user.sub, dto);
  }

  @Get('sessions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all auditor sessions for the org' })
  listSessions(@CurrentUser() user: JwtPayload) {
    return this.svc.listSessions(user.orgId);
  }

  @Patch('sessions/:id/revoke')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  revokeSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.revokeSession(user.orgId, id);
  }

  @Get('rfis')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all RFIs from auditors' })
  listRfis(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.listRfis(user.orgId, status);
  }

  @Post('rfis/:id/respond')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Respond to an auditor RFI' })
  respondRfi(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RespondRfiDto,
  ) {
    return this.svc.respondRfi(user.orgId, user.sub, id, dto);
  }

  // ─── Token-gated portal endpoints (public, token in header) ─────────────────

  @Get('portal')
  @Public()
  @ApiOperation({ summary: 'Get all portal data for the auditor (token-gated)' })
  @ApiHeader({ name: 'x-auditor-token', description: 'Auditor access token' })
  getPortalData(@Headers('x-auditor-token') token: string) {
    return this.svc.getPortalData(token);
  }

  @Post('portal/rfi')
  @Public()
  @ApiOperation({ summary: 'Create an RFI from the auditor portal' })
  @ApiHeader({ name: 'x-auditor-token', description: 'Auditor access token' })
  createRfi(@Headers('x-auditor-token') token: string, @Body() dto: CreateRfiDto) {
    return this.svc.createRfi(token, dto);
  }
}
