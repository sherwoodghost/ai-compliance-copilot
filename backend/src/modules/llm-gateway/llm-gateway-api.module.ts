import { Module } from '@nestjs/common';
import { LlmGatewayController } from './llm-gateway.controller';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [LlmGatewayModule, DatabaseModule],
  controllers: [LlmGatewayController],
})
export class LlmGatewayApiModule {}
