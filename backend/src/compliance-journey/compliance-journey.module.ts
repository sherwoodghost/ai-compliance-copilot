import { Module, forwardRef } from '@nestjs/common';
import { ComplianceJourneyService } from './compliance-journey.service';
import { ComplianceJourneyController } from './compliance-journey.controller';
import { GatewaysModule } from '../gateways/gateways.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [forwardRef(() => GatewaysModule), LlmModule],
  providers: [ComplianceJourneyService],
  controllers: [ComplianceJourneyController],
  exports: [ComplianceJourneyService],
})
export class ComplianceJourneyModule {}
