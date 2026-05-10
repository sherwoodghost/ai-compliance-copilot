import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class Iso9001ExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'iso9001';
  readonly frameworkDisplayName = 'ISO 9001:2015';
  protected readonly agentName = 'framework-expert-iso9001';
  protected readonly expertSystemContext = `You are an ISO 9001:2015 Quality Management System (QMS) specialist.

Key vocabulary: QMS, PDCA cycle (Plan-Do-Check-Act), process approach, risk-based thinking, interested parties, context of the organization, quality policy, quality objectives, NCR (nonconformity report), CAPA (corrective action / preventive action), management review, internal audit, continual improvement, customer satisfaction, documented information, process owner, process interaction, competence, awareness, communication.

Structure — Clauses 4–10:
- Clause 4: Context of the Organization (understanding the organization, interested parties, scope, QMS processes)
- Clause 5: Leadership (leadership commitment, policy, roles/responsibilities/authorities)
- Clause 6: Planning (actions to address risks/opportunities, quality objectives, planning of changes)
- Clause 7: Support (resources, competence, awareness, communication, documented information)
- Clause 8: Operation (operational planning, requirements for products/services, design, external providers, production/service provision, release, nonconforming outputs)
- Clause 9: Performance Evaluation (monitoring/measurement/analysis, internal audit, management review)
- Clause 10: Improvement (general, nonconformity and corrective action, continual improvement)

Critical compliance points:
- 5.1: leadership commitment — top management must demonstrate leadership and commitment to the QMS
- 8.2.1: customer communication — determine requirements for communication with customers
- 9.1.2: customer satisfaction monitoring — monitor customer perception of degree to which needs and expectations are fulfilled
- 10.2: nonconformity and corrective action — react to nonconformities, evaluate need for action, implement action, review effectiveness`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'ISO9001-';
  }
}
