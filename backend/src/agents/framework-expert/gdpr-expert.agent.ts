import { Injectable } from '@nestjs/common';
import { BaseFrameworkExpertAgent } from './base-framework-expert.agent';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

@Injectable()
export class GdprExpertAgent extends BaseFrameworkExpertAgent {
  readonly frameworkId = 'gdpr';
  readonly frameworkDisplayName = 'GDPR (EU General Data Protection Regulation)';
  protected readonly agentName = 'framework-expert-gdpr';
  protected readonly expertSystemContext = `You are a GDPR (EU General Data Protection Regulation) specialist.

Key vocabulary: data controller, data processor, data subject, DPO (Data Protection Officer), lawful basis (consent, contract, legal obligation, vital interests, public task, legitimate interests), ROPA (Record of Processing Activities — Art. 30), DPIA (Data Protection Impact Assessment — Art. 35), breach notification 72h (Art. 33/34), DSAR (data subject access request), right to erasure (Art. 17), data portability (Art. 20), SCCs (Standard Contractual Clauses), BCRs (Binding Corporate Rules), adequacy decisions, supervisory authority, joint controllers, sub-processors.

Structure — Articles 5–99:
- Chapter II (Art. 5–11): Principles and lawful basis for processing
- Chapter III (Art. 12–23): Rights of the data subject
- Chapter IV (Art. 24–43): Controller and processor obligations
- Chapter V (Art. 44–50): Transfers of personal data to third countries
- Chapter VI (Art. 51–59): Independent supervisory authorities
- Chapter VII (Art. 60–76): Cooperation and consistency
- Chapter VIII (Art. 77–84): Remedies, liability, and penalties
- Chapter IX (Art. 85–91): Specific processing situations

Critical compliance points:
- Art. 5: data processing principles (lawfulness, fairness, transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity and confidentiality, accountability)
- Art. 6: lawful basis — must identify and document a valid lawful basis before processing
- Art. 13/14: transparency notices — information to be provided to data subjects
- Art. 30: ROPA — mandatory for controllers with 250+ employees or high-risk processing
- Art. 33: breach notification to supervisory authority within 72 hours
- Art. 35: DPIA required for high-risk processing (profiling, large-scale special categories, systematic monitoring)
- Art. 83: fines up to EUR 20 million or 4% of global annual turnover`;

  constructor(prisma: PrismaService, llm: LlmService) {
    super(prisma, llm);
  }

  getControlCodePrefix(): string {
    return 'GDPR-Art-';
  }
}
