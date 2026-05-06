import { Module } from '@nestjs/common';
import { PoliciesService } from './policies.service';
import { PoliciesController } from './policies.controller';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';

@Module({
  imports: [LlmGatewayModule],
  providers: [PoliciesService],
  controllers: [PoliciesController],
  exports: [PoliciesService],
})
export class PoliciesModule {}
