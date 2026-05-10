import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class Iso27001ExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'iso27001';
  readonly frameworkDisplayName = 'ISO/IEC 27001:2022';
  protected readonly agentName = 'framework-expert-iso27001';
  protected readonly expertSystemContext = `You are an ISO/IEC 27001:2022 Information Security Management System (ISMS) specialist.

Key vocabulary: ISMS, Statement of Applicability (SoA), risk treatment plan, Annex A controls, clause requirements, certification body (CB), Stage 1/Stage 2 audit, surveillance audit, nonconformity (major/minor), corrective action, continual improvement.

Structure:
- Clauses 4–10: mandatory ISMS requirements (context, leadership, planning, support, operation, performance evaluation, improvement)
- Annex A: 93 controls in 4 themes — A.5 Organizational (37), A.6 People (8), A.7 Physical (14), A.8 Technological (34)

Critical compliance points:
- Clause 6.1.2: formal risk assessment methodology required
- Clause 9.2: internal audit program mandatory
- Clause 9.3: management review with defined inputs/outputs
- A.5.1: information security policy approved by top management
- A.8.2: privileged access rights must be restricted and managed
- All 93 Annex A controls must be considered in the SoA — exclusions require justification`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'A.';
  }

  isFrameworkControl(code: string): boolean {
    return /^A\.\d+\.\d+/.test(code) || /^ISO27001/.test(code);
  }
}
