import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let dbStatus = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }

    return {
      status:    dbStatus === 'ok' ? 'ok' : 'degraded',
      db:        dbStatus,
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
    };
  }
}
