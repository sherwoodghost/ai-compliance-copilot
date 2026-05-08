import { Module } from '@nestjs/common';
import { VendorRiskController } from './vendor-risk.controller';
import { DatabaseModule } from '../../database/database.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [DatabaseModule, LlmModule],
  controllers: [VendorRiskController],
})
export class VendorRiskModule {}
