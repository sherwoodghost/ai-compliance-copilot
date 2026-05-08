import { Module } from '@nestjs/common';
import { InternalAuditService } from './internal-audit.service';
import { InternalAuditController } from './internal-audit.controller';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [InternalAuditController],
  providers: [InternalAuditService],
  exports: [InternalAuditService],
})
export class InternalAuditModule {}
