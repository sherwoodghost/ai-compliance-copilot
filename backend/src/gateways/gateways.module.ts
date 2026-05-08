import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ComplianceGateway } from './compliance.gateway';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  providers: [ComplianceGateway],
  exports: [ComplianceGateway],
})
export class GatewaysModule {}
