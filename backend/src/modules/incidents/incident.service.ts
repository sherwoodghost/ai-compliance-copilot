import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../notifications/notification.service';

// SLA hours by severity (time to contain)
const SLA_HOURS: Record<string, number> = {
  CRITICAL:      4,
  HIGH:          24,
  MEDIUM:        72,
  LOW:           168,
  INFORMATIONAL: 720,
};

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  detected:     ['triaging'],
  triaging:     ['contained', 'detected'],
  contained:    ['eradicating', 'triaging'],
  eradicating:  ['recovering', 'contained'],
  recovering:   ['closed', 'eradicating'],
  closed:       [],
};

// ISO control codes covered by an incident close
const INCIDENT_CONTROL_CODES = ['A.5.24', 'A.5.25', 'A.5.26', 'A.5.27'];

export interface CreateIncidentDto {
  title: string;
  description: string;
  severity: string;
  category: string;
  detectedAt?: string;
  affectedSystems?: string[];
  impactedUsers?: number;
  dataClassification?: string;
  assignedTo?: string;
}

export interface UpdateIncidentDto {
  title?: string;
  description?: string;
  severity?: string;
  category?: string;
  assignedTo?: string;
  affectedSystems?: string[];
  impactedUsers?: number;
  dataClassification?: string;
  rootCause?: string;
  lessonsLearned?: string;
  note?: string; // for timeline entry
}

export interface CloseIncidentDto {
  rootCause: string;
  lessonsLearned: string;
}

export interface CreateCorrectiveActionDto {
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
}

