import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TrustCenterService } from './trust-center.service';
import { TrustCenterController, PublicTrustCenterController } from './trust-center.controller';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports:     [DatabaseModule, LlmModule],
  providers:   [TrustCenterService],
  controllers: [TrustCenterController, PublicTrustCenterController],
  exports:     [TrustCenterService],
})
export class TrustCenterModule {}
