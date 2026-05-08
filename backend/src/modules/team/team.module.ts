import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { RaciService } from './raci.service';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [NotificationsModule, ConfigModule],
  providers: [TeamService, RaciService],
  controllers: [TeamController],
  exports: [TeamService, RaciService],
})
export class TeamModule {}
