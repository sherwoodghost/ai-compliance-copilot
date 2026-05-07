import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ControlsService } from './controls.service';
import {
  UpdateOrgControlDto,
  BulkAssignControlsDto,
  ControlFiltersDto,
  CreateExceptionDto,
  UpdateExceptionDto,
} from './dto/controls.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('controls')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('controls')
export class ControlsController {
  constructor(private readonly controlsService: ControlsService) {}

  // ─── Control List / Stats ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all controls for the current organization' })
  @ApiQuery({ name: 'frameworkId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  findAll(@CurrentUser() user: JwtPayload, @Query() filters: ControlFiltersDto) {
    return this.controlsService.findAll(user.orgId, filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Compliance stats across all controls' })
  @ApiQuery({ name: 'frameworkId', required: false })
  getStats(@CurrentUser() user: JwtPayload, @Query('frameworkId') frameworkId?: string) {
    return this.controlsService.getStats(user.orgId, frameworkId);
  }

  @Get('heatmap')
  @ApiOperation({ summary: 'Category-level heatmap for a specific framework' })
  getHeatmap(
    @CurrentUser() user: JwtPayload,
    @Query('frameworkId', ParseUUIDPipe) frameworkId: string,
  ) {
    return this.controlsService.getHeatmap(user.orgId, frameworkId);
  }

  // ─── Exception Register (must come before :controlId routes) ─────────────

  @Get('exceptions')
  @ApiOperation({ summary: 'List all control exceptions for the organization' })
  listExceptions(@CurrentUser() user: JwtPayload) {
    return this.controlsService.listExceptions(user.orgId);
  }

  @Get('exceptions/stats')
  @ApiOperation({ summary: 'Exception register stats (total, pending, approved, expired)' })
  getExceptionStats(@CurrentUser() user: JwtPayload) {
    return this.controlsService.getExceptionStats(user.orgId);
  }

  @Post('exceptions')
  @ApiOperation({ summary: 'Request a new control exception' })
  createException(@CurrentUser() user: JwtPayload, @Body() dto: CreateExceptionDto) {
    return this.controlsService.createException(user.orgId, user.sub, dto);
  }

  @Patch('exceptions/:id')
  @ApiOperation({ summary: 'Approve, reject, or update a control exception' })
  updateException(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExceptionDto,
  ) {
    return this.controlsService.updateException(user.orgId, user.sub, id, dto);
  }

  @Delete('exceptions/:id')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Delete a control exception (admin only)' })
  deleteException(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.controlsService.deleteException(user.orgId, id);
  }

  // ─── Single Control (parameterized — MUST be last) ────────────────────────

  @Get(':controlId')
  @ApiOperation({ summary: 'Get full control details with evidence, policies, and tasks' })
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('controlId', ParseUUIDPipe) controlId: string,
  ) {
    return this.controlsService.findOne(user.orgId, controlId);
  }

  @Patch(':controlId')
  @ApiOperation({ summary: 'Update a control status, score, assignment, or notes' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('controlId', ParseUUIDPipe) controlId: string,
    @Body() dto: UpdateOrgControlDto,
  ) {
    return this.controlsService.update(user.orgId, controlId, dto);
  }

  @Post('bulk-assign')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Bulk assign multiple controls to a user (admin only)' })
  bulkAssign(@CurrentUser() user: JwtPayload, @Body() dto: BulkAssignControlsDto) {
    return this.controlsService.bulkAssign(user.orgId, dto);
  }

  @Post('initialize')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Initialize org controls from selected framework IDs (admin only)' })
  initialize(
    @CurrentUser() user: JwtPayload,
    @Body() body: { frameworkIds: string[] },
  ) {
    return this.controlsService.initializeForOrg(user.orgId, body.frameworkIds);
  }
}
