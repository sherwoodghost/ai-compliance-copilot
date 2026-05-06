import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';


@Injectable()
export class PolicyAgent extends BaseAgent {
  protected readonly agentName = 'policy';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile, inputPayload } = jobData;
    const { controlIds } = inputPayload as { controlIds?: string[] };

    // ── Step 1: Load controls needing policies ─────────────────────────────
    const controls = await this.recordStep(runId, 'load_controls', 0, { orgId }, async () => {
      const where = controlIds?.length
        ? { orgId, controlId: { in: controlIds } }
        : { orgId, status: { in: ['not_started', 'in_progress'] as any[] } };

      const orgControls = await this.prisma.organizationControl.findMany({
        where,
        include: { control: { include: { framework: true } } },
        take: 10, // Process in batches
      });
      // Attach latest policy per control
      const orgControlIds = orgControls.map((oc) => oc.controlId);
      const policies = await this.prisma.policy.findMany({
        where: { orgId, controlId: { in: orgControlIds }, status: { not: 'archived' as any } },
        orderBy: { version: 'desc' },
      });
      const policyMap: Record<string, any> = {};
      for (const p of policies) {
        if (p.controlId && !policyMap[p.controlId]) policyMap[p.controlId] = p;
      }
      return orgControls.map((oc) => ({ ...oc, latestPolicy: policyMap[oc.controlId] ?? null }));
    });

    const generatedPolicies: Array<{ controlId: string; policyId: string; title: string }> = [];

    // ── Step 2: Generate policy per control ────────────────────────────────
    for (const [idx, orgControl] of (controls as any[]).entries()) {
      const existingPolicy = orgControl.latestPolicy;
      if (existingPolicy?.status === 'approved') continue;

      const policyData = await this.recordStep(
        runId,
        `generate_policy_${orgControl.control.code}`,
        idx + 1,
        { controlCode: orgControl.control.code },
        async () => {
          const prompt = this.buildPolicyPrompt(orgControl, businessProfile);
          const response = await this.callGateway(runId, { promptTemplateId: 'policy-generator', userMessage: prompt, taskType: 'policy', orgId, workflowId: jobData?.workflowId, maxTokens: 6000, requiresControlValidation: true });

          const title = `${orgControl.control.title} Policy`;
          const policy = await this.prisma.policy.create({
            data: {
              orgId,
              controlId: orgControl.controlId,
              title,
              content: response.content,
              version: (existingPolicy?.version ?? 0) + 1,
              status: 'draft',
              generatedBy: 'agent',
            },
          });

          return { policyId: policy.id, title };
        },
      );

      generatedPolicies.push({
        controlId: orgControl.controlId,
        policyId: (policyData as any).policyId,
        title: (policyData as any).title,
      });
    }

    return {
      success: true,
      data: { generatedPolicies, count: generatedPolicies.length },
      nextAgentInput: { generatedPolicies },
    };
  }

  private buildPolicyPrompt(orgControl: any, profile: any): string {
    const { control } = orgControl;
    const tools = profile.tools ?? {};
    const infra = profile.infrastructure ?? {};
    const dataHandling = profile.dataHandling ?? {};

    const toolContext = Object.entries(tools)
      .filter(([_, v]) => v && v !== 'none')
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return `Write a complete, audit-ready policy for the following control:

CONTROL: ${control.code} — ${control.title}
FRAMEWORK: ${control.framework.name}
DESCRIPTION: ${control.description}
GUIDANCE: ${control.guidance ?? 'N/A'}

COMPANY CONTEXT:
- Company: ${profile.companyName}
- Industry: ${profile.industry}${profile.subIndustry ? ` (${profile.subIndustry})` : ''}
- Size: ${profile.employeeCount} employees
- Cloud: ${infra.cloudProviders?.join(', ') ?? 'not specified'}
- Tools in use: ${toolContext || 'not specified'}
- Data types handled: ${dataHandling.dataTypes?.join(', ') ?? 'not specified'}
- Operates in: ${profile.operatesIn?.join(', ') ?? profile.hqCountry ?? 'not specified'}
- Current MFA status: ${profile.currentPosture?.usesMfa ?? 'unknown'}
- Has SSO: ${profile.currentPosture?.hasSso ?? 'unknown'}

Write the policy using the actual tool names. Reference real processes.
${dataHandling.dataTypes?.includes('health_phi') ? 'Include HIPAA-specific language and requirements.' : ''}
${profile.operatesIn?.includes('EU') ? 'Include GDPR Article references where relevant.' : ''}
${dataHandling.dataTypes?.includes('payment_card') ? 'Include PCI DSS references where relevant.' : ''}

The policy must be complete enough to satisfy a ${control.framework.name} auditor.`;
  }
}
