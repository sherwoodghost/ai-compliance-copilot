import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AgentSchedulerService } from './agent-scheduler.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { ComplianceJourneyModule } from '../compliance-journey/compliance-journey.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QUEUE_NAMES } from '../orchestrator/queue.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AGENT_EVIDENCE },
      { name: QUEUE_NAMES.AGENT_DRIFT_DETECTOR },
      { name: QUEUE_NAMES.AGENT_GAP_ANALYSIS },
    ),
    ComplianceJourneyModule,
    NotificationsModule,
  ],
  providers: [AgentSchedulerService, NotificationSchedulerService],
  exports: [AgentSchedulerService, NotificationSchedulerService],
})
export class AgentSchedulerModule {}
