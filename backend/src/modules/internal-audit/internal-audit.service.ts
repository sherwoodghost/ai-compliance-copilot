import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationService } from '../../notifications/notification.service';

// ISO 9.2 control code — internal audit evidence maps here
const ISO_92_CONTROL_CODE = 'A.9.2';

// Default fieldwork checklist items (generated from scope control codes)
const FIELDWORK_CHECKLIST_ITEMS = [
  'Review policy documentation and version history',
  'Verify control implementation evidence',
  'Interview control owners and verify RACI assignments',
  'Check for SoD conflicts and access review completion',
  'Validate evidence currency (not expired)',
  'Test control effectiveness via sample testing',
  'Review corrective actions from prior audit',
];

export interface CreateAuditDto {
  title: string;
  auditYear: number;
  scope: string[];  // control codes
  auditorId: string;
  plannedStartAt: string;
  plannedEndAt: string;
}

export interface AddFindingDto {
  controlCode?: string;
  title: string;
  description: string;
  severity: string;  // major | minor | observation | opportunity
}

export interface CloseAuditDto {
  summary?: string;
}

@Injectable()
export class InternalAuditService {
  private readonly logger = new Logger(InternalAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async createAudit(orgId: string, actorId: string, dto: CreateAuditDto) {
    // Check for duplicate year (warn but allow)
    const existing = await this.prisma.internalAudit.findFirst({
      where: { orgId, auditYear: dto.auditYear },
    });

    const audit = await this.prisma.internalAudit.create({
      data: {
        orgId,
        title:         dto.title,
        auditYear:     dto.auditYear,
        scope:         dto.scope,
        auditorId:     dto.auditorId,
        status:        'planning',
        plannedStartAt: new Date(dto.plannedStartAt),
        plannedEndAt:   new Date(dto.plannedEndAt),
      },
    });

    // Notify auditor
    if (dto.auditorId !== actorId) {
      await this.notifications.send(orgId, dto.auditorId, {
        type:     'task.assigned',
        title:    `Internal audit assigned: ${dto.title}`,
        body:     `Planned ${new Date(dto.plannedStartAt).toLocaleDateString()} – ${new Date(dto.plannedEndAt).toLocaleDateString()}`,
        href:     `/internal-audit/${audit.id}`,
        priority: 'normal',
      });
    }

    this.logger.log(`Internal audit ${audit.id} created for year ${dto.auditYear} by ${actorId}`);
    return audit;
  }

  async listAudits(orgId: string) {
    return this.prisma.internalAudit.findMany({
      where: { orgId },
      orderBy: { auditYear: 'desc' },
      include: {
        findings: {
          select: { id: true, severity: true, status: true },
        },
      },
    });
  }

  async getAudit(orgId: string, id: string) {
    const audit = await this.prisma.internalAudit.findUnique({
      where: { id },
      include: {
        findings: {
          include: {
            correctiveActions: {
              select: { id: true, title: true, status: true, dueDate: true },
            },
          },
        },
      },
    });
    if (!audit || audit.orgId !== orgId) {
      throw new NotFoundException('Internal audit not found');
    }

    // Generate fieldwork checklist from scope
    const checklist = dto_fieldworkChecklist(audit.scope);

    return { ...audit, checklist };
  }

  // ─── Phase Transitions ────────────────────────────────────────────────────────

  async startFieldwork(orgId: string, id: string, actorId: string) {
    const audit = await this._getAndValidate(orgId, id);
    if (audit.status !== 'planning') {
      throw new BadRequestException('Audit must be in planning phase to start fieldwork');
    }
    return this.prisma.internalAudit.update({
      where: { id },
      data: { status: 'fieldwork', actualStartAt: new Date() },
    });
  }

  async startReporting(orgId: string, id: string, actorId: string) {
    const audit = await this._getAndValidate(orgId, id);
    if (audit.status !== 'fieldwork') {
      throw new BadRequestException('Audit must be in fieldwork phase to start reporting');
    }
    return this.prisma.internalAudit.update({
      where: { id },
      data: { status: 'reporting' },
    });
  }

  async closeAudit(orgId: string, id: string, actorId: string, dto: CloseAuditDto = {}) {
    const audit = await this._getAndValidateWithFindings(orgId, id);

    if (audit.status !== 'reporting') {
      throw new BadRequestException('Audit must be in reporting phase to close');
    }

    // Cannot close with open major findings
    const openMajor = (audit.findings ?? []).filter(
      (f: any) => f.severity === 'major' && f.status !== 'closed' && f.status !== 'accepted_risk',
    );
    if (openMajor.length > 0) {
      throw new BadRequestException(
        `Cannot close audit: ${openMajor.length} major finding(s) still open. Close or accept-risk each major finding first.`,
      );
    }

    const now = new Date();

    // Find ISO 9.2 control
    const isoControl = await this.prisma.control.findFirst({
      where: { code: ISO_92_CONTROL_CODE },
      select: { id: true },
    });

    // Summarize findings for evidence
    const totalFindings  = audit.findings?.length ?? 0;
    const closedFindings = (audit.findings ?? []).filter((f: any) => f.status === 'closed' || f.status === 'accepted_risk').length;
    const openMinor      = (audit.findings ?? []).filter((f: any) => f.severity === 'minor' && f.status !== 'closed' && f.status !== 'accepted_risk').length;

    const summary = dto.summary ??
      `Internal audit ${audit.title} (${audit.auditYear}) completed. ` +
      `${totalFindings} finding(s) identified: ${closedFindings} resolved, ${openMinor} minor observation(s) remaining. ` +
      `Scope: ${(audit.scope ?? []).join(', ')}.`;

    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        controlId: isoControl?.id ?? '',
        title:     `Internal Audit Report: ${audit.title} (${audit.auditYear})`,
        type:      'document',
        source:    'agent_generated',
        reviewedBy: actorId,
        metadata: {
          auditId:        audit.id,
          auditYear:      audit.auditYear,
          scope:          audit.scope,
          totalFindings,
          closedFindings,
          summary,
          closedBy:       actorId,
          closedAt:       now.toISOString(),
        },
      },
    });

    if (isoControl) {
      await this.prisma.controlEvidence.create({
        data: { evidenceId: evidence.id, controlId: isoControl.id, orgId, confidence: 95, mappedBy: actorId },
      }).catch(() => {});
    }

    const updated = await this.prisma.internalAudit.update({
      where: { id },
      data: { status: 'closed', actualEndAt: now, evidenceId: evidence.id },
    });

    this.logger.log(`Internal audit ${id} closed by ${actorId}. Evidence ${evidence.id} generated for ISO 9.2.`);
    return updated;
  }

  // ─── Findings ─────────────────────────────────────────────────────────────────

  async addFinding(orgId: string, auditId: string, actorId: string, dto: AddFindingDto) {
    const audit = await this._getAndValidate(orgId, auditId);
    if (audit.status === 'closed') {
      throw new BadRequestException('Cannot add findings to a closed audit');
    }

    // Resolve controlId from code if provided
    let controlId: string | undefined;
    if (dto.controlCode) {
      const control = await this.prisma.control.findFirst({
        where: { code: dto.controlCode },
        select: { id: true },
      });
      controlId = control?.id;
    }

    const finding = await this.prisma.internalAuditFinding.create({
      data: {
        auditId,
        orgId,
        controlId:   controlId ?? null,
        controlCode: dto.controlCode ?? null,
        title:       dto.title,
        description: dto.description,
        severity:    dto.severity as any,
        status:      'open',
      },
    });

    // Auto-create corrective action for major findings
    if (dto.severity === 'major') {
      // Find control owner for assignment
      const raciOwner = controlId
        ? await this.prisma.raciAssignment.findFirst({
            where: { controlId, raci: 'A' },
            select: { userId: true },
          })
        : null;

      const assignee = raciOwner?.userId ?? actorId;
      const dueDate  = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days

      await this.prisma.correctiveAction.create({
        data: {
          orgId,
          auditFindingId: finding.id,
          title:          `Remediate: ${dto.title}`,
          description:    `Corrective action for major audit finding: ${dto.description}`,
          assignedTo:     assignee,
          dueDate,
          status:         'open',
        },
      });

      if (assignee !== actorId) {
        await this.notifications.send(orgId, assignee, {
          type:     'task.assigned',
          title:    `Major audit finding requires remediation: ${dto.title}`,
          body:     `Due in 30 days`,
          href:     `/internal-audit/${auditId}`,
          priority: 'high',
        });
      }
    }

    return finding;
  }

  async closeFinding(orgId: string, auditId: string, findingId: string, actorId: string) {
    await this._getAndValidate(orgId, auditId);
    const finding = await this.prisma.internalAuditFinding.findUnique({ where: { id: findingId } });
    if (!finding || finding.orgId !== orgId || finding.auditId !== auditId) {
      throw new NotFoundException('Audit finding not found');
    }
    return this.prisma.internalAuditFinding.update({
      where: { id: findingId },
      data: { status: 'closed', closedAt: new Date(), closedBy: actorId },
    });
  }

  async acceptRiskFinding(orgId: string, auditId: string, findingId: string, actorId: string) {
    await this._getAndValidate(orgId, auditId);
    const finding = await this.prisma.internalAuditFinding.findUnique({ where: { id: findingId } });
    if (!finding || finding.orgId !== orgId || finding.auditId !== auditId) {
      throw new NotFoundException('Audit finding not found');
    }
    return this.prisma.internalAuditFinding.update({
      where: { id: findingId },
      data: { status: 'accepted_risk' },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private async _getAndValidate(orgId: string, id: string) {
    const audit = await this.prisma.internalAudit.findUnique({ where: { id } });
    if (!audit || audit.orgId !== orgId) {
      throw new NotFoundException('Internal audit not found');
    }
    return audit;
  }

  private async _getAndValidateWithFindings(orgId: string, id: string) {
    const audit = await this.prisma.internalAudit.findUnique({
      where: { id },
      include: { findings: { select: { id: true, severity: true, status: true } } },
    });
    if (!audit || audit.orgId !== orgId) {
      throw new NotFoundException('Internal audit not found');
    }
    return audit;
  }
}

// ─── Fieldwork checklist generator ───────────────────────────────────────────

function dto_fieldworkChecklist(scope: string[]): Array<{ item: string; controlCode?: string; done: boolean }> {
  const items: Array<{ item: string; controlCode?: string; done: boolean }> = [];

  // Generic checklist items
  FIELDWORK_CHECKLIST_ITEMS.forEach((item) => {
    items.push({ item, done: false });
  });

  // Per-control items
  scope.slice(0, 20).forEach((code) => {
    items.push({
      item:        `Verify ${code} control — review evidence and test operation`,
      controlCode: code,
      done:        false,
    });
  });

  return items;
}
