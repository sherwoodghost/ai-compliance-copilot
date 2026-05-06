import { Module } from '@nestjs/common';
import { FrameworksService } from './frameworks.service';
import { FrameworksController } from './frameworks.controller';

@Module({
  providers: [FrameworksService],
  controllers: [FrameworksController],
  exports: [FrameworksService],
})
export class FrameworksModule {}
