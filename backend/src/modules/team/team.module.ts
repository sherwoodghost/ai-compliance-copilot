import { Module } from '@nestjs/common';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { RaciService } from './raci.service';

@Module({
  providers: [TeamService, RaciService],
  controllers: [TeamController],
  exports: [TeamService, RaciService],
})
export class TeamModule {}
