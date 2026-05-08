import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessModule } from '../../readiness/readiness.module';
import { VelocityService } from './velocity.service';
import { BenchmarkService } from './benchmark.service';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [ReadinessModule, LlmModule, DatabaseModule],
  providers: [VelocityService, BenchmarkService],
  controllers: [ReadinessController],
})
export class ReadinessApiModule {}
