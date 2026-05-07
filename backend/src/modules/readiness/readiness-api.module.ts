import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessModule } from '../../readiness/readiness.module';
import { VelocityService } from './velocity.service';
import { BenchmarkService } from './benchmark.service';

@Module({
  imports: [ReadinessModule],
  providers: [VelocityService, BenchmarkService],
  controllers: [ReadinessController],
})
export class ReadinessApiModule {}
