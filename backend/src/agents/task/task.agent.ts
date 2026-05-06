import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class TaskAgent extends BaseAgent {
  protected readonly agentName = 'task';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile, inputPayload } = jobData;
    const { reviewOutput } = inputPayload as { reviewOutput?: any };

    // ── Step 1: Load org users by role ──────────────────────────────────────
    const users = await this.recordStep(runId, 'load_users', 0, { orgId }, async () => {
      return this.prisma.user.findMany({
        where: { orgId, isActive: true },
        select: { id: true, role: true, fullName: true },
      });
    });

    const adminUser = (users as any[]).find((u) => u.role === 'admin');

    // ── Step 2: Generate tasks from review ──────────────────────────────────
    const taskData = await this.recordStep(runId, 'generate_tasks', 1, {
      failedControls: reviewOutput?.failedControls ?? 0,
    }, async () => {
      const failedAndPartial = (reviewOutput?.controlReviews ?? []).filter(
        (r: any) => r.status !== 'passed',
      );

      if (failedAndPartial.length === 0) {
        return { tasks: [] };
      }

      const prompt = `Create remediation tasks based on these compliance review findings:

COMPANY CONTEXT:
- Company: ${businessProfile.companyName}
- Industry: ${businessProfile.industry}
- Team size: ${businessProfile.employeeCount}
- Engineering count: ${businessProfile.engineeringCount ?? 'unknown'}
- Tools: ${JSON.stringify(businessProfile.tools)}
- Cloud: ${businessProfile.infrastructure.cloudProviders.join(', ')}

FAILED/PARTIAL CONTROLS TO ADDRESS:
${JSON.stringify(failedAndPartial, null, 2)}

Create specific, actionable tasks. Reference the actual tools this company uses (${Object.values(businessProfile.tools ?? {}).filter(Boolean).join(', ')}).
Return JSON only.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'task-generator', userMessage: prompt, taskType: 'generic', orgId, workflowId: jobData?.workflowId, maxTokens: 4096 });
      return this.llm.parseJSON<any>(response.content);
    });

    // ── Step 3: Persist tasks to DB ─────────────────────────────────────────
    const createdTasks = await this.recordStep(runId, 'persist_tasks', 2, { orgId }, async () => {
      const tasks = (taskData as any).tasks ?? [];
      const created = [];

      for (const task of tasks) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (task.dueDaysFromNow ?? 30));

        const assigneeId = adminUser?.id; // Default to admin; future: smart routing

        const dbTask = await this.prisma.task.create({
          data: {
            orgId,
            controlId: task.controlId ?? null,
            workflowId: jobData.workflowId ?? null,
            title: task.title,
            description: task.description,
            priority: task.priority ?? 'medium',
            status: 'open',
            assignedTo: assigneeId ?? null,
            dueDate,
            source: 'agent',
          },
        });

        created.push({ taskId: dbTask.id, title: dbTask.title, priority: dbTask.priority });
      }

      return created;
    });

    return {
      success: true,
      data: { tasks: createdTasks, count: (createdTasks as any[]).length },
      nextAgentInput: { tasks: createdTasks },
    };
  }
}
