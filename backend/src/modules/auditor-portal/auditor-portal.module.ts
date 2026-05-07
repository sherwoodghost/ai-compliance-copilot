import { Module } from '@nestjs/common';
import { AuditorPortalService } from './auditor-portal.service';
import { AuditorPortalController } from './auditor-portal.controller';

@Module({
  providers: [AuditorPortalService],
  controllers: [AuditorPortalController],
  exports: [AuditorPortalService],
})
export class AuditorPortalModule {}
