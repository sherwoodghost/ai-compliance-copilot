import { ControlTest } from '../control-test.base';
import { TestContext, TestDefinition, TestResult } from '../control-test.base';

export class TaskOverdueTest extends ControlTest {
  readonly meta: TestDefinition = {
    testId:            'task-overdue',
    controlCode:       'CC4.1',
    name:              'No Overdue Compliance Tasks',
    description:       'Checks that there are no open tasks past their due date.',
    frequencyCron:     '0 */6 * * *',
    requiresConnector: null,
  };

  async execute(ctx: TestContext): Promise<TestResult> {
    const now = new Date();

    const overdueTasks = await ctx.prisma.task.findMany({
      where: {
        orgId:   ctx.orgId,
        dueDate: { lt: now },
        status:  { not: 'done' },
      },
      select: { id: true, title: true, dueDate: true, status: true, priority: true },
      take: 20,
    });

    const overdueCount = overdueTasks.length;

    if (overdueCount > 0) {
      return this.fail(
        { overdueCount },
        'Overdue Task Report',
        {
          overdueCount,
          tasks: overdueTasks.map((t) => ({
            id:       t.id,
            title:    t.title,
            dueDate:  t.dueDate,
            status:   t.status,
            priority: t.priority,
          })),
        },
      );
    }

    return this.pass(
      { overdueCount: 0 },
      'Overdue Task Report',
      { overdueCount: 0 },
    );
  }
}
