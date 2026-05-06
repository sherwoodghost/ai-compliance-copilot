import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.workflow.findMany({
      where: { orgId },
      include: {
        trigger: { select: { id: true, fullName: true } },
        _count: { select: { agentRuns: true, tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async findOne(orgId: string, workflowId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, orgId },
      include: {
        trigger: { select: { id: true, fullName: true, email: true } },
        agentRuns: {
          include: { steps: { orderBy: { stepIndex: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        },
        tasks: {
          include: { assignee: { select: { id: true, fullName: true } } },
        },
      },
    });

    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async getRunDetail(orgId: string, runId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, orgId },
      include: {
        steps: { orderBy: { stepIndex: 'asc' } },
        workflow: { select: { id: true, name: true, type: true } },
      },
    });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async cancel(orgId: string, workflowId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, orgId, status: { in: ['pending', 'running'] } },
    });
    if (!workflow) throw new NotFoundException('Active workflow not found');

    return this.prisma.workflow.update({
      where: { id: workflowId },
      data: { status: 'cancelled', completedAt: new Date() },
    });
  }

  async getStats(orgId: string) {
    const [total, running, completed, failed] = await Promise.all([
      this.prisma.workflow.count({ where: { orgId } }),
      this.prisma.workflow.count({ where: { orgId, status: 'running' } }),
      this.prisma.workflow.count({ where: { orgId, status: 'completed' } }),
      this.prisma.workflow.count({ where: { orgId, status: 'failed' } }),
    ]);

    // avgDuration reserved for future use

    return { total, running, completed, failed };
  }
}
