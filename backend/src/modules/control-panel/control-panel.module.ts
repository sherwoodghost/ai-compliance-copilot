import { Module } from '@nestjs/common';
import { ControlPanelService } from './control-panel.service';
import { ControlPanelController } from './control-panel.controller';
import { ComplianceGateway } from '../../gateways/compliance.gateway';

@Module({
  providers: [ControlPanelService, ComplianceGateway],
  controllers: [ControlPanelController],
  exports: [ControlPanelService, ComplianceGateway],
})
export class ControlPanelModule {}
