import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TasksService, UpdateTaskDto } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class CreateTaskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assignedTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
}

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Manually create a task' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasksService.createManual(user.orgId, dto);
  }

  @Post('generate-from-gaps')
  @ApiOperation({ summary: 'AI: generate prioritized remediation tasks for all not-started controls' })
  generateFromGaps(@CurrentUser() user: JwtPayload) {
    return this.tasksService.generateFromGaps(user.orgId);
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: TaskPriority,
  ) {
    return this.tasksService.findAll(user.orgId, status, assignedTo, priority);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get tasks assigned to the current user' })
  getMyTasks(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getMyTasks(user.sub, user.orgId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: JwtPayload) {
    return this.tasksService.getStats(user.orgId);
  }

  @Get(':taskId')
  findOne(@CurrentUser() user: JwtPayload, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasksService.findOne(user.orgId, taskId);
  }

  @Patch(':taskId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(user.orgId, taskId, dto);
  }
}
