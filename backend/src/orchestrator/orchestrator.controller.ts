import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { WorkflowEngine } from './workflow.engine';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class TriggerAssessmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  frameworkIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;
}

class ReplayDto {
  @ApiPropertyOptional()
  @IsString()
  agentName: string;

  @ApiPropertyOptional()
  @IsOptional()
  customInput?: Record<string, unknown>;
}

@ApiTags('orchestrator')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly workflowEngine: WorkflowEngine) {}

  @Post('assess')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Trigger a full compliance assessment workflow (admin only)' })
  async triggerAssessment(@CurrentUser() user: JwtPayload, @Body() dto: TriggerAssessmentDto) {
    return this.workflowEngine.triggerFullAssessment({
      orgId: user.orgId,
      triggeredBy: user.sub,
      frameworkIds: dto.frameworkIds,
      name: dto.name,
    });
  }

  @Post('workflows/:workflowId/replay')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Replay a workflow from a specific agent' })
  async replay(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Body() dto: ReplayDto,
  ) {
    await this.workflowEngine.replayFromAgent(workflowId, dto.agentName, dto.customInput);
    return { message: `Replay triggered from agent: ${dto.agentName}` };
  }
}
