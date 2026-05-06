import { Controller, Get, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TasksService, UpdateTaskDto } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
