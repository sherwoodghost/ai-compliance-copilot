import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessModule } from '../../readiness/readiness.module';
import { VelocityService } from './velocity.service';

@Module({
  imports: [ReadinessModule],
  providers: [VelocityService],
  controllers: [ReadinessController],
})
export class ReadinessApiModule {}
