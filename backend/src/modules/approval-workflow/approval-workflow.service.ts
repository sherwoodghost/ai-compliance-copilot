/**
 * ApprovalWorkflowService — E7 Workflow Engine Foundation
 *
 * Lightweight state-machine for multi-step document / policy approval flows.
 * Uses the WorkflowDefinition + WorkflowInstance Prisma models.
 *
 * Integration with DocumentsService:
 *   requestApproval()  →  workflowService.startWorkflow('Document', id, defaultDef)
 *   The document lock is set by this engine; DocumentsService.update() calls
 *   getActiveInstance() before allowing edits — 409 if an active instance exists.
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../notifications/notification.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  id:             string;
  name:           string;
  assigneeRole?:  string | null;  // ComplianceRole — route to role holder
  assigneeId?:    string | null;  // Explicit user (overrides role lookup)
  type:           'approve' | 'review' | 'sign';
  slaHours:       number;
  parallel:       boolean;
}

export interface StepHistoryEntry {
  stepId:    string;
  actorId:   string;
  action:    'approved' | 'rejected' | 'reviewed' | 'signed';
  at:        string; // ISO timestamp
  note?:     string;
}

export interface StartWorkflowOptions {
  definitionId?: string;     // Use a specific definition; falls back to org default for entityType
  defaultSteps?: WorkflowStep[]; // Inline steps — used when no DB definition exists yet (bootstrap)
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);

  constructor(
    private readonly prisma:         PrismaService,
    private readonly notifications:  NotificationService,
  ) {}

  // ── Start a workflow instance ───────────────────────────────────────────────

  async startWorkflow(
    orgId:      string,
    entityType: string,
    entityId:   string,
    actorId:    string,
    opts:       StartWorkflowOptions = {},
  ): Promise<{ instanceId: string }> {
    // Block duplicate active instances
    const existing = await this.getActiveInstance(entityType, entityId);
    if (existing) {
      throw new ConflictException(
        `An active ${existing.status} workflow already exists for this ${entityType}`,
      );
    }

    // Resolve workflow definition
    let steps: WorkflowStep[];
    let definitionId: string;

    if (opts.definitionId) {
      const def = await this.prisma.workflowDefinition.findFirst({
        where: { id: opts.definitionId, orgId },
      });
      if (!def) throw new NotFoundException('Workflow definition not found');
      steps        = def.steps as unknown as WorkflowStep[];
      definitionId = def.id;
    } else {
      // Look for org default definition for this entity type
      const def = await this.prisma.workflowDefinition.findFirst({
        where: { orgId, entityType, isDefault: true },
      });

      if (def) {
        steps        = def.steps as unknown as WorkflowStep[];
        definitionId = def.id;
      } else if (opts.defaultSteps?.length) {
        // Create an implicit single-use definition from inline steps
        const created = await this.prisma.workflowDefinition.create({
          data: {
            orgId,
            entityType,
            name:      `Auto: ${entityType} approval`,
            steps:     opts.defaultSteps as any,
            isDefault: false,
          },
        });
        steps        = opts.defaultSteps;
        definitionId = created.id;
      } else {
        // Fallback: single-step approval — the org owner / any approver-role user
        const fallbackOwner = await this.prisma.user.findFirst({
          where: { orgId, platformRole: 'owner', isActive: true },
          select: { id: true },
        });

        const fallback: WorkflowStep[] = [{
          id:          'step-0',
          name:        'Approval',
          type:        'approve',
          assigneeId:  fallbackOwner?.id ?? null,
          slaHours:    72,
          parallel:    false,
        }];

        const created = await this.prisma.workflowDefinition.create({
          data: {
            orgId,
            entityType,
            name:      `Auto: ${entityType} approval`,
            steps:     fallback as any,
            isDefault: false,
          },
        });
        steps        = fallback;
        definitionId = created.id;
      }
    }

    // Create the instance
    const instance = await this.prisma.workflowInstance.create({
      data: {
        orgId,
        definitionId,
        entityType,
        entityId,
        currentStep: 0,
        status:      'active',
        stepHistory: [],
      },
    });

    // Notify step-0 assignee
    await this._notifyStepAssignee(orgId, steps[0], entityType, entityId).catch(() => {});

    this.logger.log(
      `Workflow started: instance=${instance.id} entity=${entityType}:${entityId} steps=${steps.length}`,
    );

    return { instanceId: instance.id };
  }

  // ── Advance (approve / reject / review) ────────────────────────────────────

  async advanceStep(
    orgId:      string,
    instanceId: string,
    actorId:    string,
    action:     'approved' | 'rejected' | 'reviewed' | 'signed',
    note?:      string,
  ): Promise<{ status: string; complete: boolean }> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where:   { id: instanceId, orgId, status: 'active' },
      include: { definition: true },
    });

    if (!instance) throw new NotFoundException('Active workflow instance not found');

    const steps   = instance.definition.steps as unknown as WorkflowStep[];
    const current = steps[instance.currentStep];

    if (!current) throw new ConflictException('Workflow already at final step');

    // SoD: approver must differ from author / entity creator
    if (action === 'approved' || action === 'signed') {
      await this._validateSoD(orgId, instance.entityType, instance.entityId, actorId);
    }

    // Record history entry
    const historyEntry: StepHistoryEntry = {
      stepId:  current.id,
      actorId,
      action,
      at:      new Date().toISOString(),
      note,
    };

    const updatedHistory = [...(instance.stepHistory as unknown as StepHistoryEntry[]), historyEntry];

    if (action === 'rejected') {
      // Rejection terminates the workflow regardless of remaining steps
      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data:  {
          status:      'rejected',
          completedAt: new Date(),
          stepHistory: updatedHistory as any,
        },
      });

      this.logger.log(`Workflow rejected: instance=${instanceId} actor=${actorId}`);
      return { status: 'rejected', complete: true };
    }

    const isLastStep = instance.currentStep >= steps.length - 1;

    if (isLastStep) {
      // All steps complete → workflow approved/completed
      await this.prisma.workflowInstance.update({
        where: { id: instanceId },
        data:  {
          status:      'completed',
          completedAt: new Date(),
          stepHistory: updatedHistory as any,
        },
      });

      this.logger.log(`Workflow completed: instance=${instanceId} actor=${actorId}`);
      return { status: 'completed', complete: true };
    }

    // Advance to next step
    const nextStepIndex = instance.currentStep + 1;
    const nextStep      = steps[nextStepIndex];

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data:  {
        currentStep: nextStepIndex,
        stepHistory: updatedHistory as any,
      },
    });

    // Notify next step assignee
    await this._notifyStepAssignee(
      orgId, nextStep, instance.entityType, instance.entityId,
    ).catch(() => {});

    return { status: 'active', complete: false };
  }

  // ── Cancel / abort ─────────────────────────────────────────────────────────

  async cancelWorkflow(
    orgId:      string,
    instanceId: string,
    actorId:    string,
    reason?:    string,
  ): Promise<void> {
    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id: instanceId, orgId, status: 'active' },
    });
    if (!instance) throw new NotFoundException('Active workflow instance not found');

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data:  {
        status:      'cancelled',
        completedAt: new Date(),
        stepHistory: [
          ...(instance.stepHistory as unknown as StepHistoryEntry[]),
          { stepId: 'cancelled', actorId, action: 'rejected', at: new Date().toISOString(), note: reason },
        ] as any,
      },
    });
  }

  // ── Query helpers ──────────────────────────────────────────────────────────

  /** Returns the active workflow instance for an entity, or null if none. */
  async getActiveInstance(entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findFirst({
      where:   { entityType, entityId, status: 'active' },
      include: { definition: true },
    });
  }

  /** Check if an entity is currently locked in an active workflow. */
  async isLocked(entityType: string, entityId: string): Promise<boolean> {
    const instance = await this.getActiveInstance(entityType, entityId);
    return instance !== null;
  }

  /** List all instances for an entity (history). */
  async getHistory(orgId: string, entityType: string, entityId: string) {
    return this.prisma.workflowInstance.findMany({
      where:   { orgId, entityType, entityId },
      include: { definition: { select: { id: true, name: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** List + upsert workflow definitions for an org. */
  async listDefinitions(orgId: string, entityType?: string) {
    return this.prisma.workflowDefinition.findMany({
      where:   { orgId, ...(entityType ? { entityType } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDefinition(
    orgId:      string,
    entityType: string,
    name:       string,
    steps:      WorkflowStep[],
    isDefault   = false,
  ) {
    if (isDefault) {
      // Un-default any existing default for this entity type
      await this.prisma.workflowDefinition.updateMany({
        where: { orgId, entityType, isDefault: true },
        data:  { isDefault: false },
      });
    }

    return this.prisma.workflowDefinition.create({
      data: { orgId, entityType, name, steps: steps as any, isDefault },
    });
  }

  // ── SLA check (called by cron) ─────────────────────────────────────────────

  /**
   * Find active instances where the current step's SLA has been breached.
   * Sends escalation notification to the step assignee + their manager.
   */
  async checkSlaBreaches(): Promise<number> {
    const active = await this.prisma.workflowInstance.findMany({
      where:   { status: 'active' },
      include: { definition: true },
    });

    let escalated = 0;

    for (const instance of active) {
      try {
        const steps   = instance.definition.steps as unknown as WorkflowStep[];
        const current = steps[instance.currentStep];
        if (!current) continue;

        const slaDeadline = new Date(
          instance.startedAt.getTime() + current.slaHours * 3_600_000,
        );

        if (new Date() > slaDeadline) {
          const assigneeId = current.assigneeId;
          if (assigneeId) {
            await this.notifications.send(instance.orgId, assigneeId, {
              type:     'workflow.sla_breach',
              title:    `Approval overdue: ${instance.entityType}`,
              body:     `Step "${current.name}" SLA of ${current.slaHours}h has been breached. Please action immediately.`,
              href:     `/${instance.entityType.toLowerCase()}s/${instance.entityId}`,
              priority: 'high',
            }).catch(() => {});
          }
          escalated++;
        }
      } catch (err: any) {
        this.logger.warn(`SLA check failed for instance ${instance.id}: ${err.message}`);
      }
    }

    if (escalated > 0) {
      this.logger.warn(`[WorkflowSLA] ${escalated} instance(s) have breached SLA`);
    }

    return escalated;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _notifyStepAssignee(
    orgId:      string,
    step:       WorkflowStep,
    entityType: string,
    entityId:   string,
  ): Promise<void> {
    let assigneeId = step.assigneeId;

    if (!assigneeId && step.assigneeRole) {
      // Resolve role to user via ComplianceResponsibility
      const resp = await this.prisma.complianceResponsibility.findFirst({
        where:  { orgId, role: step.assigneeRole as any, isPrimary: true },
        select: { userId: true },
      });
      assigneeId = resp?.userId ?? null;
    }

    if (!assigneeId) return;

    await this.notifications.send(orgId, assigneeId, {
      type:     'workflow.step_assigned',
      title:    `Action required: ${step.name}`,
      body:     `You need to ${step.type} a ${entityType}. SLA: ${step.slaHours}h.`,
      href:     `/${entityType.toLowerCase()}s/${entityId}`,
      priority: 'high',
    });
  }

  private async _validateSoD(
    orgId:      string,
    entityType: string,
    entityId:   string,
    actorId:    string,
  ): Promise<void> {
    // For Documents: the approver must not be the document author
    if (entityType === 'Document') {
      const doc = await this.prisma.document.findFirst({
        where:  { id: entityId, orgId },
        select: { ownerId: true },
      });
      if (doc?.ownerId && doc.ownerId === actorId) {
        throw new ForbiddenException(
          'Segregation of duties violation: document author cannot approve their own document',
        );
      }
    }

    // For Policies: check authorId field
    if (entityType === 'Policy') {
      const policy = await this.prisma.policy.findFirst({
        where:  { id: entityId, orgId },
        select: { authorId: true } as any,
      });
      if ((policy as any)?.authorId && (policy as any).authorId === actorId) {
        throw new ForbiddenException(
          'Segregation of duties violation: policy author cannot approve their own policy',
        );
      }
    }
  }
}
