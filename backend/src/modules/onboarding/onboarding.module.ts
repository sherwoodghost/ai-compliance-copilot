import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../../orchestrator/queue.config';
import { OnboardingService } from './onboarding.service';
import { OnboardingController } from './onboarding.controller';
import { ProfileVersioningService } from './profile-versioning.service';
import { DialogueManagerService } from '../../agents/onboarding/dialogue-manager.service';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AGENT_ONBOARDING }),
    LlmGatewayModule,
    TasksModule,
  ],
  providers: [OnboardingService, ProfileVersioningService, DialogueManagerService],
  controllers: [OnboardingController],
  exports: [OnboardingService, ProfileVersioningService],
})
export class OnboardingModule {}
