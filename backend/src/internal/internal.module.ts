import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalAuthController, InternalController } from './internal.controller';
import { InternalAuthGuard } from './internal.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('INTERNAL_JWT_SECRET') ?? cfg.get<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [InternalAuthController, InternalController],
  providers: [InternalAuthGuard],
})
export class InternalModule {}
