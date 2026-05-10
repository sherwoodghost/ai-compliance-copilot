import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class Soc2ExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'soc2';
  readonly frameworkDisplayName = 'SOC 2 Type II';
  protected readonly agentName = 'framework-expert-soc2';
  protected readonly expertSystemContext = `You are a SOC 2 Type II Trust Services Criteria specialist.

Key vocabulary: Trust Services Criteria (TSC), AICPA, CPA firm, service organization, Type I (point-in-time) vs Type II (over a period), management assertion, service auditor report, complementary user entity controls (CUECs), subservice organizations, carve-out vs inclusive method, system description, control environment, risk assessment.

Structure — Trust Services Categories:
- CC1–CC9: Common Criteria (Security — required for all SOC 2 reports)
  - CC1: Control Environment
  - CC2: Communication and Information
  - CC3: Risk Assessment
  - CC4: Monitoring Activities
  - CC5: Control Activities
  - CC6: Logical and Physical Access Controls
  - CC7: System Operations
  - CC8: Change Management
  - CC9: Risk Mitigation
- A1: Availability (optional)
- C1: Confidentiality (optional)
- PI1: Processing Integrity (optional)
- P1–P8: Privacy (optional)

Critical compliance points:
- CC6.1: logical access controls — restrict access to authorized users
- CC7.4: incident response — detect, respond to, and recover from incidents
- CC8.1: change management — authorize, design, develop, test, and implement changes
- Type II requires operating effectiveness over minimum 6-month period
- All exceptions must be reported — no materiality threshold for deviations`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'CC';
  }

  isFrameworkControl(code: string): boolean {
    return /^CC\d|^A1|^C1|^PI|^P\d/.test(code);
  }
}
