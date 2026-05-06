import { Module } from '@nestjs/common';
import { ScopingService } from './scoping.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ScopingService],
  exports: [ScopingService],
})
export class ScopingModule {}
