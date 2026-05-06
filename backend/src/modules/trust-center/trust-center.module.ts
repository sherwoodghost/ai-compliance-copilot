import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TrustCenterService } from './trust-center.service';
import { TrustCenterController, PublicTrustCenterController } from './trust-center.controller';

@Module({
  imports:     [DatabaseModule],
  providers:   [TrustCenterService],
  controllers: [TrustCenterController, PublicTrustCenterController],
  exports:     [TrustCenterService],
})
export class TrustCenterModule {}
