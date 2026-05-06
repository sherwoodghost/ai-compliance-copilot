import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IntegrationsCoreModule } from '../integrations/integrations-core.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ControlTestRegistry } from './control-test.registry';
import { ControlTestRunnerService } from './control-test-runner.service';

@Module({
  imports: [
    DatabaseModule,
    IntegrationsCoreModule,   // provides SecretManagerService
    NotificationsModule,      // provides ResendService
  ],
  providers: [
    ControlTestRegistry,
    ControlTestRunnerService,
  ],
  exports: [
    ControlTestRegistry,
    ControlTestRunnerService,
  ],
})
export class ControlTestsModule {}
