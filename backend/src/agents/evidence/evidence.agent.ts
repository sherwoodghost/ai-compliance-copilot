import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

// Maps controls to what evidence integrations can provide
const CONTROL_EVIDENCE_MAP: Record<string, Array<{ integration: string; evidenceType: string; title: string }>> = {
  'CC6.1': [
    { integration: 'okta', evidenceType: 'api_response', title: 'MFA Enforcement Policy' },
    { integration: 'aws', evidenceType: 'log', title: 'AWS IAM MFA Status Report' },
    { integration: 'github', evidenceType: 'api_response', title: 'GitHub Organization SSO Status' },
  ],
  'CC6.2': [
    { integration: 'okta', evidenceType: 'api_response', title: 'User Provisioning Workflow' },
    { integration: 'github', evidenceType: 'api_response', title: 'GitHub Org Member Access List' },
  ],
  'CC6.3': [
    { integration: 'okta', evidenceType: 'api_response', title: 'RBAC Policy Configuration' },
    { integration: 'aws', evidenceType: 'api_response', title: 'AWS IAM Roles and Policies' },
    { integration: 'github', evidenceType: 'api_response', title: 'GitHub Branch Protection Rules' },
  ],
  'CC7.1': [
    { integration: 'github', evidenceType: 'api_response', title: 'GitHub Dependabot Alerts' },
    { integration: 'aws', evidenceType: 'log', title: 'AWS Inspector Vulnerability Report' },
  ],
  'CC7.2': [
    { integration: 'datadog', evidenceType: 'log', title: 'Centralized Logging Configuration' },
    { integration: 'aws', evidenceType: 'log', title: 'AWS CloudTrail Configuration' },
  ],
  'CC8.1': [
    { integration: 'github', evidenceType: 'api_response', title: 'Branch Protection + PR Requirements' },
    { integration: 'jira', evidenceType: 'api_response', title: 'Change Management Tickets' },
  ],
  'A.9.2': [
    { integration: 'okta', evidenceType: 'api_response', title: 'User Lifecycle Management Config' },
  ],
  'A.12.4': [
    { integration: 'aws', evidenceType: 'log', title: 'CloudTrail Audit Log Configuration' },
    { integration: 'datadog', evidenceType: 'log', title: 'Log Retention Policy' },
  ],
  'A.12.6': [
    { integration: 'github', evidenceType: 'api_response', title: 'Dependabot Configuration' },
    { integration: 'snyk', evidenceType: 'api_response', title: 'Snyk Vulnerability Report' },
  ],
};

@Injectable()
export class EvidenceAgent extends BaseAgent {
  protected readonly agentName = 'evidence';

  constructor(prisma: PrismaService, llm: LlmService, journeyService: ComplianceJourneyService, gateway: LlmGatewayService) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, businessProfile } = jobData;

    // ── Step 1: Load connected integrations ─────────────────────────────────
    const integrations = await this.recordStep(runId, 'load_integrations', 0, { orgId }, async () => {
      const connected = await this.prisma.integration.findMany({
        where: { orgId, status: 'connected' },
        select: { provider: true, id: true },
      });
      return { connected: connected.map((i) => i.provider) };
    });

    const connectedProviders = (integrations as any).connected as string[];
    const profileTools = Object.values(businessProfile.tools ?? {}).filter(Boolean) as string[];
    const availableIntegrations = [...connectedProviders, ...profileTools];

    // ── Step 2: Load controls without evidence ──────────────────────────────
    const controls = await this.recordStep(runId, 'load_controls', 1, { orgId }, async () => {
      const orgControls = await this.prisma.organizationControl.findMany({
        where: {
          orgId,
          status: { not: 'implemented' },
        },
        include: { control: true },
        take: 20,
      });
      const controlIds = orgControls.map((oc) => oc.controlId);
      const existing = await this.prisma.evidence.groupBy({
        by: ['controlId'],
        where: { orgId, controlId: { in: controlIds }, isValid: true },
        _count: true,
      });
      const hasEvidence = new Set(existing.map((e) => e.controlId));
      return orgControls.filter((oc) => !hasEvidence.has(oc.controlId));
    });

    const evidenceCreated: Array<{ controlId: string; title: string; source: string }> = [];

    // ── Step 3: Collect/simulate evidence per control ───────────────────────
    for (const [idx, orgControl] of (controls as any[]).entries()) {
      const controlCode = orgControl.control.code;
      const evidenceSources = CONTROL_EVIDENCE_MAP[controlCode] ?? [];

      // Filter to sources that match available integrations, or simulate if none
      const applicableSources = evidenceSources.filter(
        (s) => availableIntegrations.includes(s.integration),
      );

      const sourcesToCreate =
        applicableSources.length > 0 ? applicableSources : await this.simulateEvidence(orgControl.control, businessProfile, runId, orgId, jobData?.workflowId);

      for (const source of sourcesToCreate) {
        await this.recordStep(
          runId,
          `collect_evidence_${controlCode}_${source.integration}`,
          idx + 2,
          { controlCode, integration: source.integration },
          async () => {
            const evidence = await this.prisma.evidence.create({
              data: {
                orgId,
                controlId: orgControl.controlId,
                title: source.title,
                type: source.evidenceType as any,
                source: applicableSources.length > 0 ? 'integration' : 'agent_generated',
                metadata: {
                  integration: source.integration,
                  collectedBy: 'evidence-agent',
                  simulated: applicableSources.length === 0,
                },
                isValid: true,
                collectedAt: new Date(),
              },
            });
            return { evidenceId: evidence.id };
          },
        );

        evidenceCreated.push({
          controlId: orgControl.controlId,
          title: source.title,
          source: source.integration,
        });
      }
    }

    return {
      success: true,
      data: { evidenceCreated, count: evidenceCreated.length },
      nextAgentInput: { evidenceCreated },
    };
  }

  private async simulateEvidence(
    control: any,
    profile: any,
    runId: string,
    orgId: string,
    workflowId?: string,
  ): Promise<Array<{ integration: string; evidenceType: string; title: string }>> {
    const response = await this.callGateway(runId, {
      promptTemplateId: 'evidence-collector',
      userMessage: `Control: ${control.code} — ${control.title}
Company tools: ${JSON.stringify(profile.tools)}
What evidence documents would satisfy this control? Return JSON:
[{"integration": "manual", "evidenceType": "document", "title": "Evidence title"}]`,
      taskType: 'evidence_validation',
      orgId,
      workflowId,
      maxTokens: 512,
    });

    try {
      return this.llm.parseJSON<any[]>(response.content).slice(0, 2);
    } catch {
      return [{ integration: 'manual', evidenceType: 'document', title: `${control.title} Evidence` }];
    }
  }
}
