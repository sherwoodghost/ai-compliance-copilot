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

  // ── Retention settings ──────────────────────────────────────────────────────

  async getRetentionSettings(orgId: string) {
    const org = await this.findById(orgId);
    return {
      documentRetentionDays: (org as any).documentRetentionDays ?? 2555,
      evidenceRetentionDays: (org as any).evidenceRetentionDays ?? 2555,
    };
  }

  async updateRetentionSettings(
    orgId: string,
    dto: { documentRetentionDays?: number; evidenceRetentionDays?: number },
  ) {
    await this.findById(orgId);
    const data: Record<string, unknown> = {};
    if (dto.documentRetentionDays !== undefined) data['documentRetentionDays'] = dto.documentRetentionDays;
    if (dto.evidenceRetentionDays !== undefined) data['evidenceRetentionDays'] = dto.evidenceRetentionDays;

    return this.prisma.organization.update({
      where: { id: orgId },
      data:  data as any,
      select: { id: true } as any,
    }).then(() => this.getRetentionSettings(orgId));
  }

  /**
   * Wipe all org-specific compliance data so the demo can be restarted from the
   * onboarding flow. Preserves: user accounts, org record, framework/control
   * definitions (they are global), and LLM settings.
   *
   * DELETE ORDER matters — respects FK constraints (no-cascade relations must
   * delete children before parents):
   *   OnboardingSession.agentRunId → AgentRun (no cascade)
   *   AgentRun.workflowId          → Workflow  (no cascade)
   *   Task.workflowId              → Workflow  (no cascade)
   *   ComplianceJourney.workflowId → Workflow  (no cascade)
   */
  async resetDemoData(orgId: string): Promise<{ reset: true; message: string }> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Agent events
      await tx.agentEvent.deleteMany({ where: { orgId } });
      // 2. Human checkpoints (FK→ComplianceJourney; delete before Journey)
      await tx.humanCheckpoint.deleteMany({ where: { orgId } });
      // 3. Compliance journeys (FK→Workflow; delete before Workflow)
      await tx.complianceJourney.deleteMany({ where: { orgId } });
      // 4. Onboarding sessions (FK→AgentRun; delete before AgentRun)
      await tx.onboardingSession.deleteMany({ where: { orgId } });
      // 5. Agent runs (FK→Workflow; delete before Workflow)
      await tx.agentRun.deleteMany({ where: { orgId } });
      // 6. Tasks (FK→Workflow; delete before Workflow)
      await tx.task.deleteMany({ where: { orgId } });
      // 7. Workflows (all child FKs now cleared)
      await tx.workflow.deleteMany({ where: { orgId } });
      // 8. Readiness scores
      await tx.readinessScore.deleteMany({ where: { orgId } });
      // 9. Risks (RiskTreatment has FK→RiskItem; delete treatment first)
      await tx.riskTreatment.deleteMany({ where: { orgId } });
      await tx.riskItem.deleteMany({ where: { orgId } });
      // 10. Audit cycles (AuditFinding has FK→AuditCycle with CASCADE, but delete explicitly)
      await tx.auditFinding.deleteMany({ where: { orgId } });
      await tx.auditCycle.deleteMany({ where: { orgId } });
      // 11. Control exceptions (delete before organizationControl)
      await tx.controlException.deleteMany({ where: { orgId } });
      // 12. Core compliance artefacts
      await tx.evidence.deleteMany({ where: { orgId } });
      await tx.policy.deleteMany({ where: { orgId } });
      await tx.organizationControl.deleteMany({ where: { orgId } });
      // 13. Scoping (IsoSOA FK→Iso27001Scope; delete SOA before scope)
      await tx.isoStatementOfApplicability.deleteMany({ where: { orgId } });
      await tx.iso27001Scope.deleteMany({ where: { orgId } });
      await tx.soc2Scope.deleteMany({ where: { orgId } });
      await tx.controlApplicability.deleteMany({ where: { orgId } });
      // 14. Auditor portal (AuditorRfi FK→AuditorSession; delete RFI first)
      await tx.auditorRfi.deleteMany({ where: { orgId } });
      await tx.auditorSession.deleteMany({ where: { orgId } });
      // 15. Exports and test results
      await tx.auditExport.deleteMany({ where: { orgId } });
      await tx.controlTestResult.deleteMany({ where: { orgId } });
      // 16. Vendor risk
      await tx.vendorRisk.deleteMany({ where: { orgId } });
      // 17. Inference (IntegrationSuggestion FK→InferenceResult; delete suggestions first)
      await tx.integrationSuggestion.deleteMany({ where: { orgId } });
      await tx.inferenceResult.deleteMany({ where: { orgId } });
      // 18. Dashboard config
      await tx.dashboardConfig.deleteMany({ where: { orgId } });
      // 19. Unique-per-org singletons (MUST clear or re-onboarding hits unique constraint)
      await tx.trustCenter.deleteMany({ where: { orgId } });
      await tx.dialogueState.deleteMany({ where: { orgId } });
      // 20. Business profile (versions FK→profile; delete versions first)
      await tx.businessProfileVersion.deleteMany({ where: { orgId } });
      await tx.businessProfile.deleteMany({ where: { orgId } });
    });

    return {
      reset: true,
      message: 'All compliance data cleared. You can now restart onboarding.',
    };
  }

  async getAuditLogs(orgId: string, limit = 100, offset = 0) {
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
        include: {
          user: { select: { fullName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where: { orgId } }),
    ]);

    return { logs, total };
  }
}
