import { Module } from '@nestjs/common';
import { ExceptionsService } from './exceptions.service';
import { ExceptionsController } from './exceptions.controller';
import { LlmModule } from '../../llm/llm.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [LlmModule, DatabaseModule],
  providers: [ExceptionsService],
  controllers: [ExceptionsController],
  exports: [ExceptionsService],
})
export class ExceptionsModule {}
