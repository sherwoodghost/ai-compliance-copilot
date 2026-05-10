import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policies.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
    private readonly llmGateway: LlmGatewayService,
  ) {}

  async findAll(orgId: string, controlId?: string, status?: string) {
    return this.prisma.policy.findMany({
      where: {
        orgId,
        ...(controlId && { controlId }),
        ...(status && { status: status as any }),
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
        approver: { select: { id: true, fullName: true } },
      },
      orderBy: [{ controlId: 'asc' }, { version: 'desc' }],
    });
  }

  async findOne(orgId: string, policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, orgId },
      include: {
        control: { include: { framework: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async create(orgId: string, dto: CreatePolicyDto) {
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId: dto.controlId } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    // Auto-increment version for this control
    const latestVersion = await this.prisma.policy.findFirst({
      where: { orgId, controlId: dto.controlId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const policy = await this.prisma.policy.create({
      data: {
        orgId,
        controlId: dto.controlId,
        title: dto.title,
        content: dto.content,
        version: (latestVersion?.version ?? 0) + 1,
        status: 'draft',
        generatedBy: dto.generatedBy ?? 'human',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`Policy created: v${policy.version} for control: ${dto.controlId}`);
    return policy;
  }

  async update(orgId: string, policyId: string, dto: UpdatePolicyDto) {
    const policy = await this.findOne(orgId, policyId);

    if (policy.status === 'approved' && dto.content) {
      throw new BadRequestException(
        'Cannot edit an approved policy. Create a new version instead.',
      );
    }

    return this.prisma.policy.update({
      where: { id: policyId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async approve(orgId: string, policyId: string, approverId: string) {
    const policy = await this.findOne(orgId, policyId);

    if (policy.status === 'approved') {
      throw new BadRequestException('Policy is already approved');
    }

    if (policy.status === 'archived') {
      throw new BadRequestException('Cannot approve an archived policy');
    }

    const updated = await this.prisma.policy.update({
      where: { id: policyId },
      data: {
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: {
        approver: { select: { id: true, fullName: true } },
      },
    });

    // Index the approved policy into RAG for retrieval by other agents
    this.ragIndexer.indexPolicy(orgId, policyId).catch((err) =>
      this.logger.warn(`RAG indexing failed for policy ${policyId}: ${err.message}`),
    );

    return updated;
  }

  async archive(orgId: string, policyId: string) {
    await this.findOne(orgId, policyId);
    return this.prisma.policy.update({
      where: { id: policyId },
      data: { status: 'archived' },
    });
  }

  async createNewVersion(orgId: string, policyId: string, content: string) {
    const policy = await this.findOne(orgId, policyId);

    // Archive the old approved version
    if (policy.status === 'approved') {
      await this.prisma.policy.update({
        where: { id: policyId },
        data: { status: 'archived' },
      });
    }

    return this.prisma.policy.create({
      data: {
        orgId,
        controlId: policy.controlId,
        title: policy.title,
        content,
        version: policy.version + 1,
        status: 'draft',
        generatedBy: 'human',
      },
    });
  }

  async getVersionHistory(orgId: string, controlId: string) {
    return this.prisma.policy.findMany({
      where: { orgId, controlId },
      select: {
        id: true,
        version: true,
        status: true,
        generatedBy: true,
        approvedAt: true,
        createdAt: true,
        approver: { select: { fullName: true } },
      },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * AI-generate a policy for a specific control using the org's BusinessProfile.
   */
  async generatePolicy(orgId: string, controlId: string) {
    // Load control with framework
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId } },
      include: { control: { include: { framework: true } } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    // Load business profile for context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });
    if (!profile) {
      throw new BadRequestException(
        'Business profile not found. Complete onboarding first to enable AI policy generation.',
      );
    }

    // Check for existing non-archived policy
    const existingPolicy = await this.prisma.policy.findFirst({
      where: { orgId, controlId, status: { not: 'archived' as any } },
      orderBy: { version: 'desc' },
    });

    // Build contextual prompt
    const { control } = orgControl;
    const tools = (profile as any).tools ?? {};
    const infra = (profile as any).infrastructure ?? {};
    const dataHandling = (profile as any).dataHandling ?? {};

    const toolContext = Object.entries(tools)
      .filter(([_, v]) => v && v !== 'none')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    const prompt = `Write a complete, audit-ready policy for the following control:

CONTROL: ${control.code} — ${control.title}
FRAMEWORK: ${control.framework.name}
DESCRIPTION: ${control.description}
GUIDANCE: ${control.guidance ?? 'N/A'}

COMPANY CONTEXT:
- Company: ${(profile as any).companyName}
- Industry: ${(profile as any).industry}${(profile as any).subIndustry ? ` (${(profile as any).subIndustry})` : ''}
- Size: ${(profile as any).employeeCount} employees
- Cloud: ${infra.cloudProviders?.join(', ') ?? 'not specified'}
- Tools in use: ${toolContext || 'not specified'}
- Data types handled: ${dataHandling.dataTypes?.join(', ') ?? 'not specified'}
- Operates in: ${(profile as any).operatesIn?.join(', ') ?? (profile as any).hqCountry ?? 'not specified'}
- Current MFA status: ${(profile as any).currentPosture?.usesMfa ?? 'unknown'}
- Has SSO: ${(profile as any).currentPosture?.hasSso ?? 'unknown'}

Write the policy using the actual tool names. Reference real processes.
${dataHandling.dataTypes?.includes('health_phi') ? 'Include HIPAA-specific language and requirements.' : ''}
${(profile as any).operatesIn?.includes('EU') ? 'Include GDPR Article references where relevant.' : ''}
${dataHandling.dataTypes?.includes('payment_card') ? 'Include PCI DSS references where relevant.' : ''}

The policy must be complete enough to satisfy a ${control.framework.name} auditor.`;

    // Call LLM gateway
    const response = await this.llmGateway.call({
      promptTemplateId: 'policy-generator',
      userMessage: prompt,
      taskType: 'policy',
      orgId,
      agentName: 'policy',
      maxTokens: 6000,
      requiresControlValidation: true,
      contextControlIds: [controlId],
    });

    // Create policy record
    const title = `${control.title} Policy`;
    const policy = await this.prisma.policy.create({
      data: {
        orgId,
        controlId,
        title,
        content: response.content,
        version: (existingPolicy?.version ?? 0) + 1,
        status: 'draft',
        generatedBy: 'agent',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`AI policy generated: ${title} (v${policy.version}) for control ${control.code}`);
    return policy;
  }

  /**
   * Improve an existing policy using AI — rewrites with better context and coverage.
   */
  async aiImprovePolicy(orgId: string, policyId: string) {
    const policy = await this.findOne(orgId, policyId);
    if (policy.status === 'archived') {
      throw new BadRequestException('Cannot improve an archived policy');
    }

    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
    });

    const prompt = `Improve and strengthen the following compliance policy. Make it more specific, actionable, and audit-ready.

CURRENT POLICY:
Title: ${policy.title}
Control: ${policy.control.code} — ${policy.control.title}
Framework: ${policy.control.framework.name}

Current content:
${policy.content}

COMPANY CONTEXT:
- Company: ${(profile as any)?.companyName ?? 'N/A'}
- Industry: ${(profile as any)?.industry ?? 'N/A'}

Rewrite the policy to:
1. Be more specific with actionable requirements
2. Include clear roles and responsibilities
3. Add review cadence and exception handling
4. Reference specific tools and processes used by the company
5. Ensure compliance with ${policy.control.framework.name} audit requirements

Return the complete improved policy in markdown.`;

    const response = await this.llmGateway.call({
      promptTemplateId: 'policy-generator',
      userMessage: prompt,
      taskType: 'policy',
      orgId,
      agentName: 'policy',
      maxTokens: 6000,
    });

    // Create new version with improved content
    const newPolicy = await this.prisma.policy.create({
      data: {
        orgId,
        controlId: policy.controlId,
        title: policy.title,
        content: response.content,
        version: policy.version + 1,
        status: 'draft',
        generatedBy: 'agent',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`AI improved policy: ${policy.title} → v${newPolicy.version}`);
    return newPolicy;
  }

  /**
   * Get controls that are missing policies — the "coverage gap".
   */
  async getCoverageGaps(orgId: string) {
    // All applicable controls for this org
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: {
        control: {
          include: { framework: { select: { id: true, name: true } } },
        },
      },
    });

    // All non-archived policies
    const policies = await this.prisma.policy.findMany({
      where: { orgId, status: { not: 'archived' as any } },
      select: { controlId: true, status: true, version: true, generatedBy: true },
    });

    const policyMap = new Map<string, { status: string; version: number; generatedBy: string }>();
    for (const p of policies) {
      if (!p.controlId) continue;
      const existing = policyMap.get(p.controlId);
      if (!existing || p.version > existing.version) {
        policyMap.set(p.controlId, { status: p.status, version: p.version, generatedBy: p.generatedBy });
      }
    }

    const gaps = [];
    const covered = [];

    for (const oc of orgControls) {
      const policy = policyMap.get(oc.controlId);
      const item = {
        controlId: oc.controlId,
        controlCode: oc.control.code,
        controlTitle: oc.control.title,
        category: oc.control.category,
        frameworkId: oc.control.frameworkId,
        frameworkName: (oc.control as any).framework?.name ?? '',
        hasPolicy: !!policy,
        policyStatus: policy?.status ?? null,
        policyVersion: policy?.version ?? null,
        generatedBy: policy?.generatedBy ?? null,
      };

      if (!policy) {
        gaps.push(item);
      } else {
        covered.push(item);
      }
    }

    // Group gaps by framework
    const byFramework: Record<string, { framework: string; total: number; covered: number; gaps: number }> = {};
    for (const oc of orgControls) {
      const fw = (oc.control as any).framework?.name ?? 'Unknown';
      if (!byFramework[fw]) byFramework[fw] = { framework: fw, total: 0, covered: 0, gaps: 0 };
      byFramework[fw].total++;
      if (policyMap.has(oc.controlId)) byFramework[fw].covered++;
      else byFramework[fw].gaps++;
    }

    return {
      totalControls: orgControls.length,
      totalCovered: covered.length,
      totalGaps: gaps.length,
      coveragePercentage: orgControls.length > 0
        ? Math.round((covered.length / orgControls.length) * 100)
        : 0,
      byFramework: Object.values(byFramework),
      gaps: gaps.sort((a, b) => a.controlCode.localeCompare(b.controlCode)),
      covered: covered.sort((a, b) => a.controlCode.localeCompare(b.controlCode)),
    };
  }
}
