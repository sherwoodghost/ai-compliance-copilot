import { Injectable, NotFoundException } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';
import { LlmService } from '../../llm/llm.service';

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
    private readonly llm:     LlmService,
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

  async generateFromGaps(orgId: string): Promise<{ created: number; tasks: any[] }> {
    // 1. Fetch not-started / in-progress controls (these are the gaps)
    const gapControls = await this.prisma.orgControl.findMany({
      where: { orgId, status: { in: ['not_started', 'in_progress'] } },
      include: {
        control: {
          select: { code: true, title: true, description: true, category: true },
        },
      },
      orderBy: [{ control: { category: 'asc' } }],
      take: 40, // cap to avoid huge prompts
    });

    if (gapControls.length === 0) {
      return { created: 0, tasks: [] };
    }

    // 2. Fetch existing open/in-progress task titles so we don't duplicate
    const existingTitles = await this.prisma.task.findMany({
      where: { orgId, status: { in: ['open', 'in_progress', 'blocked'] } },
      select: { title: true, controlId: true },
    });
    const existingControlIds = new Set(existingTitles.map((t) => t.controlId).filter(Boolean));

    // Only generate for controls that don't already have open tasks
    const needsTasks = gapControls.filter((gc) => !existingControlIds.has(gc.id));
    if (needsTasks.length === 0) {
      return { created: 0, tasks: [] };
    }

    // 3. Build gap list for the prompt
    const gapList = needsTasks
      .map((gc) => `- [${gc.control.code}] ${gc.control.title} (${gc.control.category}) — status: ${gc.status}`)
      .join('\n');

    // 4. Call LLM to generate prioritized tasks
    const systemPrompt = `You are a compliance project manager. Given a list of unimplemented compliance controls, generate concrete, actionable remediation tasks. Each task must be specific, implementable by a typical engineering or ops team, and directly tied to a single control. Return ONLY valid JSON — no markdown fences, no explanation.`;

    const userPrompt = `Generate remediation tasks for these compliance gaps:\n\n${gapList}\n\nReturn a JSON array of task objects. Each object must have:\n- title: string (concise action, max 80 chars)\n- description: string (what to do and why, max 200 chars)\n- priority: "critical" | "high" | "medium" | "low"\n- controlCode: string (the [CODE] from the list above)\n- dueDaysFromNow: number (7, 14, 30, 60, or 90 based on urgency)\n\nLimit to at most ${Math.min(needsTasks.length * 2, 30)} tasks. Prioritize critical and high controls. Return only the JSON array.`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'task', temperature: 0.2 },
    );

    // 5. Parse LLM response
    let aiTasks: Array<{
      title: string;
      description: string;
      priority: string;
      controlCode: string;
      dueDaysFromNow: number;
    }> = [];

    try {
      const raw = response.content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      aiTasks = JSON.parse(raw);
      if (!Array.isArray(aiTasks)) aiTasks = [];
    } catch {
      aiTasks = [];
    }

    if (aiTasks.length === 0) return { created: 0, tasks: [] };

    // 6. Build a code → orgControlId lookup
    const codeToOrgControl = new Map(
      needsTasks.map((gc) => [gc.control.code, gc.id]),
    );

    // 7. Create tasks in DB
    const createdTasks: any[] = [];
    for (const t of aiTasks) {
      const controlId = codeToOrgControl.get(t.controlCode) ?? null;
      const dueDate   = new Date();
      dueDate.setDate(dueDate.getDate() + (t.dueDaysFromNow ?? 30));

      const validPriorities = ['critical', 'high', 'medium', 'low'];
      const priority = validPriorities.includes(t.priority) ? t.priority : 'medium';

      const task = await this.prisma.task.create({
        data: {
          orgId,
          title:       t.title?.slice(0, 200) ?? 'Remediation task',
          description: t.description?.slice(0, 500) ?? null,
          priority:    priority as TaskPriority,
          controlId,
          dueDate,
          source:      'ai',
          status:      'open',
        },
        include: {
          control: { select: { id: true, code: true, title: true } },
        },
      });
      createdTasks.push(task);
    }

    return { created: createdTasks.length, tasks: createdTasks };
  }
}
