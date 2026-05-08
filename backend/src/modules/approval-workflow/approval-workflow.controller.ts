import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalWorkflowService, WorkflowStep, StartWorkflowOptions } from './approval-workflow.service';

interface AuthRequest { user: { userId: string; orgId: string } }

@ApiTags('approval-workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approval-workflows')
export class ApprovalWorkflowController {
  constructor(private readonly svc: ApprovalWorkflowService) {}

  // ── Definitions ─────────────────────────────────────────────────────────────

  @Get('definitions')
  @ApiOperation({ summary: 'List workflow definitions for the org' })
  @ApiQuery({ name: 'entityType', required: false })
  listDefinitions(@Req() req: AuthRequest, @Query('entityType') entityType?: string) {
    return this.svc.listDefinitions(req.user.orgId, entityType);
  }

  @Post('definitions')
  @ApiOperation({ summary: 'Create a new workflow definition' })
  createDefinition(
    @Req() req: AuthRequest,
    @Body() body: {
      entityType: string;
      name:       string;
      steps:      WorkflowStep[];
      isDefault?: boolean;
    },
  ) {
    return this.svc.createDefinition(
      req.user.orgId,
      body.entityType,
      body.name,
      body.steps,
      body.isDefault ?? false,
    );
  }

  // ── Instances ───────────────────────────────────────────────────────────────

  @Post('start')
  @ApiOperation({ summary: 'Start a workflow instance for an entity' })
  startWorkflow(
    @Req() req: AuthRequest,
    @Body() body: {
      entityType:   string;
      entityId:     string;
      definitionId?: string;
      defaultSteps?: WorkflowStep[];
    },
  ) {
    return this.svc.startWorkflow(
      req.user.orgId,
      body.entityType,
      body.entityId,
      req.user.userId,
      { definitionId: body.definitionId, defaultSteps: body.defaultSteps } as StartWorkflowOptions,
    );
  }

  @Post('instances/:instanceId/advance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advance (approve/reject/review) the current step' })
  advanceStep(
    @Req() req: AuthRequest,
    @Param('instanceId') instanceId: string,
    @Body() body: { action: 'approved' | 'rejected' | 'reviewed' | 'signed'; note?: string },
  ) {
    return this.svc.advanceStep(
      req.user.orgId,
      instanceId,
      req.user.userId,
      body.action,
      body.note,
    );
  }

  @Post('instances/:instanceId/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an active workflow instance' })
  cancelWorkflow(
    @Req() req: AuthRequest,
    @Param('instanceId') instanceId: string,
    @Body() body: { reason?: string },
  ) {
    return this.svc.cancelWorkflow(
      req.user.orgId,
      instanceId,
      req.user.userId,
      body.reason,
    );
  }

  @Get('history')
  @ApiOperation({ summary: 'Get workflow history for an entity' })
  @ApiQuery({ name: 'entityType', required: true })
  @ApiQuery({ name: 'entityId',   required: true })
  getHistory(
    @Req() req: AuthRequest,
    @Query('entityType') entityType: string,
    @Query('entityId')   entityId:   string,
  ) {
    return this.svc.getHistory(req.user.orgId, entityType, entityId);
  }
}
