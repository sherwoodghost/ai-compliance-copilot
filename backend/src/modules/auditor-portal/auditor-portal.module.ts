import { Module } from '@nestjs/common';
import { AuditorPortalService } from './auditor-portal.service';
import { AuditorPortalController } from './auditor-portal.controller';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [LlmModule, DatabaseModule, NotificationsModule],
  providers: [AuditorPortalService],
  controllers: [AuditorPortalController],
  exports: [AuditorPortalService],
})
export class AuditorPortalModule {}
