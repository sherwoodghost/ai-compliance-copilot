import { Module } from '@nestjs/common';
import { ResendService } from './resend.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

@Module({
  controllers: [NotificationController],
  providers:   [ResendService, NotificationService],
  exports:     [ResendService, NotificationService],
})
export class NotificationsModule {}
