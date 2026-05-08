import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { NotificationsModule } from '../../notifications/notifications.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports:     [NotificationsModule, LlmModule],
  providers:   [TasksService],
  controllers: [TasksController],
  exports:     [TasksService],
})
export class TasksModule {}
