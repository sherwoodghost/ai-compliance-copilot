import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip } = request;

    const mutateMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutateMethods.includes(method) || !user) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.prisma.auditLog.create({
            data: {
              orgId: user.orgId,
              userId: user.sub,
              action: `${method.toLowerCase()}:${url}`,
              ipAddress: ip,
            },
          });
        } catch (err) {
          this.logger.error('Failed to write audit log', err);
        }
      }),
    );
  }
}
