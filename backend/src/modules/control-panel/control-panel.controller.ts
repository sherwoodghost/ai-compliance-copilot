import { Controller, Get, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ControlPanelService } from './control-panel.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('control-panel')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('control-panel')
export class ControlPanelController {
  constructor(private readonly controlPanelService: ControlPanelService) {}

  @Get('workflows')
  @ApiOperation({ summary: 'List all workflows for the control panel list view' })
  listWorkflows(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.controlPanelService.listWorkflows(user.orgId, limit ? parseInt(limit) : 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'System-wide stats: cost, tokens, run counts' })
  getSystemStats(@CurrentUser() user: JwtPayload) {
    return this.controlPanelService.getSystemStats(user.orgId);
  }

  @Get('workflows/:workflowId/canvas')
  @ApiOperation({ summary: 'Get full workflow canvas data (nodes + edges + run details)' })
  getCanvas(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    return this.controlPanelService.getWorkflowCanvas(user.orgId, workflowId);
  }

  @Get('runs/:runId/steps/:stepId')
  @ApiOperation({ summary: 'Get a specific step with input/output for replay' })
  getStepDetail(
    @CurrentUser() user: JwtPayload,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.controlPanelService.getStepDetail(user.orgId, runId, stepId);
  }

  @Get('workflows/:workflowId/events')
  @ApiOperation({ summary: 'Get agent event log for a workflow (full trace)' })
  getEventLog(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    return this.controlPanelService.getAgentEventLog(user.orgId, workflowId);
  }

  @Patch('runs/:runId/steps/:stepId/input')
  @ApiOperation({ summary: 'Update a step input payload (for replay with custom input)' })
  updateStepInput(
    @CurrentUser() user: JwtPayload,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() body: { input: Record<string, unknown> },
  ) {
    return this.controlPanelService.updateStepInput(user.orgId, runId, stepId, body.input);
  }
}
