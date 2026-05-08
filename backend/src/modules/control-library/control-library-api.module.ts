import { Module } from '@nestjs/common';
import { ControlLibraryController } from './control-library.controller';
import { ControlLibraryModule } from '../../control-library/control-library.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [ControlLibraryModule, LlmModule],
  controllers: [ControlLibraryController],
})
export class ControlLibraryApiModule {}
