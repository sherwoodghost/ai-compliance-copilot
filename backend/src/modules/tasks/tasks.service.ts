import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';
import { LlmService } from '../../llm/llm.service';
import { TASK_LIBRARY, COVERED_CONTROL_CODES, TaskSpec } from './task-program.library';

/** Helper: check if all dependency tasks are completed */
function areAllDependenciesDone(task: { dependsOn: string[] }, allTasks: Array<{ id: string; status: string }>): boolean {
  if (!task.dependsOn?.length) return true;
  const doneIds = new Set(allTasks.filter((t) => t.status === 'done').map((t) => t.id));
  return task.dependsOn.every((depId) => doneIds.has(depId));
}

export class UpdateTaskDto {
  @ApiPropertyOptional({ enum: TaskStatus })    @IsOptional() @IsEnum(TaskStatus)    status?: TaskStatus;
  @ApiPropertyOptional({ enum: TaskPriority })  @IsOptional() @IsEnum(TaskPriority)  priority?: TaskPriority;
  @ApiPropertyOptional()                        @IsOptional() @IsUUID()              assignedTo?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsDateString()        dueDate?: string;
  @ApiPropertyOptional()                        @IsOptional() @IsString()            description?: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

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
    const gapControls = await this.prisma.organizationControl.findMany({
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
    // Task.controlId references the global Control model, as does gc.controlId
    const existingControlIds = new Set(existingTitles.map((t) => t.controlId).filter(Boolean));

    // Only generate for controls that don't already have open tasks
    const needsTasks = gapControls.filter((gc) => !existingControlIds.has(gc.controlId));
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

    // 6. Build a code → global Control ID lookup (Task.controlId → Control, not OrgControl)
    const codeToControlId = new Map(
      needsTasks.map((gc) => [gc.control.code, gc.controlId]),
    );

    // 7. Create tasks in DB
    const createdTasks: any[] = [];
    for (const t of aiTasks) {
      const controlId = codeToControlId.get(t.controlCode) ?? null;
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
          source:      'agent',
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

  // ─── Guided Program Generator (4-layer) ────────────────────────────────────

  /**
   * Generate a full guided compliance task program for an org.
   * 4-layer architecture:
   *   L1 — Deterministic task library (zero hallucination)
   *   L2 — LLM personalisation of titles/descriptions/guidance
   *   L3 — DAG dependency resolution + due-date assignment
   *   L4 — RACI-based assignee assignment
   *
   * Idempotent: skips task specs that already have guided tasks for that control.
   */
  async generateGuidedProgram(orgId: string): Promise<{ created: number; skipped: number }> {
    // ─── Layer 1: Deterministic task specs ─────────────────────────────────
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: { control: { select: { id: true, code: true, title: true, category: true } } },
    });

    // Find which covered controls this org has
    const orgControlCodes = new Set(orgControls.map((oc) => oc.control.code));
    const applicableCodes = COVERED_CONTROL_CODES.filter((code) => orgControlCodes.has(code));

    // Skip controls that already have guided tasks
    const existingGuidedControlIds = await this.prisma.task.findMany({
      where: { orgId, isGuided: true },
      select: { controlId: true },
      distinct: ['controlId'],
    });
    const controlsWithGuidedTasks = new Set(existingGuidedControlIds.map((t) => t.controlId).filter(Boolean));

    const codeToOrgControl = new Map(orgControls.map((oc) => [oc.control.code, oc]));

    // Build flat list of task specs to create
    interface TaskToCreate {
      spec: TaskSpec;
      controlCode: string;
      controlId: string;
      specIndex: number;
    }
    const tasksToCreate: TaskToCreate[] = [];

    for (const code of applicableCodes) {
      const oc = codeToOrgControl.get(code);
      if (!oc) continue;
      if (controlsWithGuidedTasks.has(oc.controlId)) continue; // already has guided tasks

      const specs = TASK_LIBRARY[code];
      for (let i = 0; i < specs.length; i++) {
        tasksToCreate.push({ spec: specs[i], controlCode: code, controlId: oc.controlId, specIndex: i });
      }
    }

    if (tasksToCreate.length === 0) {
      this.logger.log(`Guided program: nothing to create for org ${orgId}`);
      return { created: 0, skipped: 0 };
    }

    // ─── Layer 2: LLM Personalisation ─────────────────────────────────────
    const profile = await this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } });
    const pd = (profile as any) ?? {};
    const companyName = pd.companyName ?? 'your organisation';
    const industry    = pd.industry ?? 'technology';
    const companySize = pd.employeeCount ?? 'small';
    const frameworks  = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2', 'ISO 27001']).join(' and ');
    const auditDate   = pd.complianceGoals?.targetAuditDate ?? 'upcoming';

    // Personalise in batches of 10 to avoid token overflows
    const BATCH_SIZE = 10;
    const personalisedTasks: Array<{ title: string; description: string; guidanceWhy: string; guidanceEvidenceHint: string; estimatedMinutes: number }> = [];

    for (let batchStart = 0; batchStart < tasksToCreate.length; batchStart += BATCH_SIZE) {
      const batch = tasksToCreate.slice(batchStart, batchStart + BATCH_SIZE);

      const taskListStr = batch.map((t, i) => (
        `${i + 1}. [${t.controlCode}] ${t.spec.title}\n   Why: ${t.spec.guidanceHint.why}\n   Evidence: ${t.spec.guidanceHint.evidenceHint}`
      )).join('\n');

      const systemPrompt = `You are a compliance program manager personalising task descriptions for a specific organisation. Keep every task specific, actionable, and concise. Do NOT add, remove, or reorder tasks. Return exactly ${batch.length} personalised task objects.`;

      const userPrompt = `Personalise these ${batch.length} compliance tasks for ${companyName} (${industry}, ${companySize} employees, targeting ${frameworks}, audit: ${auditDate}):

${taskListStr}

Return ONLY a JSON array of exactly ${batch.length} objects (no markdown):
[
  {
    "title": "Brief action title (max 80 chars, start with a verb)",
    "description": "1-2 sentences specific to ${companyName}'s context (max 150 chars)",
    "guidanceWhy": "1 sentence why this matters for ${companyName} specifically",
    "guidanceEvidenceHint": "Specific evidence type (mention tools they likely use)",
    "estimatedMinutes": <integer>
  }
]`;

      try {
        const response = await this.llm.complete(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          { agentName: 'task', temperature: 0.15, maxTokens: 2000 },
        );
        const raw = response.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed: any[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === batch.length) {
          personalisedTasks.push(...parsed);
        } else {
          // Fallback: use original spec data
          batch.forEach((t) => personalisedTasks.push({
            title: t.spec.title,
            description: t.spec.guidanceHint.why,
            guidanceWhy: t.spec.guidanceHint.why,
            guidanceEvidenceHint: t.spec.guidanceHint.evidenceHint,
            estimatedMinutes: t.spec.estimatedMinutes,
          }));
        }
      } catch {
        // LLM failure: use original
        batch.forEach((t) => personalisedTasks.push({
          title: t.spec.title,
          description: t.spec.guidanceHint.why,
          guidanceWhy: t.spec.guidanceHint.why,
          guidanceEvidenceHint: t.spec.guidanceHint.evidenceHint,
          estimatedMinutes: t.spec.estimatedMinutes,
        }));
      }
    }

    // ─── Layer 3: DAG resolution + due-date assignment ─────────────────────
    // Create tasks in DB first (without dependsOn), then resolve IDs
    const auditTargetDate = pd.complianceGoals?.targetAuditDate
      ? new Date(pd.complianceGoals.targetAuditDate)
      : new Date(Date.now() + 120 * 24 * 60 * 60 * 1000); // 120 days from now

    const totalTasks = tasksToCreate.length;
    const daySpread = Math.max(7, Math.floor((auditTargetDate.getTime() - Date.now()) / (totalTasks * 24 * 60 * 60 * 1000)));

    // Group tasks by control to resolve relative dependsOn
    const controlTaskIds: Map<string, string[]> = new Map();
    const createdTaskIds: string[] = [];

    for (let i = 0; i < tasksToCreate.length; i++) {
      const item = tasksToCreate[i];
      const personalised = personalisedTasks[i];
      const spec = item.spec;

      // Calculate due date: base spread + urgency modifier
      const baseOffsetDays = (i + 1) * Math.max(3, Math.min(daySpread, 14));
      const dueDate = new Date(Date.now() + baseOffsetDays * 24 * 60 * 60 * 1000);

      // Build guidance JSON
      const guidance = {
        why: personalised.guidanceWhy || spec.guidanceHint.why,
        evidenceHint: personalised.guidanceEvidenceHint || spec.guidanceHint.evidenceHint,
        fileFormat: spec.guidanceHint.fileFormat ?? '',
        stepByStep: spec.guidanceHint.stepByStep,
        estimatedMinutes: personalised.estimatedMinutes || spec.estimatedMinutes,
        controlCategory: spec.guidanceHint.controlCategory,
        templateId: (spec as any).templateId ?? null,
      };

      const created = await this.prisma.task.create({
        data: {
          orgId,
          controlId: item.controlId,
          title: String(personalised.title || spec.title).slice(0, 200),
          description: String(personalised.description || spec.guidanceHint.why).slice(0, 500),
          priority: spec.approvalRequired ? 'high' : 'medium',
          status: 'open',
          source: 'agent',
          kind: spec.kind as any,
          isGuided: true,
          guidance,
          approvalRequired: spec.approvalRequired,
          estimatedMinutes: personalised.estimatedMinutes || spec.estimatedMinutes,
          slaHours: spec.slaHours,
          recurrence: spec.recurrence ? { ...spec.recurrence, nextDueAt: dueDate.toISOString() } : undefined,
          dueDate,
        },
      });

      createdTaskIds.push(created.id);

      // Track by control for dependsOn resolution
      if (!controlTaskIds.has(item.controlCode)) {
        controlTaskIds.set(item.controlCode, []);
      }
      controlTaskIds.get(item.controlCode)!.push(created.id);
    }

    // ─── Resolve dependsOn ─────────────────────────────────────────────────
    for (let i = 0; i < tasksToCreate.length; i++) {
      const item = tasksToCreate[i];
      const spec = item.spec;
      const taskId = createdTaskIds[i];

      if (spec.dependsOnRelative && spec.dependsOnRelative.length > 0) {
        const controlTaskList = controlTaskIds.get(item.controlCode) ?? [];
        const dependsOnIds = spec.dependsOnRelative
          .map((relIdx) => controlTaskList[relIdx])
          .filter(Boolean) as string[];

        if (dependsOnIds.length > 0) {
          await this.prisma.task.update({
            where: { id: taskId },
            data: { dependsOn: dependsOnIds },
          });
        }
      }
    }

    // ─── Layer 4: RACI-based assignment ────────────────────────────────────
    // Try to assign each task to the most relevant user based on kind and RACI
    const raciAssignments = await this.prisma.raciAssignment.findMany({
      where: { orgId, raci: { in: ['R', 'A'] } },
    });

    const controlRaciR = new Map<string, string>(); // controlId → userId (R)
    const controlRaciA = new Map<string, string>(); // controlId → userId (A)
    for (const r of raciAssignments) {
      if (r.raci === 'R') controlRaciR.set(r.controlId, r.userId);
      if (r.raci === 'A') controlRaciA.set(r.controlId, r.userId);
    }

    for (let i = 0; i < tasksToCreate.length; i++) {
      const item = tasksToCreate[i];
      const spec = item.spec;
      const taskId = createdTaskIds[i];

      let assigneeId: string | null = null;
      let approverId: string | null = null;

      if (spec.kind === 'APPROVAL') {
        // Approval tasks go to the RACI-A user (must be different from RACI-R)
        approverId = controlRaciA.get(item.controlId) ?? null;
      } else {
        // Other tasks go to the RACI-R user
        assigneeId = controlRaciR.get(item.controlId) ?? null;
        if (spec.approvalRequired) {
          approverId = controlRaciA.get(item.controlId) ?? null;
        }
      }

      if (assigneeId || approverId) {
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            ...(assigneeId && { assignedTo: assigneeId }),
            ...(approverId && { approverId }),
          },
        });
      }
    }

    this.logger.log(`Guided program generated for org ${orgId}: ${createdTaskIds.length} tasks created`);
    return { created: createdTaskIds.length, skipped: existingGuidedControlIds.length };
  }

  /**
   * Get guided tasks for "Getting Started" page — grouped by section.
   */
  async getGuidedProgram(orgId: string, userId?: string) {
    const now = new Date();

    const where = {
      orgId,
      isGuided: true,
      status: { not: 'done' as const },
      ...(userId && { assignedTo: userId }),
    };

    const tasks = await this.prisma.task.findMany({
      where,
      include: {
        control: { select: { id: true, code: true, title: true, category: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }],
    });

    // Section classification
    const thisWeek:  typeof tasks = [];
    const readyNow:  typeof tasks = [];
    const blocked:   typeof tasks = [];
    const recurring: typeof tasks = [];

    for (const task of tasks) {
      const isRecurring = task.recurrence !== null;
      const isBlocked   = task.status === 'blocked' || (task.dependsOn?.length > 0 && !areAllDependenciesDone(task, tasks));
      const isOverdue   = task.dueDate && task.dueDate < now;
      const isDueThisWeek = task.dueDate && task.dueDate <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (isRecurring && !isOverdue) {
        recurring.push(task);
      } else if (isBlocked) {
        blocked.push(task);
      } else if (isOverdue || isDueThisWeek) {
        thisWeek.push(task);
      } else {
        readyNow.push(task);
      }
    }

    const total = tasks.length + (await this.prisma.task.count({ where: { orgId, isGuided: true, status: 'done' } }));
    const done  = await this.prisma.task.count({ where: { orgId, isGuided: true, status: 'done' } });

    return {
      sections: { thisWeek, readyNow, blocked, recurring },
      stats: {
        total,
        done,
        percent: total > 0 ? Math.round((done / total) * 100) : 0,
      },
    };
  }
}
