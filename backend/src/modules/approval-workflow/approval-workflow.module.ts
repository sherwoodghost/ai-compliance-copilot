import { Module } from '@nestjs/common';
import { ApprovalWorkflowService } from './approval-workflow.service';
import { ApprovalWorkflowController } from './approval-workflow.controller';
import { DatabaseModule } from '../../database/database.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports:     [DatabaseModule, NotificationsModule],
  providers:   [ApprovalWorkflowService],
  controllers: [ApprovalWorkflowController],
  exports:     [ApprovalWorkflowService],
})
export class ApprovalWorkflowModule {}
