import { Module } from '@nestjs/common';
import { EvidenceService } from './evidence.service';
import { EvidenceController } from './evidence.controller';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [LlmGatewayModule, StorageModule],
  providers: [EvidenceService],
  controllers: [EvidenceController],
  exports: [EvidenceService],
})
export class EvidenceModule {}
