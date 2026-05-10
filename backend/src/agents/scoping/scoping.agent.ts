import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { ScopingService } from '../../scoping/scoping.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';

@Injectable()
export class ScopingAgent extends BaseAgent {
  protected readonly agentName = 'scoping';

  constructor(
    prisma: PrismaService,
    llm: LlmService,
    journeyService: ComplianceJourneyService,
    gateway: LlmGatewayService,
    private readonly scopingService: ScopingService,
  ) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, workflowId, businessProfile } = jobData;
    const { framework = 'soc2' } = (jobData.inputPayload ?? {}) as { framework?: string };

    // ── Step 1: Load profile ────────────────────────────────────────────────
    const profile = businessProfile ?? await this.recordStep(runId, 'load_profile', 0, { orgId }, async () => {
      const p = await this.prisma.businessProfile.findUnique({ where: { orgId } });
      if (!p) throw new Error(`No business profile for org ${orgId}`);
      return p;
    });

    // ── Step 2: Call LLM gateway to draft scope ─────────────────────────────
    const scopeDraft = await this.recordStep(runId, 'draft_scope', 1, { framework }, async () => {
      const infra = (profile as any).infrastructure ?? {};
      const data = (profile as any).dataHandling ?? {};
      const tools = (profile as any).tools ?? {};

      const toolContext = Object.entries(tools)
        .filter(([_, v]) => v && v !== 'none')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      const response = await this.callGateway(runId, {
        promptTemplateId: 'compliance-scoping',
        promptTemplateVersion: 'v1',
        variables: {
          framework: framework.toUpperCase(),
          companyName: (profile as any).companyName ?? 'the organization',
          industry: (profile as any).industry ?? 'technology',
          cloudProviders: infra.cloudProviders?.join(', ') ?? 'not specified',
          dataTypes: data.dataTypes?.join(', ') ?? 'not specified',
          employeeCount: (profile as any).employeeCount ?? 'unknown',
          tools: toolContext || 'not specified',
          operatesIn: (profile as any).operatesIn?.join(', ') ?? (profile as any).hqCountry ?? 'not specified',
        },
        taskType: 'compliance',
        orgId,
        workflowId,
        requiresControlValidation: false,
      });

      // Parse JSON from response
      const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ??
                        response.content.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) throw new Error('Scoping agent did not return valid JSON');

      return JSON.parse(jsonMatch[1]);
    });

    // ── Step 3: Persist scope to DB ─────────────────────────────────────────
    let scopeRecord: any;
    const fwNorm = framework.toLowerCase().replace(/_/g, '-');

    switch (fwNorm) {
      case 'soc2':
        scopeRecord = await this.recordStep(runId, 'save_soc2_scope', 2, {}, async () => {
          return this.scopingService.createSoc2Scope(orgId, workflowId, {
            trustServiceCategories: scopeDraft.trust_service_categories ?? ['security'],
            auditType: scopeDraft.audit_type ?? 'type_ii',
            systemsInScope: scopeDraft.systems_in_scope ?? [],
            systemsOutOfScope: scopeDraft.systems_out_of_scope ?? [],
            dataInScope: scopeDraft.data_in_scope ?? [],
            ambiguousItems: scopeDraft.ambiguous_items ?? [],
          });
        });
        break;

      case 'iso27001':
        scopeRecord = await this.recordStep(runId, 'save_iso27001_scope', 2, {}, async () => {
          return this.scopingService.createIsoScope(orgId, {
            ismsScope: scopeDraft.isms_scope ?? '',
            boundaries: scopeDraft.boundaries ?? '',
            interestedParties: scopeDraft.interested_parties ?? [],
            internalIssues: scopeDraft.internal_issues ?? [],
            externalIssues: scopeDraft.external_issues ?? [],
            exclusions: scopeDraft.exclusions ?? [],
            exclusionRationale: scopeDraft.exclusion_rationale ?? '',
          });
        });
        break;

      case 'iso9001':
        // ISO 9001 QMS scope — reuse ISO scope structure with QMS-specific fields
        scopeRecord = await this.recordStep(runId, 'save_iso9001_scope', 2, {}, async () => {
          return this.scopingService.createIsoScope(orgId, {
            ismsScope: scopeDraft.qms_scope ?? scopeDraft.isms_scope ?? '',
            boundaries: scopeDraft.boundaries ?? '',
            interestedParties: scopeDraft.interested_parties ?? [],
            internalIssues: scopeDraft.internal_issues ?? [],
            externalIssues: scopeDraft.external_issues ?? [],
            exclusions: scopeDraft.exclusions ?? [],
            exclusionRationale: scopeDraft.exclusion_rationale ?? '',
          });
        });
        break;

      case 'gdpr':
        // GDPR scope — data processing scope, reuse ISO scope structure
        scopeRecord = await this.recordStep(runId, 'save_gdpr_scope', 2, {}, async () => {
          return this.scopingService.createIsoScope(orgId, {
            ismsScope: scopeDraft.processing_scope ?? scopeDraft.isms_scope ?? '',
            boundaries: scopeDraft.geographic_scope ?? scopeDraft.boundaries ?? '',
            interestedParties: scopeDraft.data_subjects ?? scopeDraft.interested_parties ?? [],
            internalIssues: scopeDraft.processing_activities ?? scopeDraft.internal_issues ?? [],
            externalIssues: scopeDraft.transfer_mechanisms ?? scopeDraft.external_issues ?? [],
            exclusions: scopeDraft.exclusions ?? [],
            exclusionRationale: scopeDraft.exclusion_rationale ?? '',
          });
        });
        break;

      case 'hipaa':
        // HIPAA scope — ePHI systems, reuse ISO scope structure
        scopeRecord = await this.recordStep(runId, 'save_hipaa_scope', 2, {}, async () => {
          return this.scopingService.createIsoScope(orgId, {
            ismsScope: scopeDraft.ephi_scope ?? scopeDraft.isms_scope ?? '',
            boundaries: scopeDraft.boundaries ?? '',
            interestedParties: scopeDraft.covered_entities ?? scopeDraft.interested_parties ?? [],
            internalIssues: scopeDraft.internal_issues ?? [],
            externalIssues: scopeDraft.business_associates ?? scopeDraft.external_issues ?? [],
            exclusions: scopeDraft.exclusions ?? [],
            exclusionRationale: scopeDraft.exclusion_rationale ?? '',
          });
        });
        break;

      default:
        // Generic scope for any other framework (PCI-DSS, NIST, FedRAMP, etc.)
        scopeRecord = await this.recordStep(runId, 'save_generic_scope', 2, {}, async () => {
          return this.scopingService.createIsoScope(orgId, {
            ismsScope: scopeDraft.scope ?? scopeDraft.isms_scope ?? '',
            boundaries: scopeDraft.boundaries ?? '',
            interestedParties: scopeDraft.interested_parties ?? [],
            internalIssues: scopeDraft.internal_issues ?? [],
            externalIssues: scopeDraft.external_issues ?? [],
            exclusions: scopeDraft.exclusions ?? [],
            exclusionRationale: scopeDraft.exclusion_rationale ?? '',
          });
        });
        break;
    }

    return {
      success: true,
      data: {
        framework,
        scopeId: scopeRecord.id,
        scope: scopeDraft,
        requiresHumanReview: scopeDraft.requires_human_review ?? true,
        summary: `${framework.toUpperCase()} scope drafted — requires human review before approval`,
      },
      warnings: scopeDraft.ambiguous_items?.length
        ? [`${scopeDraft.ambiguous_items.length} ambiguous items require human review`]
        : [],
    };
  }
}
