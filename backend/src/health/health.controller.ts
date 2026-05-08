import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../database/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check — DB, Redis, uptime' })
  async check() {
    // ── Database ─────────────────────────────────────────────────────────────
    let dbStatus = 'ok';
    const dbStart = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'error';
    }
    const dbLatencyMs = Date.now() - dbStart;

    // ── Redis ─────────────────────────────────────────────────────────────────
    let redisStatus = 'ok';
    let redisLatencyMs = 0;
    const redisStart = Date.now();
    try {
      const redis = new Redis({
        host:        this.config.get<string>('redis.host') ?? 'localhost',
        port:        this.config.get<number>('redis.port') ?? 6379,
        password:    this.config.get<string>('redis.password') || undefined,
        tls:         this.config.get<boolean>('redis.tls') ? {} : undefined,
        lazyConnect: true,
        connectTimeout:  2000,
        commandTimeout:  2000,
        enableReadyCheck: false,
      });
      await redis.ping();
      await redis.quit();
      redisLatencyMs = Date.now() - redisStart;
    } catch {
      redisStatus   = 'error';
      redisLatencyMs = Date.now() - redisStart;
    }

    const allOk   = dbStatus === 'ok' && redisStatus === 'ok';
    const anyDown = dbStatus === 'error' || redisStatus === 'error';

    return {
      status:     anyDown ? 'degraded' : 'ok',
      db:         { status: dbStatus,    latencyMs: dbLatencyMs },
      redis:      { status: redisStatus, latencyMs: redisLatencyMs },
      uptime:     Math.floor(process.uptime()),
      timestamp:  new Date().toISOString(),
      version:    process.env['npm_package_version'] ?? '1.0.0',
    };
  }
}
