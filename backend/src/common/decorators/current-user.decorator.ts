import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  role: string;
  platformRole?: string; // PlatformRole (owner | admin | contributor | approver | viewer | auditor_external)
  status?: string;       // UserStatus (active | suspended | offboarding | deactivated)
  type: 'access' | 'refresh';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
