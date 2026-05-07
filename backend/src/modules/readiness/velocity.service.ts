import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class VelocityService {
  constructor(private readonly prisma: PrismaService) {}

  async getVelocity(orgId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Get all org controls
    const allControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      select: { status: true, updatedAt: true },
    });

    const totalControls = allControls.length;
    const implementedControls = allControls.filter((c) =>
      ['implemented'].includes(c.status as string),
    ).length;
    const inProgressControls = allControls.filter((c) => (c.status as string) === 'in_progress').length;
    const remainingControls = totalControls - implementedControls;

    // Controls completed in last 30 days
    const completedLast30 = allControls.filter(
      (c) =>
        (c.status as string) === 'implemented' &&
        c.updatedAt >= thirtyDaysAgo,
    ).length;

    // Controls completed in the 30 days before that (days 31-60)
    const completedPrev30 = allControls.filter(
      (c) =>
        (c.status as string) === 'implemented' &&
        c.updatedAt >= sixtyDaysAgo &&
        c.updatedAt < thirtyDaysAgo,
    ).length;

    // Evidence collected in last 30 days
    const evidenceLast30 = await this.prisma.evidence.count({
      where: { orgId, collectedAt: { gte: thirtyDaysAgo } },
    });

    // Tasks completed last 30 days
    const tasksCompleted30 = await this.prisma.task.count({
      where: { orgId, status: 'done', updatedAt: { gte: thirtyDaysAgo } },
    });

    // Calculate velocity score (controls per day over last 30d)
    const dailyVelocity = completedLast30 / 30;

    // Trend: positive if this period > last period
    const velocityTrend: 'up' | 'down' | 'flat' =
      completedLast30 > completedPrev30 ? 'up' :
      completedLast30 < completedPrev30 ? 'down' : 'flat';

    // Predicted days to completion
    let daysToCompletion: number | null = null;
    if (dailyVelocity > 0 && remainingControls > 0) {
      daysToCompletion = Math.ceil(remainingControls / dailyVelocity);
    } else if (remainingControls === 0) {
      daysToCompletion = 0;
    }

    // Predicted completion date
    const estimatedCompletionDate = daysToCompletion != null && daysToCompletion > 0
      ? new Date(now.getTime() + daysToCompletion * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Readiness percentage
    const readinessPct = totalControls > 0
      ? Math.round((implementedControls / totalControls) * 100)
      : 0;

    // Scenario: what if 2 more controls/day?
    const acceleratedDays = dailyVelocity > 0 && remainingControls > 0
      ? Math.ceil(remainingControls / (dailyVelocity + 0.07))
      : daysToCompletion;

    return {
      summary: {
        totalControls,
        implementedControls,
        inProgressControls,
        remainingControls,
        readinessPct,
      },
      velocity: {
        completedLast30Days: completedLast30,
        completedPrev30Days: completedPrev30,
        dailyRate: parseFloat(dailyVelocity.toFixed(2)),
        trend: velocityTrend,
        evidenceLast30Days: evidenceLast30,
        tasksCompleted30Days: tasksCompleted30,
      },
      forecast: {
        daysToCompletion,
        estimatedCompletionDate,
        acceleratedScenario: {
          description: 'Assign 2 additional controls per week',
          daysToCompletion: acceleratedDays,
          daysSaved: daysToCompletion != null && acceleratedDays != null
            ? Math.max(0, daysToCompletion - acceleratedDays)
            : null,
        },
      },
    };
  }
}
