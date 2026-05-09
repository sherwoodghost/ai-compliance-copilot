import { Module } from '@nestjs/common';
import { ControlLibraryService } from './control-library.service';
import { ControlApplicabilityEngine } from './applicability-engine.service';
import { CrosswalkService } from './crosswalk.service';
import { ApplicabilityReviewerService } from './applicability-reviewer.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [DatabaseModule, LlmModule],
  providers: [ControlLibraryService, ControlApplicabilityEngine, CrosswalkService, ApplicabilityReviewerService],
  exports: [ControlLibraryService, ControlApplicabilityEngine, CrosswalkService, ApplicabilityReviewerService],
})
export class ControlLibraryModule {}
