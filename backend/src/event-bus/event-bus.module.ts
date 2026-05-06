import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../orchestrator/queue.config';
import { BullMqEventBusService } from './bullmq-event-bus.service';
import { EVENT_BUS } from './event-bus.interface';

const ALL_QUEUES = Object.values(QUEUE_NAMES)
  .filter((name) => name !== QUEUE_NAMES.WORKFLOW && name !== QUEUE_NAMES.AGENT_ONBOARDING)
  .map((name) => BullModule.registerQueue({ name }));

@Module({
  imports: ALL_QUEUES,
  providers: [
    BullMqEventBusService,
    {
      // Swap BullMqEventBusService → KafkaEventBusService here to change transport
      provide: EVENT_BUS,
      useExisting: BullMqEventBusService,
    },
  ],
  exports: [EVENT_BUS, BullMqEventBusService],
})
export class EventBusModule {}
