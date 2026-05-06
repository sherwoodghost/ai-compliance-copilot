import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.refreshSecret')!,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.split(' ')[1];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    // Verify the token exists in DB and is not revoked
    const session = await this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: { select: { id: true, isActive: true, role: true, orgId: true, email: true } } },
    });

    if (!session || session.isRevoked) {
      throw new UnauthorizedException('Refresh token revoked or not found');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!session.user.isActive) {
      throw new UnauthorizedException('User inactive');
    }

    return {
      sub: session.user.id,
      email: session.user.email,
      orgId: session.user.orgId,
      role: session.user.role,
      sessionId: session.id,
      refreshToken,
    };
  }
}
