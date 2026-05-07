import { Module } from '@nestjs/common';
import { ControlPanelService } from './control-panel.service';
import { ControlPanelController } from './control-panel.controller';
import { GatewaysModule } from '../../gateways/gateways.module';

@Module({
  imports: [GatewaysModule],
  providers: [ControlPanelService],
  controllers: [ControlPanelController],
  exports: [ControlPanelService, GatewaysModule],
})
export class ControlPanelModule {}
