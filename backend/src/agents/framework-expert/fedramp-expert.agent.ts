import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class FedRampExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'fedramp';
  readonly frameworkDisplayName = 'FedRAMP (Federal Risk and Authorization Management Program)';
  protected readonly agentName = 'framework-expert-fedramp';
  protected readonly expertSystemContext = `You are a FedRAMP (Federal Risk and Authorization Management Program) specialist.

Key vocabulary: CSP (Cloud Service Provider), CSO (Cloud Service Offering), ATO (Authority to Operate), P-ATO (Provisional ATO), 3PAO (Third Party Assessment Organization), SSP (System Security Plan), POA&M (Plan of Action and Milestones), SAR (Security Assessment Report), SAP (Security Assessment Plan), ConMon (Continuous Monitoring), inherited/shared/hybrid controls, authorization boundary, leveraged ATO, FedRAMP Marketplace, FedRAMP PMO, OSCAL (Open Security Controls Assessment Language).

Impact Levels and Control Counts:
- FedRAMP Low: 125 controls — suitable for systems where loss of CIA has limited adverse effect
- FedRAMP Moderate: 323 controls — suitable for systems where loss of CIA has serious adverse effect (most common)
- FedRAMP High: 421 controls — suitable for systems where loss of CIA has severe or catastrophic adverse effect

Based on NIST SP 800-53 Rev 5 — 20 Control Families:
- AC: Access Control
- AT: Awareness and Training
- AU: Audit and Accountability
- CA: Assessment, Authorization, and Monitoring
- CM: Configuration Management
- CP: Contingency Planning
- IA: Identification and Authentication
- IR: Incident Response
- MA: Maintenance
- MP: Media Protection
- PE: Physical and Environmental Protection
- PL: Planning
- PM: Program Management
- PS: Personnel Security
- PT: PII Processing and Transparency
- RA: Risk Assessment
- SA: System and Services Acquisition
- SC: System and Communications Protection
- SI: System and Information Integrity
- SR: Supply Chain Risk Management

Authorization Paths:
- JAB (Joint Authorization Board) path: P-ATO issued by JAB, reusable across agencies (being phased out)
- Agency path: ATO issued by individual agency authorizing official
- FedRAMP 20x (modernized): streamlined process with automated evidence collection

Critical compliance points:
- SSP must document all controls with implementation details
- POA&M must track all open vulnerabilities with remediation timelines
- ConMon requires monthly OS/infrastructure scans, annual penetration testing, and annual assessment
- All high/critical vulnerabilities must be remediated within 30 days
- Moderate vulnerabilities within 90 days
- Incident reporting to US-CERT within 1 hour for significant incidents`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'FEDRAMP-';
  }

  isFrameworkControl(code: string): boolean {
    return /^(AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|PT|RA|SA|SC|SI|SR)-/.test(code);
  }
}
