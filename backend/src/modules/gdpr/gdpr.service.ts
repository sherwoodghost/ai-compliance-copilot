import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateProcessingActivityDto, UpdateProcessingActivityDto,
  CreateDsarDto, UpdateDsarDto,
  CreateDpiaDto,
  CreateBreachNotificationDto, UpdateBreachNotificationDto,
} from './dto/gdpr.dto';

@Injectable()
export class GdprService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Processing Activities (ROPA) ──────────────────────────────────────────

  async listActivities(orgId: string) {
    return this.prisma.gdprProcessingActivity.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createActivity(orgId: string, dto: CreateProcessingActivityDto) {
    return this.prisma.gdprProcessingActivity.create({
      data: {
        orgId,
        name: dto.name,
        purpose: dto.purpose,
        lawfulBasis: dto.lawfulBasis as any,
        dataCategories: dto.dataCategories ?? [],
        dataSubjects: dto.dataSubjects ?? [],
        retentionPeriod: dto.retentionPeriod,
        internationalTransfers: dto.internationalTransfers ?? false,
        transferMechanisms: dto.transferMechanisms ?? [],
        processorName: dto.processorName,
        dpaRequired: dto.dpaRequired ?? false,
        dpaSigned: dto.dpaSigned ?? false,
        dpiaRequired: dto.dpiaRequired ?? false,
        notes: dto.notes,
      },
    });
  }

  async updateActivity(orgId: string, id: string, dto: UpdateProcessingActivityDto) {
    const existing = await this.prisma.gdprProcessingActivity.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Processing activity not found');
    return this.prisma.gdprProcessingActivity.update({
      where: { id },
      data: { ...dto, lawfulBasis: dto.lawfulBasis as any },
    });
  }

  async deleteActivity(orgId: string, id: string) {
    const existing = await this.prisma.gdprProcessingActivity.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Processing activity not found');
    return this.prisma.gdprProcessingActivity.delete({ where: { id } });
  }

  // ── DSAR Queue ────────────────────────────────────────────────────────────

  async listDsars(orgId: string, status?: string) {
    return this.prisma.dataSubjectRequest.findMany({
      where: { orgId, ...(status ? { status: status as any } : {}) },
      orderBy: { dueAt: 'asc' },
    });
  }

  async createDsar(orgId: string, dto: CreateDsarDto) {
    const receivedAt = new Date();
    const dueAt = new Date(receivedAt.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
    return this.prisma.dataSubjectRequest.create({
      data: {
        orgId,
        type: dto.type as any,
        status: 'received',
        receivedAt,
        dueAt,
        requestorEmail: dto.requestorEmail,
        description: dto.description,
        assignedTo: dto.assignedTo,
      },
    });
  }

  async updateDsar(orgId: string, id: string, dto: UpdateDsarDto) {
    const existing = await this.prisma.dataSubjectRequest.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('DSAR not found');
    return this.prisma.dataSubjectRequest.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.assignedTo && { assignedTo: dto.assignedTo }),
        ...(dto.notes && { notes: dto.notes }),
        ...(dto.completedAt && { completedAt: new Date(dto.completedAt) }),
      },
    });
  }

  // ── DPIA Register ─────────────────────────────────────────────────────────

  async listDpias(orgId: string) {
    return this.prisma.dpiaRecord.findMany({
      where: { orgId },
      orderBy: { triggeredAt: 'desc' },
    });
  }

  async createDpia(orgId: string, dto: CreateDpiaDto) {
    return this.prisma.dpiaRecord.create({
      data: {
        orgId,
        processingActivityId: dto.processingActivityId,
        title: dto.title,
        status: 'required',
        triggeredAt: new Date(),
      },
    });
  }

  // ── Breach Notifications ──────────────────────────────────────────────────

  async listBreaches(orgId: string) {
    return this.prisma.breachNotification.findMany({
      where: { orgId },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async createBreach(orgId: string, dto: CreateBreachNotificationDto) {
    const detectedAt = new Date(dto.detectedAt);
    const deadlineAt = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000); // +72 hours

    return this.prisma.breachNotification.create({
      data: {
        orgId,
        incidentId: dto.incidentId,
        status: 'detected',
        detectedAt,
        deadlineAt,
        breachDescription: dto.breachDescription,
        affectedDataSubjects: dto.affectedDataSubjects,
        affectedDataCategories: dto.affectedDataCategories ?? [],
        likelyConsequences: dto.likelyConsequences,
        measuresAdopted: dto.measuresAdopted,
      },
    });
  }

  async updateBreach(orgId: string, id: string, dto: UpdateBreachNotificationDto) {
    const existing = await this.prisma.breachNotification.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Breach notification not found');
    return this.prisma.breachNotification.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.supervisoryNotifiedAt && { supervisoryNotifiedAt: new Date(dto.supervisoryNotifiedAt) }),
        ...(dto.dataSubjectsNotifiedAt && { dataSubjectsNotifiedAt: new Date(dto.dataSubjectsNotifiedAt) }),
        ...(dto.supervisoryAuthority && { supervisoryAuthority: dto.supervisoryAuthority }),
        ...(dto.breachDescription && { breachDescription: dto.breachDescription }),
        ...(dto.likelyConsequences && { likelyConsequences: dto.likelyConsequences }),
        ...(dto.measuresAdopted && { measuresAdopted: dto.measuresAdopted }),
      },
    });
  }

  // ── Dashboard Stats ───────────────────────────────────────────────────────

  async getDashboardStats(orgId: string) {
    const [activities, dsars, dpias, breaches] = await Promise.all([
      this.prisma.gdprProcessingActivity.count({ where: { orgId } }),
      this.prisma.dataSubjectRequest.findMany({
        where: { orgId, status: { notIn: ['completed', 'denied'] } },
        select: { id: true, dueAt: true, status: true },
      }),
      this.prisma.dpiaRecord.count({ where: { orgId, status: { in: ['required', 'in_progress'] } } }),
      this.prisma.breachNotification.findMany({
        where: { orgId, status: { notIn: ['closed'] } },
        select: { id: true, deadlineAt: true, status: true },
      }),
    ]);

    const now = new Date();
    const dsarsOverdue = dsars.filter((d) => d.dueAt < now).length;
    const dsarsApproachingDeadline = dsars.filter((d) => {
      const diff = d.dueAt.getTime() - now.getTime();
      return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000; // < 7 days
    }).length;

    const activeBreach = breaches.find((b) => b.status !== 'closed');
    const breachHoursRemaining = activeBreach
      ? Math.max(0, Math.round((activeBreach.deadlineAt.getTime() - now.getTime()) / (1000 * 60 * 60)))
      : null;

    return {
      totalActivities: activities,
      openDsars: dsars.length,
      dsarsOverdue,
      dsarsApproachingDeadline,
      openDpias: dpias,
      activeBreaches: breaches.length,
      breachHoursRemaining,
    };
  }
}
