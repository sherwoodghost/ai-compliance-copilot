import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async chat(orgId: string, message: string, history: ChatMessage[] = []) {
    // Gather live context from the DB
    const context = await this.gatherContext(orgId);

    const systemPrompt = `You are a Compliance Copilot AI assistant embedded in a compliance management platform.

You have access to real-time compliance data for this organization:

CONTROLS SUMMARY:
- Total controls: ${context.controls.total}
- Implemented: ${context.controls.implemented}
- In progress: ${context.controls.inProgress}
- Not started: ${context.controls.notStarted}
- Critical gaps: ${context.controls.critical} controls are critical and not implemented

EVIDENCE SUMMARY:
- Total evidence items: ${context.evidence.total}
- Valid: ${context.evidence.valid}
- Expired: ${context.evidence.expired}
- Expiring soon (30 days): ${context.evidence.expiringSoon}

TASKS:
- Open tasks: ${context.tasks.open}
- Overdue tasks: ${context.tasks.overdue}
- Completed this month: ${context.tasks.completedThisMonth}

RISKS:
- Total risks: ${context.risks.total}
- Critical/High risks: ${context.risks.critical}
- Accepted risks: ${context.risks.accepted}

POLICIES:
- Approved policies: ${context.policies.approved}
- Draft policies: ${context.policies.draft}
- Expired policies: ${context.policies.expired}

READINESS:
- Current readiness score: ${context.readiness.score}%
- Framework: ${context.readiness.framework}

Answer questions concisely and accurately based on the data above. When asked to draft text (emails, summaries), produce clear professional output. When you don't know something specific, say so rather than guessing.`;

    const messages = [
      ...history.slice(-10), // Keep last 10 messages for context
      { role: 'user' as const, content: message },
    ];

    const response = await this.llm.complete(messages, {
      systemPrompt,
      agentName: 'copilot',
      maxTokens: 1024,
      temperature: 0.3,
    });

    return {
      message: response.content,
      context: {
        controlsTotal: context.controls.total,
        readinessScore: context.readiness.score,
      },
    };
  }

  private async gatherContext(orgId: string) {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [controls, evidence, tasks, risks, policies, readiness] = await Promise.all([
      // Controls
      this.prisma.organizationControl.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { id: true },
      }),
      // Evidence
      this.prisma.evidence.findMany({
        where: { orgId },
        select: { isValid: true, expiresAt: true },
      }),
      // Tasks
      this.prisma.task.findMany({
        where: { orgId },
        select: { status: true, dueDate: true, updatedAt: true },
      }),
      // Risks
      this.prisma.riskItem.groupBy({
        by: ['status', 'severity'],
        where: { orgId },
        _count: { id: true },
      }),
      // Policies
      this.prisma.policy.groupBy({
        by: ['status'],
        where: { orgId },
        _count: { id: true },
      }),
      // Latest readiness score
      this.prisma.readinessScore.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: 'desc' },
        select: { overallScore: true, framework: true },
      }),
    ]);

    const controlCounts = {
      total: 0, implemented: 0, inProgress: 0, notStarted: 0, critical: 0,
    };
    for (const g of controls) {
      controlCounts.total += g._count.id;
      if (g.status === 'implemented') controlCounts.implemented += g._count.id;
      if (g.status === 'in_progress') controlCounts.inProgress += g._count.id;
      if (g.status === 'not_started') controlCounts.notStarted += g._count.id;
    }

    const evidenceCounts = {
      total: evidence.length,
      valid: evidence.filter((e) => e.isValid).length,
      expired: evidence.filter((e) => e.expiresAt && new Date(e.expiresAt) < now).length,
      expiringSoon: evidence.filter(
        (e) => e.expiresAt && new Date(e.expiresAt) >= now && new Date(e.expiresAt) <= thirtyDaysFromNow,
      ).length,
    };

    const taskCounts = {
      open: tasks.filter((t) => !['done', 'cancelled'].includes(t.status)).length,
      overdue: tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length,
      completedThisMonth: tasks.filter((t) => t.status === 'done' && t.updatedAt >= startOfMonth).length,
    };

    const riskCounts = {
      total: risks.reduce((sum, r) => sum + r._count.id, 0),
      critical: risks.filter((r) => ['critical', 'high'].includes(r.severity ?? '') && r.status !== 'accepted').reduce((sum, r) => sum + r._count.id, 0),
      accepted: risks.filter((r) => r.status === 'accepted').reduce((sum, r) => sum + r._count.id, 0),
    };

    const policyCounts = {
      approved: policies.find((p) => p.status === 'approved')?._count.id ?? 0,
      draft: policies.find((p) => p.status === 'draft')?._count.id ?? 0,
      expired: 0,
    };

    return {
      controls: controlCounts,
      evidence: evidenceCounts,
      tasks: taskCounts,
      risks: riskCounts,
      policies: policyCounts,
      readiness: {
        score: readiness?.overallScore ?? 0,
        framework: readiness?.framework ?? 'SOC2',
      },
    };
  }
}
