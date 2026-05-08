import { Module } from '@nestjs/common';
import { ControlEffectivenessService } from './control-effectiveness.service';
import { ControlEffectivenessController } from './control-effectiveness.controller';

@Module({
  providers: [ControlEffectivenessService],
  controllers: [ControlEffectivenessController],
  exports: [ControlEffectivenessService],
})
export class ControlEffectivenessModule {}
