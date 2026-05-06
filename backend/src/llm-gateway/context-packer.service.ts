import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RagService, RagSourceType } from './rag/rag.service';

export type TaskType =
  | 'onboarding'
  | 'compliance'
  | 'policy'
  | 'evidence_validation'
  | 'audit_export'
  | 'dashboard'
  | 'risk'
  | 'generic';

export interface ContextPack {
  businessProfileSummary?: string;
  applicableControls?: string;
  orgControlStatus?: string;
  openRisks?: string;
  recentPolicies?: string;
  scopeSummary?: string;
  additionalContext?: string;
  ragContext?: string;
}

/**
 * The compliance-safe wrapper injected into every LLM call on this platform.
 * This is the non-negotiable Rule 0 — no agent can bypass this.
 */
export const COMPLIANCE_SAFE_WRAPPER = `
=== COMPLIANCE PLATFORM OPERATING RULES ===
You are operating as part of a compliance readiness platform.
RULES:
- The Control Library is the ONLY source of truth for control IDs.
- Never invent control IDs. If a control is not in the provided context, say "control not found in library."
- Always cite the control IDs you reference (use exact codes from context).
- Never claim certification. Use "ready for auditor review" not "certified" or "compliant."
- Always surface assumptions and unknowns explicitly.
- Flag anything requiring human review with requires_human_review: true.
- Return schema-valid JSON when a schema is specified.
FORBIDDEN (never use these words or phrases): certified, guaranteed compliance, passed SOC 2, ISO certified, guaranteed audit success, fully compliant, no remaining risk.
=== END COMPLIANCE RULES ===

`;

