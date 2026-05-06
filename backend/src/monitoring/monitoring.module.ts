import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MonitoringProcessor } from './monitoring.processor';
import { MonitoringService } from './monitoring.service';
import { ControlTestsModule } from '../control-tests/control-tests.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'monitoring' }),
    ControlTestsModule,
    DatabaseModule,
  ],
  providers: [MonitoringProcessor, MonitoringService],
  exports:   [MonitoringService],
})
export class MonitoringModule {}
