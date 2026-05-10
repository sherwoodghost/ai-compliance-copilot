import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BaseFrameworkExpertAgent, OrgContext, GapAnalysisResult, GapResult } from './base-framework-expert.agent';
import { Iso27001ExpertAgent } from './iso27001-expert.agent';
import { Soc2ExpertAgent } from './soc2-expert.agent';
import { Iso9001ExpertAgent } from './iso9001-expert.agent';
import { GdprExpertAgent } from './gdpr-expert.agent';
import { HipaaExpertAgent } from './hipaa-expert.agent';
import { PciDssExpertAgent } from './pci-dss-expert.agent';
import { NistCsfExpertAgent } from './nist-csf-expert.agent';
import { FedRampExpertAgent } from './fedramp-expert.agent';

const FRAMEWORK_ID_MAP: Record<string, string> = {
  SOC2: 'soc2', SOC2_TYPE1: 'soc2', SOC2_TYPE2: 'soc2',
  ISO27001: 'iso27001', ISO9001: 'iso9001', GDPR: 'gdpr',
  HIPAA: 'hipaa', PCI_DSS: 'pci-dss', NIST_CSF: 'nist-csf', NIST: 'nist-csf',
  FedRAMP: 'fedramp', FEDRAMP: 'fedramp',
};

@Injectable()
export class FrameworkExpertOrchestrator {
  private readonly logger = new Logger(FrameworkExpertOrchestrator.name);
  private readonly expertMap: Map<string, BaseFrameworkExpertAgent>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly iso27001: Iso27001ExpertAgent,
    private readonly soc2: Soc2ExpertAgent,
    private readonly iso9001: Iso9001ExpertAgent,
    private readonly gdpr: GdprExpertAgent,
    private readonly hipaa: HipaaExpertAgent,
    private readonly pciDss: PciDssExpertAgent,
    private readonly nistCsf: NistCsfExpertAgent,
    private readonly fedramp: FedRampExpertAgent,
  ) {
    this.expertMap = new Map<string, BaseFrameworkExpertAgent>([
      ['iso27001', iso27001], ['soc2', soc2], ['iso9001', iso9001],
      ['gdpr', gdpr], ['hipaa', hipaa], ['pci-dss', pciDss],
      ['nist-csf', nistCsf], ['fedramp', fedramp],
    ]);
  }

  async analyzeGaps(orgId: string): Promise<{ results: GapAnalysisResult[]; aggregated: { gaps: GapResult[]; overallReadiness: number; prioritizedActions: string[] } }> {
    const { experts, orgContext } = await this.resolveExperts(orgId);
    if (experts.length === 0) {
      return { results: [], aggregated: { gaps: [], overallReadiness: 0, prioritizedActions: ['Select compliance frameworks in your organization settings'] } };
    }

    const settled = await Promise.allSettled(experts.map(e => e.analyzeGap(orgContext)));
    const results: GapAnalysisResult[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
      else this.logger.warn(`Expert failed: ${r.reason}`);
    }

    // Deduplicate gaps by controlCode
    const seen = new Set<string>();
    const allGaps: GapResult[] = [];
    for (const r of results) {
      for (const g of r.gaps) {
        if (!seen.has(g.controlCode)) { seen.add(g.controlCode); allGaps.push(g); }
      }
    }
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    allGaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const overallReadiness = results.length > 0
      ? Math.min(...results.map(r => r.readinessPercent))
      : 0;
    const prioritizedActions = results.flatMap(r => r.prioritizedActions).slice(0, 10);

    return { results, aggregated: { gaps: allGaps, overallReadiness, prioritizedActions } };
  }

  async explainRequirement(orgId: string, clauseOrCode: string): Promise<string> {
    const { experts, orgContext } = await this.resolveExperts(orgId);
    const expert = this.findExpertForCode(clauseOrCode, experts) ?? experts[0];
    if (!expert) return `No framework expert available for code: ${clauseOrCode}`;
    return expert.explainRequirement(clauseOrCode, orgContext);
  }

  private async resolveExperts(orgId: string): Promise<{ experts: BaseFrameworkExpertAgent[]; orgContext: OrgContext }> {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      include: { organization: { select: { name: true } } },
    });

    if (!profile) {
      return { experts: [], orgContext: { orgName: 'Unknown', industry: 'Unknown', employeeCount: '0', cloudProviders: [], dataTypes: [], operatingRegions: [], techStack: [] } };
    }

    const goals = (profile.complianceGoals as any) ?? {};
    const infra = (profile.infrastructure as any) ?? {};
    const dataHandling = (profile.dataHandling as any) ?? {};
    const targetFrameworks: string[] = goals.targetFrameworks ?? [];

    const normalizedIds = targetFrameworks
      .map(fw => FRAMEWORK_ID_MAP[fw] ?? fw.toLowerCase().replace(/_/g, '-'))
      .filter((v, i, a) => a.indexOf(v) === i);

    const experts = normalizedIds
      .map(id => this.expertMap.get(id))
      .filter((e): e is BaseFrameworkExpertAgent => !!e);

    const orgContext: OrgContext = {
      orgName: (profile.organization as any)?.name ?? profile.companyName ?? 'Unknown',
      industry: profile.industry ?? 'Unknown',
      employeeCount: profile.employeeCount ?? 'Unknown',
      cloudProviders: infra.cloudProviders ?? [],
      dataTypes: dataHandling.dataTypes ?? [],
      operatingRegions: profile.operatesIn ?? [],
      techStack: infra.tools ?? [],
    };

    return { experts, orgContext };
  }

  private findExpertForCode(code: string, experts: BaseFrameworkExpertAgent[]): BaseFrameworkExpertAgent | undefined {
    return experts.find(e => e.isFrameworkControl(code));
  }
}
