import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { SsoService } from './sso.service';
import { SsoController } from './sso.controller';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Secrets are loaded dynamically per-call in auth.service.ts
    NotificationsModule,
  ],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, SsoService],
  controllers: [AuthController, SsoController],
  exports: [AuthService, SsoService],
})
export class AuthModule {}