@Injectable()
export class ContextPackerService {
  private readonly logger = new Logger(ContextPackerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  /**
   * Build a context pack for a given task type and org.
   * This is injected into the system prompt to ground the LLM in real org data.
   */
  async build(
    taskType: TaskType,
    orgId: string | undefined,
    options: {
      controlIds?: string[];
      includeRisks?: boolean;
      includePolicies?: boolean;
      ragQuery?: string;
      ragSourceTypes?: RagSourceType[];
    } = {},
  ): Promise<ContextPack> {
    const pack: ContextPack = {};

    if (!orgId) return pack;

    switch (taskType) {
      case 'onboarding':
        // Onboarding doesn't need much context — just existing profile fields
        break;

      case 'compliance':
      case 'policy':
        pack.businessProfileSummary = await this.getProfileSummary(orgId);
        pack.applicableControls = await this.getApplicableControlsSummary(orgId, options.controlIds);
        pack.orgControlStatus = await this.getControlStatusSummary(orgId);
        if (options.includePolicies) {
          pack.recentPolicies = await this.getPolicySummary(orgId);
        }
        pack.scopeSummary = await this.getScopeSummary(orgId);
        break;

      case 'evidence_validation':
        pack.businessProfileSummary = await this.getProfileSummary(orgId);
        pack.applicableControls = await this.getApplicableControlsSummary(orgId, options.controlIds);
        break;

      case 'risk':
        pack.businessProfileSummary = await this.getProfileSummary(orgId);
        pack.applicableControls = await this.getApplicableControlsSummary(orgId, options.controlIds);
        pack.openRisks = await this.getRiskSummary(orgId);
        break;

      case 'audit_export':
        pack.businessProfileSummary = await this.getProfileSummary(orgId);
        pack.applicableControls = await this.getApplicableControlsSummary(orgId);
        pack.orgControlStatus = await this.getControlStatusSummary(orgId);
        pack.recentPolicies = await this.getPolicySummary(orgId);
        pack.openRisks = await this.getRiskSummary(orgId);
        pack.scopeSummary = await this.getScopeSummary(orgId);
        break;

      case 'dashboard':
        pack.orgControlStatus = await this.getControlStatusSummary(orgId);
        pack.openRisks = await this.getRiskSummary(orgId);
        break;

      case 'generic':
      default:
        pack.businessProfileSummary = await this.getProfileSummary(orgId);
        break;
    }

    // ── RAG retrieval (always run if a query is provided) ────────────────────
    if (options.ragQuery) {
      try {
        const chunks = await this.rag.retrieve(options.ragQuery, orgId, {
          sourceTypes: options.ragSourceTypes,
          topK: 6,
        });
        if (chunks.length > 0) {
          pack.ragContext = this.rag.formatForPrompt(chunks);
        }
      } catch (err: any) {
        this.logger.warn(`RAG retrieval skipped: ${err.message}`);
      }
    }

    return pack;
  }

  /**
   * Serialize a context pack into a string to append to the system prompt.
   */
  serialize(pack: ContextPack): string {
    const parts: string[] = [];

    if (pack.businessProfileSummary) {
      parts.push(`=== ORGANIZATION PROFILE ===\n${pack.businessProfileSummary}`);
    }
    if (pack.applicableControls) {
      parts.push(`=== APPLICABLE CONTROLS (SOURCE OF TRUTH) ===\n${pack.applicableControls}`);
    }
    if (pack.orgControlStatus) {
      parts.push(`=== CONTROL IMPLEMENTATION STATUS ===\n${pack.orgControlStatus}`);
    }
    if (pack.openRisks) {
      parts.push(`=== OPEN RISKS ===\n${pack.openRisks}`);
    }
    if (pack.recentPolicies) {
      parts.push(`=== EXISTING POLICIES ===\n${pack.recentPolicies}`);
    }
    if (pack.scopeSummary) {
      parts.push(`=== SCOPE DEFINITION ===\n${pack.scopeSummary}`);
    }
    if (pack.additionalContext) {
      parts.push(`=== ADDITIONAL CONTEXT ===\n${pack.additionalContext}`);
    }
    if (pack.ragContext) {
      parts.push(pack.ragContext);
    }

    return parts.join('\n\n');
  }

  // ── Private fetchers ──────────────────────────────────────────────────────

  private async getProfileSummary(orgId: string): Promise<string> {
    try {
      const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
      if (!profile) return 'No business profile available';

      const infra = profile.infrastructure as any;
      const data = profile.dataHandling as any;
      const posture = profile.currentPosture as any;
      const goals = profile.complianceGoals as any;

      return [
        `Company: ${profile.companyName} (${profile.industry}, ${profile.employeeCount} employees)`,
        `Cloud: ${infra?.cloudProviders?.join(', ') ?? 'none'}`,
        `Data types: ${data?.dataTypes?.join(', ') ?? 'not specified'}`,
        `MFA: ${posture?.usesMfa ?? 'unknown'} | SSO: ${posture?.hasSso ?? 'unknown'}`,
        `Target frameworks: ${goals?.frameworks?.join(', ') ?? 'not specified'}`,
        `Operates in: ${profile.operatesIn?.join(', ') ?? profile.hqCountry ?? 'not specified'}`,
      ].join('\n');
    } catch {
      return 'Profile unavailable';
    }
  }

  private async getApplicableControlsSummary(orgId: string, controlIds?: string[]): Promise<string> {
    try {
      const where: any = { orgId };
      if (controlIds?.length) where.controlId = { in: controlIds };

      const applicability = await this.prisma.controlApplicability.findMany({
        where: { ...where, applicable: true },
        include: { control: { include: { framework: true } } },
        orderBy: { control: { code: 'asc' } },
        take: 50,
      });

      if (!applicability.length) return 'No applicable controls found';

      return applicability
        .map((a) => `${a.control.code} [${a.control.framework.type}]: ${a.control.title}`)
        .join('\n');
    } catch {
      return 'Control applicability unavailable';
    }
  }

  private async getControlStatusSummary(orgId: string): Promise<string> {
    try {
      const statusCounts = await this.prisma.organizationControl.groupBy({
        by: ['status'],
        where: { orgId },
        _count: true,
      });

      const total = statusCounts.reduce((sum, s) => sum + s._count, 0);
      const implemented = statusCounts.find((s) => s.status === 'implemented')?._count ?? 0;

      const lines = statusCounts.map((s) => `  ${s.status}: ${s._count}`).join('\n');
      return `Total: ${total} controls\nImplemented: ${implemented}/${total}\n${lines}`;
    } catch {
      return 'Control status unavailable';
    }
  }

  private async getRiskSummary(orgId: string): Promise<string> {
    try {
      const risks = await this.prisma.riskItem.findMany({
        where: { orgId, status: 'open' },
        orderBy: { riskScore: 'desc' },
        take: 10,
      });

      if (!risks.length) return 'No open risks';

      return risks
        .map((r) => `- ${r.title} (score: ${r.riskScore}, ${r.severity ?? 'unknown'} severity)`)
        .join('\n');
    } catch {
      return 'Risk data unavailable';
    }
  }

  private async getPolicySummary(orgId: string): Promise<string> {
    try {
      const policies = await this.prisma.policy.findMany({
        where: { orgId, status: { not: 'archived' } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      });

      if (!policies.length) return 'No policies created yet';

      return policies
        .map((p) => `- ${p.title} (v${p.version}, ${p.status})`)
        .join('\n');
    } catch {
      return 'Policy data unavailable';
    }
  }

  private async getScopeSummary(orgId: string): Promise<string> {
    try {
      const soc2Scope = await this.prisma.soc2Scope.findFirst({
        where: { orgId, status: { not: 'superseded' } },
        orderBy: { version: 'desc' },
      });

      if (!soc2Scope) return 'No scope defined yet';

      const tscs = soc2Scope.trustServiceCategories as string[];
      return `SOC 2 scope: ${tscs?.join(', ') ?? 'not defined'} | Type: ${soc2Scope.auditType ?? 'not set'} | Status: ${soc2Scope.status}`;
    } catch {
      return 'Scope unavailable';
    }
  }
}
