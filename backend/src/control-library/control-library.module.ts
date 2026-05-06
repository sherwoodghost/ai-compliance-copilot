import { Module } from '@nestjs/common';
import { ControlLibraryService } from './control-library.service';
import { ControlApplicabilityEngine } from './applicability-engine.service';
import { CrosswalkService } from './crosswalk.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ControlLibraryService, ControlApplicabilityEngine, CrosswalkService],
  exports: [ControlLibraryService, ControlApplicabilityEngine, CrosswalkService],
})
export class ControlLibraryModule {}
