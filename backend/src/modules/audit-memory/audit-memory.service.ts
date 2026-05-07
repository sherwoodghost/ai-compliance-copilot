import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export class CreateAuditCycleDto {
  framework: string;
  label: string;
  startDate: string;
  endDate?: string;
  auditorName?: string;
  auditorFirm?: string;
  notes?: string;
}

export class UpdateAuditCycleDto {
  status?: string;
  endDate?: string;
  outcome?: string;
  auditorName?: string;
  auditorFirm?: string;
  notes?: string;
}

export class CreateFindingDto {
  auditCycleId: string;
  controlId?: string;
  findingType: string;
  severity?: string;
  title: string;
  description: string;
  remediation?: string;
  lessonLearned?: string;
}

export class UpdateFindingDto {
  status?: string;
  remediation?: string;
  lessonLearned?: string;
  resolvedAt?: string;
}

@Injectable()
export class AuditMemoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Audit Cycles ─────────────────────────────────────────────────────────────

  async listCycles(orgId: string) {
    return this.prisma.auditCycle.findMany({
      where: { orgId },
      include: {
        creator: { select: { id: true, fullName: true } },
        _count: { select: { findings: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async getCycle(orgId: string, cycleId: string) {
    const cycle = await this.prisma.auditCycle.findFirst({
      where: { id: cycleId, orgId },
      include: {
        creator: { select: { id: true, fullName: true } },
        findings: {
          include: {
            control: { select: { id: true, code: true, title: true } },
            resolver: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Audit cycle not found');
    return cycle;
  }

  async createCycle(orgId: string, dto: CreateAuditCycleDto, userId: string) {
    return this.prisma.auditCycle.create({
      data: {
        orgId,
        framework: dto.framework,
        label: dto.label,
        startDate: new Date(dto.startDate),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        auditorName: dto.auditorName,
        auditorFirm: dto.auditorFirm,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  async updateCycle(orgId: string, cycleId: string, dto: UpdateAuditCycleDto) {
    const cycle = await this.prisma.auditCycle.findFirst({ where: { id: cycleId, orgId } });
    if (!cycle) throw new NotFoundException('Audit cycle not found');

    return this.prisma.auditCycle.update({
      where: { id: cycleId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.outcome !== undefined && { outcome: dto.outcome }),
        ...(dto.auditorName !== undefined && { auditorName: dto.auditorName }),
        ...(dto.auditorFirm !== undefined && { auditorFirm: dto.auditorFirm }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  // ─── Findings ─────────────────────────────────────────────────────────────────

  async listFindings(orgId: string, cycleId?: string, status?: string) {
    return this.prisma.auditFinding.findMany({
      where: {
        orgId,
        ...(cycleId && { auditCycleId: cycleId }),
        ...(status && { status }),
      },
      include: {
        auditCycle: { select: { id: true, label: true, framework: true } },
        control: { select: { id: true, code: true, title: true } },
        resolver: { select: { id: true, fullName: true } },
      },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createFinding(orgId: string, dto: CreateFindingDto) {
    // Verify cycle belongs to org
    const cycle = await this.prisma.auditCycle.findFirst({
      where: { id: dto.auditCycleId, orgId },
    });
    if (!cycle) throw new NotFoundException('Audit cycle not found');

    return this.prisma.auditFinding.create({
      data: {
        orgId,
        auditCycleId: dto.auditCycleId,
        controlId: dto.controlId,
        findingType: dto.findingType,
        severity: dto.severity ?? 'medium',
        title: dto.title,
        description: dto.description,
        remediation: dto.remediation,
        lessonLearned: dto.lessonLearned,
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async updateFinding(orgId: string, findingId: string, dto: UpdateFindingDto, userId: string) {
    const finding = await this.prisma.auditFinding.findFirst({
      where: { id: findingId, orgId },
    });
    if (!finding) throw new NotFoundException('Finding not found');

    return this.prisma.auditFinding.update({
      where: { id: findingId },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.remediation !== undefined && { remediation: dto.remediation }),
        ...(dto.lessonLearned !== undefined && { lessonLearned: dto.lessonLearned }),
        ...(dto.status === 'resolved' && {
          resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : new Date(),
          resolvedBy: userId,
        }),
      },
    });
  }

  // ─── Summary / Stats ──────────────────────────────────────────────────────────

  async getStats(orgId: string) {
    const [totalCycles, activeCycle, totalFindings, openFindings, lessonsLearned] =
      await Promise.all([
        this.prisma.auditCycle.count({ where: { orgId } }),
        this.prisma.auditCycle.findFirst({
          where: { orgId, status: 'active' },
          orderBy: { startDate: 'desc' },
          select: { id: true, label: true, framework: true, startDate: true },
        }),
        this.prisma.auditFinding.count({ where: { orgId } }),
        this.prisma.auditFinding.count({ where: { orgId, status: { in: ['open', 'in_progress'] } } }),
        this.prisma.auditFinding.count({
          where: { orgId, lessonLearned: { not: null }, status: 'resolved' },
        }),
      ]);

    return { totalCycles, activeCycle, totalFindings, openFindings, lessonsLearned };
  }
}
