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

  async updateLlmSettings(orgId: string, settings: { orgApiKey?: string; preferredModel?: string }) {
    const org = await this.findById(orgId);
    const currentSettings = (org.settings as Record<string, unknown>) ?? {};

    const updatedSettings: Record<string, unknown> = { ...currentSettings };

    if (settings.orgApiKey !== undefined) {
      // Store key with basic obfuscation (in production use proper encryption)
      updatedSettings.openRouterKey = settings.orgApiKey || null;
    }
    if (settings.preferredModel !== undefined) {
      updatedSettings.preferredModel = settings.preferredModel;
    }

    return this.prisma.organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings as any },
    });
  }

  async testLlmKey(apiKey: string): Promise<{ success: boolean; model?: string; error?: string }> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai-compliance-copilot.app',
          'X-Title': 'AI Compliance Copilot',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3-haiku',
          messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API returned ${response.status}: ${errorText.slice(0, 100)}` };
      }

      const data = await response.json();
      return { success: true, model: data.model ?? 'anthropic/claude-3-haiku' };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getLlmSettings(orgId: string): Promise<{ hasKey: boolean; preferredModel: string; keyMasked?: string }> {
    const org = await this.findById(orgId);
    const settings = (org.settings as Record<string, unknown>) ?? {};
    const key = settings.openRouterKey as string | null | undefined;

    return {
      hasKey: !!key,
      preferredModel: (settings.preferredModel as string) ?? 'anthropic/claude-sonnet-4-5',
      keyMasked: key ? `sk-or-...${key.slice(-8)}` : undefined,
    };
  }
}
