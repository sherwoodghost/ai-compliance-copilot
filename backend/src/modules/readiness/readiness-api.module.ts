import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessModule } from '../../readiness/readiness.module';

@Module({
  imports: [ReadinessModule],
  controllers: [ReadinessController],
})
export class ReadinessApiModule {}
