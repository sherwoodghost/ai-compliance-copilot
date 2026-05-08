import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { TasksService, UpdateTaskDto } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';

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
  constructor(
    private readonly tasksService: TasksService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Post('ai-sprint-planner')
  @ApiOperation({ summary: 'AI: identify the top 7 tasks to focus on this week based on compliance impact and urgency' })
  async aiSprintPlanner(@CurrentUser() user: JwtPayload) {
    const orgId = user.orgId;

    const [openTasks, profile, readiness] = await Promise.all([
      this.prisma.task.findMany({
        where: { orgId, status: { in: ['open', 'in_progress'] } },
        include: {
          control: { select: { code: true, title: true, category: true } },
          assignee: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 40,
      }),
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.readinessScore.findFirst({ where: { orgId }, orderBy: { calculatedAt: 'desc' } }),
    ]);

    if (openTasks.length === 0) {
      return { message: 'No open tasks — well done!', sprintItems: [], weekOf: new Date().toISOString() };
    }

    const pd = (profile as any) ?? {};
    const readinessScore = (readiness as any)?.overallScore ?? 0;
    const today = new Date().toISOString().split('T')[0];

    const taskList = openTasks.slice(0, 30).map((t, i) => {
      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
      const daysUntilDue = t.dueDate
        ? Math.round((new Date(t.dueDate).getTime() - Date.now()) / 86400_000)
        : null;
      return `${i + 1}. [${t.priority?.toUpperCase() ?? 'MEDIUM'}] "${t.title}"` +
        `${t.control ? ` | Control: ${t.control.code} (${t.control.category})` : ''}` +
        `${t.assignee ? ` | Assignee: ${t.assignee.fullName}` : ' | UNASSIGNED'}` +
        `${isOverdue ? ' | ⚠ OVERDUE' : daysUntilDue !== null ? ` | Due in ${daysUntilDue}d` : ''}` +
        `${t.status === 'in_progress' ? ' | IN PROGRESS' : ''}`;
    }).join('\n');

    const systemPrompt = `You are a compliance program manager helping a team sprint toward audit readiness. Select and order the most impactful tasks for this week. Prioritize: overdue items, critical control blockers, unblocked quick wins, high-priority gaps.`;

    const userPrompt = `Current readiness score: ${readinessScore}%
Industry: ${pd.industry ?? 'technology'}
Today: ${today}

OPEN TASKS:
${taskList}

Select the 7 most important tasks to focus on this week. Consider: overdue status, control category criticality, quick wins, and compliance impact.

Return ONLY a JSON object (no markdown):
{
  "weekFocus": "1 sentence describing this week's compliance sprint theme",
  "sprintItems": [
    {
      "taskIndex": 1,
      "urgencyLevel": "overdue|critical|high|medium",
      "reason": "1 sentence why this task is a priority this week",
      "estimatedHours": 2
    }
  ]
}

taskIndex is the number (1-N) from the task list above.`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.2 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const sprintIndices: number[] = (Array.isArray(result.sprintItems) ? result.sprintItems : [])
      .slice(0, 7)
      .map((s: any) => Number(s.taskIndex) - 1)
      .filter((i: number) => i >= 0 && i < openTasks.length);

    const validUrgency = ['overdue', 'critical', 'high', 'medium'];

    const sprintItems = sprintIndices.map((idx, rank) => {
      const t = openTasks[idx];
      const aiItem = (result.sprintItems ?? [])[rank] ?? {};
      return {
        rank:        rank + 1,
        taskId:      t.id,
        title:       t.title,
        priority:    t.priority,
        status:      t.status,
        controlCode: (t as any).control?.code ?? null,
        controlCategory: (t as any).control?.category ?? null,
        assignee:    (t as any).assignee?.fullName ?? null,
        dueDate:     t.dueDate,
        urgencyLevel: validUrgency.includes(aiItem.urgencyLevel) ? aiItem.urgencyLevel : 'medium',
        reason:      String(aiItem.reason ?? '').slice(0, 250),
        estimatedHours: Number(aiItem.estimatedHours ?? 2),
      };
    });

    return {
      weekOf:      today,
      readinessScore,
      weekFocus:   String(result.weekFocus ?? '').slice(0, 200),
      sprintItems,
      totalOpen:   openTasks.length,
    };
  }
}
