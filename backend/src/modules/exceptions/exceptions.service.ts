import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreateExceptionDto {
  controlId: string;
  title: string;
  justification: string;
  compensatingControl?: string;
  riskOwnerId?: string;
  expiresAt?: string;
}

export interface UpdateExceptionDto {
  status?: 'approved' | 'rejected' | 'pending';
  compensatingControl?: string;
  rejectionReason?: string;
  expiresAt?: string;
}

@Injectable()
export class ExceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string, status?: string) {
    return this.prisma.controlException.findMany({
      where: { orgId, ...(status && { status }) },
      include: {
        control: { select: { id: true, code: true, title: true, category: true } },
        riskOwner: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(orgId: string, id: string) {
    const exception = await this.prisma.controlException.findFirst({
      where: { id, orgId },
      include: {
        control: { include: { framework: true } },
        riskOwner: { select: { id: true, fullName: true, email: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!exception) throw new NotFoundException('Exception not found');
    return exception;
  }

  async create(orgId: string, userId: string, dto: CreateExceptionDto) {
    // Verify the control belongs to this org
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId: dto.controlId } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    return this.prisma.controlException.create({
      data: {
        orgId,
        controlId: dto.controlId,
        title: dto.title,
        justification: dto.justification,
        compensatingControl: dto.compensatingControl,
        riskOwnerId: dto.riskOwnerId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        status: 'pending',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async update(orgId: string, reviewerId: string, id: string, dto: UpdateExceptionDto) {
    await this.findOne(orgId, id);

    const data: any = {};
    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'approved') {
        data.approvedAt = new Date();
        data.reviewerId = reviewerId;
      }
      if (dto.status === 'rejected') {
        data.rejectedAt = new Date();
        data.reviewerId = reviewerId;
        data.rejectionReason = dto.rejectionReason;
      }
    }
    if (dto.compensatingControl !== undefined) data.compensatingControl = dto.compensatingControl;
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);

    return this.prisma.controlException.update({
      where: { id },
      data,
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async delete(orgId: string, id: string) {
    const exception = await this.findOne(orgId, id);
    if (exception.status === 'approved') {
      throw new ForbiddenException('Cannot delete an approved exception. Reject it first.');
    }
    await this.prisma.controlException.delete({ where: { id } });
  }

  async getStats(orgId: string) {
    const [total, pending, approved, expired] = await Promise.all([
      this.prisma.controlException.count({ where: { orgId } }),
      this.prisma.controlException.count({ where: { orgId, status: 'pending' } }),
      this.prisma.controlException.count({ where: { orgId, status: 'approved' } }),
      this.prisma.controlException.count({
        where: { orgId, status: 'approved', expiresAt: { lt: new Date() } },
      }),
    ]);
    return { total, pending, approved, expired };
  }
}
