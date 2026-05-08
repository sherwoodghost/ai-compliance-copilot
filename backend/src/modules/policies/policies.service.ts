import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policies.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';
import { PermissionService } from '../../common/permissions/permission.service';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
    private readonly llm: LlmService,
    private readonly permissionService: PermissionService,
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

  async create(orgId: string, dto: CreatePolicyDto, creatorId?: string) {
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
        ...(creatorId && { authorId: creatorId }),
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

    // SoD: the approver must not be the policy author (ISO A.5.3 / SOC 2 CC1.3)
    const policyAny = policy as any;
    await this.permissionService.checkSoD(
      { id: approverId, orgId, role: 'admin', platformRole: 'approver', status: 'active' },
      {
        action: 'policy.approve',
        resourceOwnerId: policyAny.authorId,
        resourceDescription: `policy "${policy.title}"`,
        orgId,
        targetType: 'Policy',
        targetId: policyId,
      },
    );

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

  async aiDraft(orgId: string, policyId: string): Promise<{ content: string; policyId: string }> {
    const policy = await this.findOne(orgId, policyId);

    // Fetch org profile for context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    const profileData = (profile as any) ?? {};

    const control = policy.control as any;
    const existingContent = policy.content ?? '';

    const systemPrompt = `You are a compliance policy writer with expertise in information security frameworks (SOC 2, ISO 27001, HIPAA, GDPR). Write professional, practical policy documents that are implementable by real organizations. Write in clear, formal language. Return only the policy content as clean Markdown.`;

    const userPrompt = `${existingContent ? 'Improve and expand this existing policy draft' : 'Write a complete policy document'} for the following compliance control:

Control: [${control?.code ?? 'N/A'}] ${control?.title ?? policy.title}
Framework: ${control?.framework?.name ?? 'SOC 2'}
Category: ${control?.category ?? 'Security'}
${control?.description ? `Control Description: ${control.description}` : ''}
${control?.guidance ? `Implementation Guidance: ${control.guidance}` : ''}

Organization Context:
- Company: ${profileData.companyName ?? 'the organization'}
- Industry: ${profileData.industry ?? 'software/SaaS'}
- Size: ${profileData.companySize ?? 'small-medium'}
- Cloud: ${(profileData.infrastructure?.cloudProviders ?? []).join(', ') || 'cloud-based'}
- MFA Status: ${profileData.currentPosture?.mfaStatus ?? 'enforced'}

${existingContent ? `Existing draft to improve:\n${existingContent.replace(/<[^>]*>/g, '').slice(0, 2000)}` : ''}

Write a complete, professional policy document in Markdown. Include:
1. Purpose and Scope
2. Policy Statement
3. Responsibilities (roles and duties)
4. Policy Requirements (specific, actionable controls with numbered list)
5. Exceptions Process
6. Review and Maintenance (review frequency)
7. Related Policies/Controls

Make it specific to the organization context above. Be concrete and actionable, not generic.`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'policy', temperature: 0.3, maxTokens: 4000 },
    );

    const generatedContent = response.content.trim();

    this.logger.log(`AI draft generated for policy ${policyId}`);
    return { content: generatedContent, policyId };
  }

  // ── AI Policy Coverage Check ──────────────────────────────────────────────
  async aiCoverageCheck(orgId: string) {
    const [policies, profile] = await Promise.all([
      this.prisma.policy.findMany({
        where: { orgId },
        select: { id: true, title: true, status: true, updatedAt: true },
      }),
      this.prisma.businessProfile.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const pd = (profile as any) ?? {};
    const frameworks = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');
    const industry   = pd.industry ?? 'technology';
    const dataTypes  = (pd.dataHandling?.dataTypes ?? []).join(', ') || 'customer data';

    const existingPolicies = policies.map((p) =>
      `"${p.title}" (${p.status})`,
    ).join('\n') || 'None';

    const systemPrompt = `You are a compliance auditor reviewing an organization's policy library for completeness. Identify required policies for the target compliance frameworks that are missing or incomplete.`;

    const userPrompt = `Review the policy coverage for this organisation:

Industry: ${industry}
Target frameworks: ${frameworks}
Data handled: ${dataTypes}

EXISTING POLICIES:
${existingPolicies}

Identify policy gaps. For ${frameworks}, list which required policies are missing or need significant improvement.

Return ONLY a JSON object (no markdown):
{
  "coverageScore": 72,
  "gaps": [
    {
      "policyType": "Acceptable Use Policy",
      "priority": "critical|high|medium",
      "framework": "SOC 2",
      "requirement": "1 sentence on why this is required",
      "covered": false
    }
  ],
  "recommendations": ["Specific action 1", "Specific action 2"]
}

coverageScore: estimate 0-100 based on how well existing policies cover ${frameworks} requirements.
Include both missing policies (covered: false) and existing policies that need updating (covered: true but need review).
Focus on the most important gaps first.`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'policy', temperature: 0.2 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validPriorities = ['critical', 'high', 'medium'];

    return {
      totalPolicies:   policies.length,
      frameworks,
      coverageScore:   Math.min(100, Math.max(0, Number(result.coverageScore ?? 0))),
      gaps:            (Array.isArray(result.gaps) ? result.gaps : []).slice(0, 12).map((g: any) => ({
        policyType:    String(g.policyType ?? '').slice(0, 80),
        priority:      validPriorities.includes(g.priority) ? g.priority : 'medium',
        framework:     String(g.framework ?? '').slice(0, 40),
        requirement:   String(g.requirement ?? '').slice(0, 200),
        covered:       Boolean(g.covered),
      })),
      recommendations: (Array.isArray(result.recommendations) ? result.recommendations : []).slice(0, 5).map(String),
      generatedAt:     new Date().toISOString(),
    };
  }
}
