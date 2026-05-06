import { Module } from '@nestjs/common';
import { ReadinessService } from './readiness.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
