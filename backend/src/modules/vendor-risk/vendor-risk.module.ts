import { Module } from '@nestjs/common';
import { VendorRiskController } from './vendor-risk.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VendorRiskController],
})
export class VendorRiskModule {}
