import { Module } from '@nestjs/common';
import { ControlLibraryController } from './control-library.controller';
import { ControlLibraryModule } from '../../control-library/control-library.module';

@Module({
  imports: [ControlLibraryModule],
  controllers: [ControlLibraryController],
})
export class ControlLibraryApiModule {}
