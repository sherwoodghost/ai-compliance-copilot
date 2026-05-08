import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TeamService, InviteMemberDto, UpdateMemberDto } from './team.service';
import { RaciService } from './raci.service';
import { RaciLetter } from '@prisma/client';

@ApiTags('team')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('team')
export class TeamController {
  constructor(
    private readonly teamService: TeamService,
    private readonly raciService: RaciService,
  ) {}

  // ─── Members ────────────────────────────────────────────────────────────────

  @Get('members')
  @ApiOperation({ summary: 'List all team members with compliance stats' })
  getMembers(@CurrentUser() user: JwtPayload) {
    return this.teamService.getMembers(user.orgId);
  }

  @Post('members/invite')
  @RequirePermission('team.invite')
  @ApiOperation({ summary: 'Invite a new team member' })
  inviteMember(@CurrentUser() user: JwtPayload, @Body() dto: InviteMemberDto) {
    return this.teamService.inviteMember(user.orgId, dto, user.sub);
  }

  @Patch('members/:userId')
  @RequirePermission('team.manage')
  @ApiOperation({ summary: 'Update a team member profile/role' })
  updateMember(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamService.updateMember(user.orgId, userId, dto, user.sub);
  }

  @Post('members/:userId/resend-invite')
  @RequirePermission('team.invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invite email to a suspended member' })
  resendInvite(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.teamService.resendInvite(user.orgId, userId, user.sub);
  }

  @Post('members/:userId/offboard')
  @RequirePermission('team.offboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate offboarding for a team member' })
  offboardMember(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() body: { offboardDate: string },
  ) {
    return this.teamService.initiateOffboarding(
      user.orgId,
      userId,
      new Date(body.offboardDate),
      user.sub,
    );
  }

  @Get('audit-log')
  @RequirePermission('team.audit_log.read')
  @ApiOperation({ summary: 'Get team audit log' })
  @ApiQuery({ name: 'limit', required: false })
  getAuditLog(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.teamService.getAuditLog(user.orgId, limit ? parseInt(limit, 10) : 50);
  }

  // ─── RACI ───────────────────────────────────────────────────────────────────

  @Get('raci')
  @ApiOperation({ summary: 'Get RACI matrix for the org' })
  getRaci(@CurrentUser() user: JwtPayload) {
    return this.raciService.getMatrix(user.orgId);
  }

  @Post('raci/assign')
  @RequirePermission('raci.assign')
  @ApiOperation({ summary: 'Assign RACI letter to a user for a control' })
  assignRaci(
    @CurrentUser() user: JwtPayload,
    @Body() body: { controlId: string; userId: string; raci: RaciLetter },
  ) {
    return this.raciService.assign(user.orgId, body.controlId, body.userId, body.raci, user.sub);
  }

  @Post('raci/remove')
  @RequirePermission('raci.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a RACI assignment' })
  removeRaci(
    @CurrentUser() user: JwtPayload,
    @Body() body: { controlId: string; userId: string; raci: RaciLetter },
  ) {
    return this.raciService.remove(user.orgId, body.controlId, body.userId, body.raci, user.sub);
  }

  @Post('raci/auto-fill')
  @RequirePermission('raci.assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auto-fill RACI from team responsibilities' })
  autoFillRaci(@CurrentUser() user: JwtPayload) {
    return this.raciService.bulkFromResponsibilities(user.orgId, user.sub);
  }

  @Get('sod-conflicts')
  @ApiOperation({ summary: 'List SoD conflicts in the RACI matrix' })
  getSodConflicts(@CurrentUser() user: JwtPayload) {
    return this.raciService.getSodConflicts(user.orgId);
  }
}
