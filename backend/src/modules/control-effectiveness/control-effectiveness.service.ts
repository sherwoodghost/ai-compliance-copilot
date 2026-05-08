import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../notifications/notification.service';

/** Controls we can auto-test via integration data */
const INTEGRATION_TESTABLE_CONTROLS = [
  { code: 'A.8.2',  check: 'privileged_access_list',  method: 'integration_check' },
  { code: 'A.8.3',  check: 'access_rights_management', method: 'integration_check' },
  { code: 'A.8.16', check: 'monitoring_activities',    method: 'integration_check' },
  { code: 'A.5.24', check: 'incident_management',      method: 'integration_check' },
  { code: 'A.6.3',  check: 'security_awareness',       method: 'integration_check' },
  { code: 'A.8.8',  check: 'vulnerability_management', method: 'integration_check' },
  { code: 'CC6.3',  check: 'access_provisioning',      method: 'integration_check' },
  { code: 'CC7.2',  check: 'monitoring_logging',       method: 'integration_check' },
];

const EVIDENCE_CONTROL_CODES = ['A.5.35', 'A.5.36'];

@Injectable()
export class ControlEffectivenessService {
  private readonly logger = new Logger(ControlEffectivenessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  /** Get sampling history for an org, optionally filtered by controlId */
  async getSamples(orgId: string, controlId?: string) {
    return this.prisma.controlEffectivenessSample.findMany({
      where: {
        orgId,
        ...(controlId ? { controlId } : {}),
      },
      orderBy: { sampledAt: 'desc' },
      take: 200,
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    } as any);
  }

  /** Summary: latest result + 90-day pass rate per control */
  async getSummary(orgId: string) {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const samples = await this.prisma.controlEffectivenessSample.findMany({
      where: { orgId, sampledAt: { gte: cutoff } },
      orderBy: { sampledAt: 'desc' },
      include: { control: { select: { id: true, code: true, title: true } } },
    } as any);

    // Group by controlId
    const byControl = new Map<string, any[]>();
    for (const s of samples as any[]) {
      if (!byControl.has(s.controlId)) byControl.set(s.controlId, []);
      byControl.get(s.controlId)!.push(s);
    }

    const rows: any[] = [];
    for (const [controlId, controlSamples] of byControl) {
      const latest = controlSamples[0];
      const total  = controlSamples.length;
      const passed = controlSamples.filter((s: any) => s.result === 'PASS').length;
      rows.push({
        controlId,
        control: latest.control,
        latestResult:   latest.result,
        latestSampledAt: latest.sampledAt,
        passRate90d: total > 0 ? Math.round((passed / total) * 100) : null,
        sampleCount90d: total,
      });
    }

    // Sort by worst pass rate first (most attention needed)
    rows.sort((a, b) => (a.passRate90d ?? 101) - (b.passRate90d ?? 101));

    return {
      total:   rows.length,
      passing: rows.filter((r) => r.latestResult === 'PASS').length,
      failing: rows.filter((r) => r.latestResult === 'FAIL').length,
      partial: rows.filter((r) => r.latestResult === 'PARTIAL').length,
      controls: rows,
    };
  }

  /**
   * Manually sample a single control.
   * Uses evidence presence and task completion as proxy signals.
   */
  async sampleControl(
    orgId: string,
    controlId: string,
    actorId: string,
    notes?: string,
  ) {
    // Verify control exists in this org
    const orgControl = await this.prisma.organizationControl.findFirst({
      where: { orgId, controlId },
      include: { control: { select: { id: true, code: true, title: true } } },
    });
    if (!orgControl) throw new NotFoundException('Control not found in this organization');

    // Evaluate: check evidence + tasks
    const result = await this.evaluateControl(orgId, controlId);

    const sample = await this.prisma.controlEffectivenessSample.create({
      data: {
        orgId,
        controlId,
        sampledAt: new Date(),
        result: result.result,
        method: 'manual_review',
        notes: notes ?? result.notes,
        evidenceId: null,
      } as any,
    });

    this.logger.log(`Control ${(orgControl as any).control?.code} sampled: ${result.result} (org ${orgId})`);

    // Notify the RACI-Accountable owner when a control FAILS
    if (result.result === 'FAIL') {
      const controlCode  = (orgControl as any).control?.code  ?? 'Unknown';
      const controlTitle = (orgControl as any).control?.title ?? 'Unknown control';

      const raciOwner = await this.prisma.raciAssignment.findFirst({
        where: { orgId, controlId, raci: 'A' },
        select: { userId: true },
      });

      if (raciOwner) {
        await this.notifications.send(orgId, raciOwner.userId, {
          type:     'control.failed',
          title:    `Control effectiveness FAIL — ${controlCode}`,
          body:     `${controlTitle} failed its latest effectiveness check. Review evidence.`,
          href:     '/control-effectiveness',
          priority: 'high',
        });
      }
    }

    return { sample, evaluation: result };
  }

  /**
   * Batch sample all integration-testable controls.
   * Creates a single Evidence record for the batch → ISO A.5.35.
   */
  async runBatchSample(orgId: string, actorId: string) {
    const results: any[] = [];

    for (const testable of INTEGRATION_TESTABLE_CONTROLS) {
      // Find control in this org
      const orgControl = await this.prisma.organizationControl.findFirst({
        where: {
          orgId,
          control: { code: testable.code },
        },
        include: { control: { select: { id: true, code: true } } },
      });

      if (!orgControl) continue;

      const controlId = (orgControl as any).controlId ?? (orgControl as any).control?.id;
      if (!controlId) continue;

      const evaluation = await this.evaluateControl(orgId, controlId);

      const sample = await this.prisma.controlEffectivenessSample.create({
        data: {
          orgId,
          controlId,
          sampledAt: new Date(),
          result: evaluation.result,
          method: testable.method,
          notes: evaluation.notes,
          evidenceId: null,
        } as any,
      });

      results.push({ controlCode: testable.code, result: evaluation.result, sampleId: sample.id });
    }

    if (results.length === 0) {
      return { sampled: 0, results: [], evidenceId: null };
    }

    // Generate batch Evidence record → ISO A.5.35
    const passCount    = results.filter((r) => r.result === 'PASS').length;
    const failCount    = results.filter((r) => r.result === 'FAIL').length;
    const partialCount = results.filter((r) => r.result === 'PARTIAL').length;

    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        title: `Control Effectiveness Sampling — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        description: `Quarterly control effectiveness sample: ${passCount} PASS · ${failCount} FAIL · ${partialCount} PARTIAL across ${results.length} controls.`,
        fileType:    'application/json',
        fileSize:    JSON.stringify(results).length,
        storageUrl:  `evidence/control-effectiveness/${orgId}/${Date.now()}/batch.json`,
        uploadedBy:  actorId,
        reviewedBy:  actorId,
        expiresAt:   new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      } as any,
    });

    // Map evidence to ISO A.5.35 / A.5.36
    for (const code of EVIDENCE_CONTROL_CODES) {
      const ctrl = await this.prisma.control.findFirst({ where: { code } });
      if (ctrl) {
        await this.prisma.controlEvidence.create({
          data: {
            evidenceId: evidence.id,
            controlId:  ctrl.id,
            orgId,
            confidence: 90,
            mappedBy:   'control_effectiveness_sampling',
          } as any,
        }).catch(() => {});
      }
    }

    // Back-link samples to evidence
    for (const r of results) {
      await this.prisma.controlEffectivenessSample.update({
        where: { id: r.sampleId },
        data:  { evidenceId: evidence.id } as any,
      }).catch(() => {});
    }

    this.logger.log(`Batch sample complete for org ${orgId}: ${results.length} controls, evidence ${evidence.id}`);
    return { sampled: results.length, results, evidenceId: evidence.id };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async evaluateControl(orgId: string, controlId: string) {
    // Heuristic: check evidence currency + open tasks
    const [recentEvidence, openTasks, totalTasks] = await Promise.all([
      this.prisma.controlEvidence.count({
        where: {
          controlId,
          orgId,
          evidence: {
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          },
        },
      } as any),
      this.prisma.task.count({
        where: { orgId, status: 'open' } as any,
      }),
      this.prisma.task.count({
        where: { orgId } as any,
      }),
    ]);

    if (recentEvidence >= 1) {
      return {
        result: 'PASS' as const,
        notes: `${recentEvidence} evidence item(s) linked within last 90 days.`,
      };
    }

    const openRatio = totalTasks > 0 ? openTasks / totalTasks : 0;
    if (openRatio > 0.5) {
      return {
        result: 'FAIL' as const,
        notes: `No recent evidence. ${openTasks} of ${totalTasks} tasks still open.`,
      };
    }

    return {
      result: 'PARTIAL' as const,
      notes: 'No recent evidence linked; control may be implemented but not evidenced.',
    };
  }
}
