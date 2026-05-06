import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ComplianceGateway } from './compliance.gateway';

@Module({
  imports: [JwtModule.register({})],
  providers: [ComplianceGateway],
  exports: [ComplianceGateway],
})
export class GatewaysModule {}
