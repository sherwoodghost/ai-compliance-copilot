import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateNonconformityDto, UpdateNonconformityDto,
  CreateQualityObjectiveDto, RecordMeasurementDto,
  CreateProcessAuditDto, UpdateProcessAuditDto,
} from './dto/quality.dto';

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Nonconformities ───────────────────────────────────────────────────────

  async listNcrs(orgId: string, status?: string) {
    return this.prisma.nonconformity.findMany({
      where: { orgId, ...(status ? { status: status as any } : {}) },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async createNcr(orgId: string, dto: CreateNonconformityDto) {
    return this.prisma.nonconformity.create({
      data: {
        orgId,
        title: dto.title,
        description: dto.description,
        source: dto.source as any,
        severity: (dto.severity as any) ?? 'minor',
        status: 'open',
        detectedAt: new Date(),
        reportedBy: dto.reportedBy,
        assignedTo: dto.assignedTo,
      },
    });
  }

  async updateNcr(orgId: string, id: string, dto: UpdateNonconformityDto) {
    const existing = await this.prisma.nonconformity.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Nonconformity not found');
    return this.prisma.nonconformity.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.rootCause && { rootCause: dto.rootCause }),
        ...(dto.capaId && { capaId: dto.capaId }),
        ...(dto.notes && { notes: dto.notes }),
        ...(dto.containedAt && { containedAt: new Date(dto.containedAt) }),
        ...(dto.closedAt && { closedAt: new Date(dto.closedAt) }),
        ...(dto.closedBy && { closedBy: dto.closedBy }),
      },
    });
  }

  // ── Quality Objectives ────────────────────────────────────────────────────

  async listObjectives(orgId: string) {
    return this.prisma.qualityObjective.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createObjective(orgId: string, dto: CreateQualityObjectiveDto) {
    return this.prisma.qualityObjective.create({
      data: {
        orgId,
        metric: dto.metric,
        target: dto.target,
        unit: dto.unit,
        targetDirection: dto.targetDirection ?? 'above',
        measurementFrequency: dto.measurementFrequency ?? 'monthly',
        ownerId: dto.ownerId,
        measurements: [],
      },
    });
  }

  async recordMeasurement(orgId: string, id: string, dto: RecordMeasurementDto) {
    const obj = await this.prisma.qualityObjective.findFirst({ where: { id, orgId } });
    if (!obj) throw new NotFoundException('Quality objective not found');

    const newMeasurement = { value: dto.value, measuredAt: new Date().toISOString(), note: dto.note };
    return this.prisma.qualityObjective.update({
      where: { id },
      data: {
        currentValue: dto.value,
        measurements: { push: newMeasurement },
      },
    });
  }

  // ── Process Audits ────────────────────────────────────────────────────────

  async listAudits(orgId: string) {
    return this.prisma.processAudit.findMany({
      where: { orgId },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createAudit(orgId: string, dto: CreateProcessAuditDto) {
    return this.prisma.processAudit.create({
      data: {
        orgId,
        processName: dto.processName,
        scheduledAt: new Date(dto.scheduledAt),
        auditorId: dto.auditorId,
        status: 'scheduled',
        findings: [],
      },
    });
  }

  async updateAudit(orgId: string, id: string, dto: UpdateProcessAuditDto) {
    const existing = await this.prisma.processAudit.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Process audit not found');
    return this.prisma.processAudit.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.findings && { findings: dto.findings }),
        ...(dto.notes && { notes: dto.notes }),
        ...(dto.completedAt && { completedAt: new Date(dto.completedAt) }),
        ...(dto.evidenceId && { evidenceId: dto.evidenceId }),
      },
    });
  }

  // ── Dashboard Stats ───────────────────────────────────────────────────────

  async getDashboardStats(orgId: string) {
    const [ncrs, objectives, audits] = await Promise.all([
      this.prisma.nonconformity.findMany({
        where: { orgId, status: { notIn: ['closed'] } },
        select: { id: true, severity: true, status: true, detectedAt: true },
      }),
      this.prisma.qualityObjective.findMany({
        where: { orgId },
        select: { id: true, metric: true, target: true, unit: true, currentValue: true, targetDirection: true },
      }),
      this.prisma.processAudit.findMany({
        where: { orgId, status: { notIn: ['completed'] } },
        select: { id: true, processName: true, scheduledAt: true, status: true },
      }),
    ]);

    const now = new Date();
    const overdue30 = ncrs.filter((n) => {
      const age = (now.getTime() - n.detectedAt.getTime()) / (1000 * 60 * 60 * 24);
      return age > 30;
    }).length;
    const overdueAudits = audits.filter((a) => a.scheduledAt < now && a.status === 'scheduled').length;

    const objectivesOnTrack = objectives.filter((o) => {
      if (o.currentValue === null) return false;
      if (o.targetDirection === 'above') return o.currentValue >= o.target;
      if (o.targetDirection === 'below') return o.currentValue <= o.target;
      return Math.abs(o.currentValue - o.target) < 0.01;
    }).length;

    return {
      openNcrs: ncrs.length,
      ncrsMajor: ncrs.filter((n) => n.severity === 'major').length,
      ncrsOverdue30Days: overdue30,
      totalObjectives: objectives.length,
      objectivesOnTrack,
      objectivesAtRisk: objectives.length - objectivesOnTrack,
      openAudits: audits.length,
      overdueAudits,
    };
  }
}
