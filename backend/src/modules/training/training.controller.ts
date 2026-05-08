import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TrainingService } from './training.service';

class AssignModuleDto {
  @ApiPropertyOptional() @IsOptional() userId?: string;
  @ApiPropertyOptional() @IsOptional() dueDate?: string;
}

class CompleteAssignmentDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100)
  score?: number;
}

@ApiTags('training')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('training')
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('modules')
  @ApiOperation({ summary: 'List all active training modules' })
  listModules() {
    return this.trainingService.listModules();
  }

  @Get('assignments')
  @ApiOperation({ summary: 'Get training assignments for the org' })
  getAssignments(@CurrentUser() user: JwtPayload, @Query('userId') userId?: string) {
    if (userId) return this.trainingService.getUserAssignments(userId, user.orgId);
    return this.trainingService.getOrgAssignments(user.orgId);
  }

  @Get('assignments/mine')
  @ApiOperation({ summary: 'Get my training assignments' })
  getMyAssignments(@CurrentUser() user: JwtPayload) {
    return this.trainingService.getUserAssignments(user.sub, user.orgId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get org-level training completion stats' })
  getStats(@CurrentUser() user: JwtPayload) {
    return this.trainingService.getStats(user.orgId);
  }

  @Post('modules/:moduleId/assign')
  @ApiOperation({ summary: 'Assign a training module to a user' })
  assignModule(
    @CurrentUser() user: JwtPayload,
    @Param('moduleId') moduleId: string,
    @Body() dto: AssignModuleDto,
  ) {
    return this.trainingService.assignModule(
      user.orgId,
      dto.userId ?? user.sub,
      moduleId,
      user.sub,
      dto.dueDate ? new Date(dto.dueDate) : undefined,
    );
  }

  @Post('assign-all-security-awareness')
  @ApiOperation({ summary: 'Assign security awareness training to all active org users (idempotent)' })
  assignSecurityAwarenessToAll(@CurrentUser() user: JwtPayload) {
    return this.trainingService.assignSecurityAwarenessToAll(user.orgId, user.sub);
  }

  @Post('assignments/:assignmentId/complete')
  @ApiOperation({ summary: 'Mark a training assignment complete — auto-generates ISO A.6.3 evidence' })
  completeAssignment(
    @CurrentUser() user: JwtPayload,
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: CompleteAssignmentDto,
  ) {
    return this.trainingService.completeAssignment(user.orgId, assignmentId, user.sub, dto.score);
  }
}
