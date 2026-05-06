import { Module } from '@nestjs/common';
import { VendorRiskController } from './vendor-risk.controller';

@Module({
  controllers: [VendorRiskController],
})
export class VendorRiskModule {}