@Injectable()
export class IncidentService {
  private readonly logger = new Logger(IncidentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createIncident(orgId: string, actorId: string, dto: CreateIncidentDto) {
    const detectedAt = dto.detectedAt ? new Date(dto.detectedAt) : new Date();

    const incident = await this.prisma.securityIncident.create({
      data: {
        orgId,
        title: dto.title,
        description: dto.description,
        severity:    dto.severity as any,
        status:      'detected',
        category:    dto.category as any,
        detectedAt,
        reportedBy:  actorId,
        assignedTo:  dto.assignedTo ?? null,
        affectedSystems:    dto.affectedSystems ?? [],
        impactedUsers:      dto.impactedUsers ?? null,
        dataClassification: dto.dataClassification ?? null,
        timeline: [
          {
            at:      new Date().toISOString(),
            actorId,
            action:  'created',
            note:    `Incident created with severity ${dto.severity}`,
          },
        ],
        notifications: [],
        controlIds:    INCIDENT_CONTROL_CODES,
      },
    });

    // Notify SECURITY_LEAD and COMPLIANCE_LEAD
    await this._notifyLeads(orgId, actorId, incident, 'incident.opened',
      `New ${dto.severity} incident: ${dto.title}`,
      dto.description,
      `/incidents/${incident.id}`,
    );

    this.logger.log(`Incident ${incident.id} created (${dto.severity}) by ${actorId}`);
    return incident;
  }

  async listIncidents(
    orgId: string,
    filters: { status?: string; severity?: string; category?: string } = {},
  ) {
    const where: any = { orgId };
    if (filters.status)   where.status   = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.category) where.category = filters.category;

    const [incidents, counts] = await Promise.all([
      this.prisma.securityIncident.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        include: { correctiveActions: { select: { id: true, status: true } } },
      }),
      this.prisma.securityIncident.groupBy({
        by: ['severity'],
        where: { orgId, status: { not: 'closed' } },
        _count: { id: true },
      }),
    ]);

    return { incidents, openBySeverity: counts };
  }

  async getIncident(orgId: string, id: string) {
    const incident = await this.prisma.securityIncident.findUnique({
      where: { id },
      include: { correctiveActions: true },
    });
    if (!incident || incident.orgId !== orgId) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  // ─── Status Transitions ───────────────────────────────────────────────────────

  async updateStatus(orgId: string, id: string, actorId: string, newStatus: string, note?: string) {
    const incident = await this._getAndValidate(orgId, id);

    const allowed = VALID_TRANSITIONS[incident.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${incident.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
      );
    }

    const timelineEntry = {
      at:      new Date().toISOString(),
      actorId,
      action:  `status.${newStatus}`,
      note:    note ?? `Status changed to ${newStatus}`,
    };

    const timestampFields: any = {};
    if (newStatus === 'contained')  timestampFields.containedAt = new Date();
    if (newStatus === 'closed')     timestampFields.closedAt    = new Date();
    if (newStatus === 'recovering') timestampFields.resolvedAt  = new Date();

    const updated = await this.prisma.securityIncident.update({
      where: { id },
      data: {
        status: newStatus as any,
        ...timestampFields,
        timeline: { push: timelineEntry },
      },
    });

    return updated;
  }

  // ─── Update Fields ────────────────────────────────────────────────────────────

  async updateIncident(orgId: string, id: string, actorId: string, dto: UpdateIncidentDto) {
    await this._getAndValidate(orgId, id);

    const { note, ...fields } = dto;

    const timelineEntry = {
      at:     new Date().toISOString(),
      actorId,
      action: 'updated',
      note:   note ?? 'Incident details updated',
    };

    const data: any = { timeline: { push: timelineEntry } };
    if (fields.title)              data.title              = fields.title;
    if (fields.description)        data.description        = fields.description;
    if (fields.severity)           data.severity           = fields.severity;
    if (fields.category)           data.category           = fields.category;
    if (fields.assignedTo !== undefined) data.assignedTo   = fields.assignedTo;
    if (fields.affectedSystems)    data.affectedSystems    = fields.affectedSystems;
    if (fields.impactedUsers !== undefined) data.impactedUsers = fields.impactedUsers;
    if (fields.dataClassification !== undefined) data.dataClassification = fields.dataClassification;
    if (fields.rootCause !== undefined) data.rootCause     = fields.rootCause;
    if (fields.lessonsLearned !== undefined) data.lessonsLearned = fields.lessonsLearned;

    return this.prisma.securityIncident.update({ where: { id }, data });
  }

  // ─── Close ────────────────────────────────────────────────────────────────────

  async closeIncident(orgId: string, id: string, actorId: string, dto: CloseIncidentDto) {
    const incident = await this._getAndValidate(orgId, id);

    if (incident.status === 'closed') {
      throw new BadRequestException('Incident is already closed');
    }

    if (!dto.rootCause || !dto.lessonsLearned) {
      throw new BadRequestException('rootCause and lessonsLearned are required to close an incident');
    }

    // For CRITICAL severity: all corrective actions must be closed
    if (incident.severity === 'CRITICAL') {
      const openActions = incident.correctiveActions?.filter((a: any) => a.status !== 'closed') ?? [];
      if (openActions.length > 0) {
        throw new BadRequestException(
          `Cannot close CRITICAL incident: ${openActions.length} corrective action(s) still open`,
        );
      }
    }

    // Require at least one corrective action
    const totalActions = incident.correctiveActions?.length ?? 0;
    if (totalActions === 0) {
      throw new BadRequestException('At least one corrective action is required before closing an incident');
    }

    const now = new Date();

    // Find ISO control codes for evidence mapping
    const controls = await this.prisma.control.findMany({
      where: { code: { in: INCIDENT_CONTROL_CODES } },
      select: { id: true, code: true },
    });

    // Generate evidence record
    const mttd = incident.detectedAt
      ? Math.round((now.getTime() - new Date(incident.detectedAt).getTime()) / 60000)
      : null;
    const mttr = incident.containedAt
      ? Math.round((now.getTime() - new Date(incident.containedAt).getTime()) / 60000)
      : null;

    const evidenceTitle = `Incident Closure Report: ${incident.title}`;
    const evidenceMeta  = {
      incidentId:    incident.id,
      rootCause:     dto.rootCause,
      lessonsLearned: dto.lessonsLearned,
      mttdMinutes:   mttd,
      mttrMinutes:   mttr,
      closedBy:      actorId,
      severity:      incident.severity,
      category:      incident.category,
    };

    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        controlId:  controls[0]?.id ?? '',
        title:      evidenceTitle,
        type:       'document',
        source:     'agent_generated',
        reviewedBy: actorId,
        metadata:   evidenceMeta,
      },
    });

    // Map evidence to all ISO A.5.24–A.5.27 controls
    await Promise.allSettled(
      controls.map((c) =>
        this.prisma.controlEvidence.create({
          data: { evidenceId: evidence.id, controlId: c.id, orgId, confidence: 95, mappedBy: actorId },
        }).catch(() => {}),
      ),
    );

    const timelineEntry = {
      at:      now.toISOString(),
      actorId,
      action:  'closed',
      note:    `Incident closed. Root cause: ${dto.rootCause}`,
    };

    const updated = await this.prisma.securityIncident.update({
      where: { id },
      data: {
        status:        'closed',
        closedAt:       now,
        resolvedAt:     incident.resolvedAt ?? now,
        rootCause:      dto.rootCause,
        lessonsLearned: dto.lessonsLearned,
        evidenceId:     evidence.id,
        timeline:       { push: timelineEntry },
      },
    });

    this.logger.log(`Incident ${id} closed by ${actorId}. Evidence ${evidence.id} generated.`);
    return updated;
  }

  // ─── Corrective Actions ───────────────────────────────────────────────────────

  async addCorrectiveAction(orgId: string, incidentId: string, actorId: string, dto: CreateCorrectiveActionDto) {
    await this._getAndValidate(orgId, incidentId);

    const action = await this.prisma.correctiveAction.create({
      data: {
        orgId,
        incidentId,
        title:       dto.title,
        description: dto.description,
        assignedTo:  dto.assignedTo,
        dueDate:     new Date(dto.dueDate),
        status:      'open',
      },
    });

    // Notify the assignee
    if (dto.assignedTo !== actorId) {
      await this.notifications.send(orgId, dto.assignedTo, {
        type:     'task.assigned',
        title:    `Corrective action assigned: ${dto.title}`,
        body:     `Due: ${new Date(dto.dueDate).toLocaleDateString()}`,
        href:     `/incidents/${incidentId}`,
        priority: 'high',
      });
    }

    return action;
  }

  async closeCorrectiveAction(orgId: string, incidentId: string, actionId: string, actorId: string) {
    await this._getAndValidate(orgId, incidentId);

    const action = await this.prisma.correctiveAction.findUnique({ where: { id: actionId } });
    if (!action || action.orgId !== orgId || action.incidentId !== incidentId) {
      throw new NotFoundException('Corrective action not found');
    }

    return this.prisma.correctiveAction.update({
      where: { id: actionId },
      data: { status: 'closed', completedAt: new Date() },
    });
  }

  // ─── Metrics ──────────────────────────────────────────────────────────────────

  async getMetrics(orgId: string) {
    const [all, open, closed] = await Promise.all([
      this.prisma.securityIncident.findMany({
        where: { orgId },
        select: {
          severity: true, category: true, status: true,
          detectedAt: true, containedAt: true, closedAt: true,
        },
      }),
      this.prisma.securityIncident.count({ where: { orgId, status: { not: 'closed' } } }),
      this.prisma.securityIncident.findMany({
        where: { orgId, status: 'closed', containedAt: { not: undefined }, detectedAt: { not: undefined } },
        select: { detectedAt: true, containedAt: true, closedAt: true },
      }),
    ]);

    // MTTD: mean time to detect (avg minutes from detectedAt to now, for open; or to closedAt)
    const mttdValues = all
      .filter((i) => i.detectedAt)
      .map((i) => {
        const end = i.closedAt ? new Date(i.closedAt) : new Date();
        return (end.getTime() - new Date(i.detectedAt).getTime()) / 60000;
      });
    const mttd = mttdValues.length ? Math.round(mttdValues.reduce((a, b) => a + b, 0) / mttdValues.length) : null;

    // MTTR: mean time to resolve (detectedAt → containedAt for closed incidents)
    const mttrValues = closed
      .filter((i) => i.containedAt && i.detectedAt)
      .map((i) => (new Date(i.containedAt!).getTime() - new Date(i.detectedAt).getTime()) / 60000);
    const mttr = mttrValues.length ? Math.round(mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length) : null;

    // By severity
    const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'].map((s) => ({
      severity: s,
      total: all.filter((i) => i.severity === s).length,
      open:  all.filter((i) => i.severity === s && i.status !== 'closed').length,
    }));

    // By category
    const categoryMap = new Map<string, number>();
    all.forEach((i) => categoryMap.set(i.category, (categoryMap.get(i.category) ?? 0) + 1));
    const byCategory = Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count }));

    // Monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recent = all.filter((i) => new Date(i.detectedAt) > sixMonthsAgo);
    const monthlyMap = new Map<string, number>();
    recent.forEach((i) => {
      const key = new Date(i.detectedAt).toISOString().slice(0, 7); // YYYY-MM
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + 1);
    });
    const monthlyTrend = Array.from(monthlyMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      total: all.length,
      open,
      mttdMinutes: mttd,
      mttrMinutes: mttr,
      bySeverity,
      byCategory,
      monthlyTrend,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async _getAndValidate(orgId: string, id: string) {
    const incident = await this.prisma.securityIncident.findUnique({
      where: { id },
      include: { correctiveActions: { select: { id: true, status: true } } },
    });
    if (!incident || incident.orgId !== orgId) {
      throw new NotFoundException('Incident not found');
    }
    return incident;
  }

  private async _notifyLeads(
    orgId: string,
    actorId: string,
    incident: any,
    type: string,
    title: string,
    body: string,
    href: string,
  ) {
    const leads = await this.prisma.complianceResponsibility.findMany({
      where: { orgId, role: { in: ['SECURITY_LEAD', 'COMPLIANCE_LEAD'] as any[] } },
      select: { userId: true },
    });

    await Promise.allSettled(
      leads
        .filter((l) => l.userId !== actorId)
        .map((l) =>
          this.notifications.send(orgId, l.userId, {
            type,
            title,
            body,
            href,
            priority: incident.severity === 'CRITICAL' || incident.severity === 'HIGH' ? 'high' : 'normal',
          }),
        ),
    );
  }
}
