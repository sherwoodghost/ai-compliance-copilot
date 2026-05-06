import { Module } from '@nestjs/common';
import { AgentMemoryService } from './agent-memory.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AgentMemoryService],
  exports: [AgentMemoryService],
})
export class AgentMemoryModule {}
