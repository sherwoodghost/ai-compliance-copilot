import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

export interface InternalJwtPayload {
  sub: string;
  email: string;
  role: 'platform_admin';
  aud: 'internal';
  iat: number;
  exp: number;
}

@Injectable()
export class InternalAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException();
    }

    const token = auth.slice(7);
    try {
      const secret = this.config.get<string>('INTERNAL_JWT_SECRET') ?? this.config.get<string>('JWT_SECRET');
      const payload = this.jwt.verify<InternalJwtPayload>(token, {
        secret,
        audience: 'internal',
      });
      (req as any).internalUser = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
