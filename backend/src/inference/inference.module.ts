import { Module } from '@nestjs/common';
import { InferenceService } from './inference.service';
import { InferenceRulesService } from './inference-rules.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [InferenceService, InferenceRulesService],
  exports: [InferenceService, InferenceRulesService],
})
export class InferenceModule {}
