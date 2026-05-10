import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ControlPanelService } from './control-panel.service';
import { ControlPanelController } from './control-panel.controller';
import { ComplianceGateway } from '../../gateways/compliance.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [ControlPanelService, ComplianceGateway],
  controllers: [ControlPanelController],
  exports: [ControlPanelService, ComplianceGateway],
})
export class ControlPanelModule {}
