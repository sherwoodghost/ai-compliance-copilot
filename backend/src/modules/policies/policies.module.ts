import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PolicyTemplateService } from './policy-template.service';
import { PoliciesController } from './policies.controller';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [LlmGatewayModule, LlmModule],
  providers: [PoliciesService, PolicyTemplateService],
  controllers: [PoliciesController],
  exports: [PoliciesService, PolicyTemplateService],
})
export class PoliciesModule {}
