import { Module } from '@nestjs/common';
import { RisksController } from './risks.controller';

@Module({
  controllers: [RisksController],
})
export class RisksModule {}
