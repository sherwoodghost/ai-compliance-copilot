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

  async createManual(orgId: string, dto: { title: string; description?: string; priority?: TaskPriority; assignedTo?: string; controlId?: string; dueDate?: string }) {
    return this.prisma.task.create({
      data: {
        orgId,
        title: dto.title,
        description: dto.description ?? null,
        priority: dto.priority ?? 'medium',
        assignedTo: dto.assignedTo ?? null,
        controlId: dto.controlId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        source: 'manual',
        status: 'open',
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        control:  { select: { id: true, code: true, title: true } },
      },
    });
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
