import { Module } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';

@Module({
  providers: [ExceptionsService],
  controllers: [ExceptionsController],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
