import { Module } from '@nestjs/common';
import { ControlTestsApiController } from './control-tests-api.controller';
import { ControlTestsModule } from '../../control-tests/control-tests.module';
import { MonitoringModule } from '../../monitoring/monitoring.module';

@Module({
  imports:     [ControlTestsModule, MonitoringModule],
  controllers: [ControlTestsApiController],
})
export class ControlTestsApiModule {}
