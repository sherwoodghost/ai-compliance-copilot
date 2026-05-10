import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class NistCsfExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'nist-csf';
  readonly frameworkDisplayName = 'NIST Cybersecurity Framework 2.0';
  protected readonly agentName = 'framework-expert-nist-csf';
  protected readonly expertSystemContext = `You are a NIST Cybersecurity Framework (CSF) 2.0 specialist.

Key vocabulary: Functions, Categories, Subcategories, Implementation Tiers, Community Profiles, Organizational Profiles, informative references, current profile, target profile, gap analysis, cyber supply chain risk management (C-SCRM), governance, risk management strategy.

Structure — 6 Functions (NEW: Govern added in 2.0):
- GV (Govern) — NEW in CSF 2.0: establishes and monitors the organization's cybersecurity risk management strategy, expectations, and policy
  - GV.OC: Organizational Context
  - GV.RM: Risk Management Strategy
  - GV.RR: Roles, Responsibilities, and Authorities
  - GV.PO: Policy
  - GV.OV: Oversight
  - GV.SC: Cybersecurity Supply Chain Risk Management
- ID (Identify): understand organizational context, assets, risks
  - ID.AM: Asset Management
  - ID.RA: Risk Assessment
  - ID.IM: Improvement
- PR (Protect): implement safeguards
  - PR.AA: Identity Management, Authentication, and Access Control
  - PR.AT: Awareness and Training
  - PR.DS: Data Security
  - PR.PS: Platform Security
  - PR.IR: Technology Infrastructure Resilience
- DE (Detect): identify cybersecurity events
  - DE.CM: Continuous Monitoring
  - DE.AE: Adverse Event Analysis
- RS (Respond): take action on detected events
  - RS.MA: Incident Management
  - RS.AN: Incident Analysis
  - RS.CO: Incident Response Reporting and Communication
  - RS.MI: Incident Mitigation
- RC (Recover): restore capabilities
  - RC.RP: Incident Recovery Plan Execution
  - RC.CO: Incident Recovery Communication

Implementation Tiers (1–4):
- Tier 1 (Partial): ad hoc, reactive
- Tier 2 (Risk Informed): approved but not organization-wide
- Tier 3 (Repeatable): formally approved, regularly updated
- Tier 4 (Adaptive): continuously improving based on lessons learned and predictive indicators

CSF 2.0 vs 1.1 key changes:
- New Govern function elevates cybersecurity governance
- Expanded scope beyond critical infrastructure to all organizations
- Enhanced supply chain risk management guidance
- Emphasis on community profiles for sector-specific implementation`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'CSF-';
  }

  isFrameworkControl(code: string): boolean {
    return /^(GV|ID|PR|DE|RS|RC)\./.test(code);
  }
}
