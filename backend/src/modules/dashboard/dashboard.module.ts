import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DatabaseModule } from '../../database/database.module';
import { DashboardLayoutService } from './dashboard-layout.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardController],
  providers: [DashboardLayoutService],
  exports: [DashboardLayoutService],
})
export class DashboardApiModule {}
