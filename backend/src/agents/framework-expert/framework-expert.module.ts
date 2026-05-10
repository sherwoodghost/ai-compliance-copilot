import { Module } from '@nestjs/common';
import { Iso27001ExpertAgent } from './iso27001-expert.agent';
import { Soc2ExpertAgent } from './soc2-expert.agent';
import { Iso9001ExpertAgent } from './iso9001-expert.agent';
import { GdprExpertAgent } from './gdpr-expert.agent';
import { HipaaExpertAgent } from './hipaa-expert.agent';
import { PciDssExpertAgent } from './pci-dss-expert.agent';
import { NistCsfExpertAgent } from './nist-csf-expert.agent';
import { FedRampExpertAgent } from './fedramp-expert.agent';
import { FrameworkExpertOrchestrator } from './orchestrator.service';

const EXPERT_AGENTS = [
  Iso27001ExpertAgent, Soc2ExpertAgent, Iso9001ExpertAgent, GdprExpertAgent,
  HipaaExpertAgent, PciDssExpertAgent, NistCsfExpertAgent, FedRampExpertAgent,
];

@Module({
  providers: [...EXPERT_AGENTS, FrameworkExpertOrchestrator],
  exports: [...EXPERT_AGENTS, FrameworkExpertOrchestrator],
})
export class FrameworkExpertModule {}
