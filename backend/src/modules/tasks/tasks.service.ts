import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })    @IsOptional() @IsEnum(TaskStatus)    status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority })  @IsOptional() @IsEnum(TaskPriority)  priority?: TaskPriority;
  @ApiPropertyOptional()                        @IsOptional() @IsUUID()              assignedTo?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsDateString()        dueDate?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsString()            description?: string;
}

export class CreateTaskDto {
  @ApiPropertyOptional()                        @IsOptional() @IsString()            title?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsString()            description?: string;
  @ApiPropertyOptional({ enum: TaskPriority })  @IsOptional() @IsEnum(TaskPriority)  priority?: TaskPriority;
  @ApiPropertyOptional()                        @IsOptional() @IsUUID()              controlId?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsUUID()              assignedTo?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsDateString()        dueDate?: string;
}

export class CreateFromActionDto {
  @IsString()  title: string;
  @IsOptional() @IsString()  description?: string;
  @IsOptional() @IsString()  controlId?: string;
  @IsOptional() @IsString()  effort?: 'low' | 'medium' | 'high';
  @IsOptional() @IsString()  impact?: 'low' | 'medium' | 'high';
  @IsOptional() @IsString()  type?: string;
  @IsOptional() @IsString()  category?: string;
  @IsOptional() @IsString()  frameworkName?: string;
  @IsOptional() @IsString()  controlCode?: string;
  @IsOptional() @IsDateString()  dueDate?: string;
  @IsOptional() @IsUUID()  assignedTo?: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly resend:  ResendService,
  ) {}

  async findAll(orgId: string, status?: TaskStatus, assignedTo?: string, priority?: TaskPriority) {
    return this.prisma.task.findMany({
      where: {
        orgId,
        ...(status     && { status }),
        ...(assignedTo && { assignedTo }),
        ...(priority   && { priority }),
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        control:  { select: { id: true, code: true, title: true } },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(orgId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, orgId },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        control:  { include: { framework: { select: { name: true } } } },
        workflow: { select: { id: true, name: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(orgId: string, taskId: string, dto: UpdateTaskDto) {
    const existing = await this.findOne(orgId, taskId);

    const updated = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(dto.status      && { status:     dto.status }),
        ...(dto.priority    && { priority:   dto.priority }),
        ...(dto.assignedTo !== undefined && { assignedTo: dto.assignedTo }),
        ...(dto.dueDate     && { dueDate:    new Date(dto.dueDate) }),
        ...(dto.description && { description: dto.description }),
      },
      include: {
        assignee: { select: { email: true, fullName: true } },
      },
    });

    // Fire assignment email when assignedTo changes and there's an assignee
    const assigneeChanged = dto.assignedTo && dto.assignedTo !== existing.assignedTo;
    if (assigneeChanged && updated.assignee?.email) {
      await this.resend.sendTaskAssignment({
        to:           updated.assignee.email,
        assigneeName: updated.assignee.fullName ?? 'Team member',
        taskTitle:    updated.title,
        taskId:       taskId,
        dueDate:      updated.dueDate?.toLocaleDateString() ?? undefined,
        priority:     updated.priority,
      }).catch(() => {}); // non-fatal
    }

    return updated;
  }

  async getMyTasks(userId: string, orgId: string) {
    return this.prisma.task.findMany({
      where:   { orgId, assignedTo: userId, status: { not: 'done' } },
      include: { control: { select: { code: true, title: true } } },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
    });
  }

  /**
   * Create a manual task.
   */
  async create(orgId: string, dto: CreateTaskDto) {
    if (!dto.title) throw new NotFoundException('Title is required');

    return this.prisma.task.create({
      data: {
        orgId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        status: 'open',
        source: 'manual',
        ...(dto.controlId && { controlId: dto.controlId }),
        ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * Create a task directly from an Action Plan item.
   * Maps action effort + impact to task priority and infers default due dates.
   */
  async createFromAction(orgId: string, dto: CreateFromActionDto) {
    // Map effort/impact → priority
    let priority: TaskPriority = 'medium';
    if (dto.impact === 'high' && dto.effort === 'low') priority = 'critical';
    else if (dto.impact === 'high') priority = 'high';
    else if (dto.impact === 'medium') priority = 'medium';
    else priority = 'low';

    // Map category → due date
    const now = new Date();
    let dueDate: Date | undefined;
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate);
    } else {
      switch (dto.category) {
        case 'quick_win':   dueDate = new Date(now.getTime() + 7 * 86400_000);  break; // 1 week
        case 'foundation':  dueDate = new Date(now.getTime() + 14 * 86400_000); break; // 2 weeks
        case 'strategic':   dueDate = new Date(now.getTime() + 30 * 86400_000); break; // 1 month
        case 'maintenance': dueDate = new Date(now.getTime() + 60 * 86400_000); break; // 2 months
        default:            dueDate = new Date(now.getTime() + 21 * 86400_000); break; // 3 weeks
      }
    }

    // Build description with action context
    const descParts = [
      dto.description ?? '',
      '',
      '---',
      `**Source**: Action Plan${dto.category ? ` · ${dto.category.replace('_', ' ')}` : ''}`,
      dto.frameworkName ? `**Framework**: ${dto.frameworkName}` : '',
      dto.controlCode ? `**Control**: ${dto.controlCode}` : '',
      dto.effort ? `**Effort**: ${dto.effort}` : '',
      dto.impact ? `**Impact**: ${dto.impact}` : '',
    ].filter(Boolean).join('\n');

    return this.prisma.task.create({
      data: {
        orgId,
        title: dto.title,
        description: descParts,
        priority,
        status: 'open',
        source: 'agent',
        ...(dto.controlId && { controlId: dto.controlId }),
        ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
        dueDate,
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  async getStats(orgId: string) {
    const [total, open, inProgress, blocked, done, overdue] = await Promise.all([
      this.prisma.task.count({ where: { orgId } }),
      this.prisma.task.count({ where: { orgId, status: 'open' } }),
      this.prisma.task.count({ where: { orgId, status: 'in_progress' } }),
      this.prisma.task.count({ where: { orgId, status: 'blocked' } }),
      this.prisma.task.count({ where: { orgId, status: 'done' } }),
      this.prisma.task.count({
        where: { orgId, dueDate: { lt: new Date() }, status: { not: 'done' } },
      }),
    ]);
    return { total, open, inProgress, blocked, done, overdue };
  }
}
