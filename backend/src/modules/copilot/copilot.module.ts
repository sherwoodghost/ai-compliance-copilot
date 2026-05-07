import { Module } from '@nestjs/common';
import { CopilotService } from './copilot.service';
import { CopilotController } from './copilot.controller';

@Module({
  providers: [CopilotService],
  controllers: [CopilotController],
})
export class CopilotModule {}
