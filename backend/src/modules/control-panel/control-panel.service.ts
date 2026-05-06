import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ControlPanelService {
  constructor(private readonly prisma: PrismaService) {}

  // Full workflow canvas data — everything the n8n-style UI needs
  async getWorkflowCanvas(orgId: string, workflowId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, orgId },
      include: {
        trigger: { select: { fullName: true, email: true } },
        agentRuns: {
          include: {
            steps: { orderBy: { stepIndex: 'asc' } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');

    // Build canvas nodes (agents) and edges (pipeline connections)
    const PIPELINE_ORDER = [
      'onboarding', 'scoping', 'control-mapper', 'planner', 'gap-analysis',
      'policy', 'evidence', 'drift-detector', 'validator', 'risk-scoring',
      'review', 'remediation-advisor', 'threat-intel', 'vendor-risk',
      'task', 'interview', 'benchmark', 'audit', 'dashboard',
    ];

    const nodes = workflow.agentRuns.map((run) => ({
      id: run.id,
      agentName: run.agentName,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      llmTokensUsed: run.llmTokensUsed,
      llmCostUsd: run.llmCostUsd,
      errorMessage: run.errorMessage,
      retryCount: run.retryCount,
      stepCount: run.steps.length,
      pipelineIndex: PIPELINE_ORDER.indexOf(run.agentName),
    }));

    // Sort by pipeline order
    nodes.sort((a, b) => a.pipelineIndex - b.pipelineIndex);

    const edges = nodes.slice(0, -1).map((node, i) => ({
      from: node.id,
      to: nodes[i + 1].id,
      status: nodes[i + 1].status,
    }));

    return {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        type: workflow.type,
        status: workflow.status,
        startedAt: workflow.startedAt,
        completedAt: workflow.completedAt,
        triggeredBy: workflow.trigger?.fullName,
      },
      nodes,
      edges,
      totalCostUsd: nodes.reduce((sum, n) => sum + (Number(n.llmCostUsd) || 0), 0),
      totalDurationMs: nodes.reduce((sum, n) => sum + (n.durationMs || 0), 0),
    };
  }

  // Step-level detail for replay/edit UI
  async getStepDetail(orgId: string, runId: string, stepId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, orgId },
    });
    if (!run) throw new NotFoundException('Agent run not found');

    const step = await this.prisma.agentStep.findFirst({
      where: { id: stepId, runId },
    });
    if (!step) throw new NotFoundException('Step not found');

    return {
      ...step,
      canReplay: step.status === 'failed' || step.status === 'completed',
      agentName: run.agentName,
      workflowId: run.workflowId,
    };
  }

  // Update step input for replay (creates an override record)
  async updateStepInput(
    orgId: string,
    runId: string,
    stepId: string,
    newInput: Record<string, unknown>,
  ) {
    const run = await this.prisma.agentRun.findFirst({ where: { id: runId, orgId } });
    if (!run) throw new NotFoundException('Agent run not found');

    return this.prisma.agentStep.update({
      where: { id: stepId },
      data: { inputSnapshot: newInput as any },
    });
  }

  // List all workflows with summary for the main control panel list view
  async listWorkflows(orgId: string, limit = 20) {
    const workflows = await this.prisma.workflow.findMany({
      where: { orgId },
      include: {
        trigger: { select: { fullName: true } },
        _count: { select: { agentRuns: true, tasks: true } },
        agentRuns: {
          select: { status: true, llmCostUsd: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return workflows.map((w) => ({
      id: w.id,
      name: w.name,
      type: w.type,
      status: w.status,
      startedAt: w.startedAt,
      completedAt: w.completedAt,
      triggeredBy: w.trigger?.fullName,
      agentRunCount: w._count.agentRuns,
      taskCount: w._count.tasks,
      totalCostUsd: w.agentRuns.reduce((sum, r) => sum + Number(r.llmCostUsd || 0), 0),
      completedAgents: w.agentRuns.filter((r) => r.status === 'completed').length,
      failedAgents: w.agentRuns.filter((r) => r.status === 'failed').length,
    }));
  }

  async getAgentEventLog(orgId: string, workflowId?: string, limit = 100) {
    return this.prisma.agentEvent.findMany({
      where: {
        orgId,
        ...(workflowId && { workflowId }),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getSystemStats(orgId: string) {
    const [
      totalWorkflows,
      totalAgentRuns,
      totalSteps,
      totalCost,
      openRisks,
      openTasks,
    ] = await Promise.all([
      this.prisma.workflow.count({ where: { orgId } }),
      this.prisma.agentRun.count({ where: { orgId } }),
      this.prisma.agentStep.count({ where: { run: { orgId } } }),
      this.prisma.agentRun.aggregate({
        where: { orgId },
        _sum: { llmCostUsd: true, llmTokensUsed: true, durationMs: true },
      }),
      this.prisma.riskItem.count({ where: { orgId, status: 'open' } }),
      this.prisma.task.count({ where: { orgId, status: { not: 'done' } } }),
    ]);

    return {
      totalWorkflows,
      totalAgentRuns,
      totalSteps,
      totalLlmCostUsd: Number(totalCost._sum.llmCostUsd ?? 0).toFixed(4),
      totalTokensUsed: totalCost._sum.llmTokensUsed ?? 0,
      totalProcessingMs: totalCost._sum.durationMs ?? 0,
      openRisks,
      openTasks,
    };
  }
}
