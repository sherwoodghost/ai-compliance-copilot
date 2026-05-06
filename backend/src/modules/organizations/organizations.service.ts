import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        _count: {
          select: {
            users: true,
            organizationControls: true,
            evidence: true,
            workflows: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization not found`);
    }

    return org;
  }

  async findBySlug(slug: string) {
    const org = await this.prisma.organization.findUnique({ where: { slug } });
    if (!org) throw new NotFoundException(`Organization not found`);
    return org;
  }

  async update(orgId: string, dto: UpdateOrganizationDto) {
    await this.findById(orgId);

    return this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.plan && { plan: dto.plan }),
        ...(dto.settings && { settings: dto.settings as any }),
      },
    });
  }

  async getStats(orgId: string) {
    const [
      totalControls,
      implementedControls,
      totalEvidence,
      openTasks,
      pendingWorkflows,
      hasBusinessProfile,
    ] = await Promise.all([
      this.prisma.organizationControl.count({ where: { orgId } }),
      this.prisma.organizationControl.count({ where: { orgId, status: 'implemented' } }),
      this.prisma.evidence.count({ where: { orgId, isValid: true } }),
      this.prisma.task.count({ where: { orgId, status: { in: ['open', 'in_progress'] } } }),
      this.prisma.workflow.count({ where: { orgId, status: { in: ['pending', 'running'] } } }),
      this.prisma.businessProfile.count({ where: { orgId, isComplete: true } }),
    ]);

    const complianceScore =
      totalControls > 0
        ? Math.round((implementedControls / totalControls) * 100)
        : 0;

    return {
      complianceScore,
      totalControls,
      implementedControls,
      totalEvidence,
      openTasks,
      pendingWorkflows,
      onboardingComplete: hasBusinessProfile > 0,
    };
  }

  async getMembers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId, isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async removeMember(orgId: string, targetUserId: string, requestingUserId: string) {
    if (targetUserId === requestingUserId) {
      throw new ForbiddenException('You cannot remove yourself from the organization');
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: targetUserId, orgId },
    });

    if (!targetUser) {
      throw new NotFoundException('User not found in this organization');
    }

    // Soft-delete: deactivate rather than delete to preserve audit trail
    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { isActive: false },
    });
  }
}
