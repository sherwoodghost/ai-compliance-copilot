import { Module } from '@nestjs/common';
import { ControlsService } from './controls.service';
import { ControlsController } from './controls.controller';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [LlmModule],
  providers: [ControlsService],
  controllers: [ControlsController],
  exports: [ControlsService],
})
export class ControlsModule {}
