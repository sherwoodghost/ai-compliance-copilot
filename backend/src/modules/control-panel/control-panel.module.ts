import { Module } from '@nestjs/common';
import { ControlPanelService } from './control-panel.service';
import { ControlPanelController } from './control-panel.controller';
import { GatewaysModule } from '../../gateways/gateways.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [GatewaysModule, LlmModule],
  providers: [ControlPanelService],
  controllers: [ControlPanelController],
  exports: [ControlPanelService, GatewaysModule],
})
export class ControlPanelModule {}
