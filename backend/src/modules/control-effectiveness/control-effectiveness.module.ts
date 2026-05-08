import { Module } from '@nestjs/common';
import { ControlEffectivenessService } from './control-effectiveness.service';
import { ControlEffectivenessController } from './control-effectiveness.controller';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ControlEffectivenessService],
  controllers: [ControlEffectivenessController],
  exports: [ControlEffectivenessService],
})
export class ControlEffectivenessModule {}
