/**
 * Structured Logger — E5 Observability
 *
 * Wraps Pino for structured JSON logging with:
 *   - Consistent fields: level, timestamp, service, orgId?, userId?, action?, durationMs?, error?
 *   - No PII in log lines (emails, names, passwords are excluded)
 *   - NestJS-compatible logger interface
 *
 * Pino is already installed as a project dependency.
 *
 * Usage in services:
 *   import { createStructuredLogger } from '../../telemetry/logger';
 *   const logger = createStructuredLogger('DocumentsService');
 *   logger.info({ orgId, action: 'document.update', durationMs: 45 }, 'Document updated');
 */
import pino from 'pino';
import type { LoggerService } from '@nestjs/common';

const BASE_LOGGER = pino({
  level:      process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'production' ? 'info' : 'debug'),
  name:       process.env['OTEL_SERVICE_NAME'] ?? 'compliance-api',
  timestamp:  pino.stdTimeFunctions.isoTime,
  // In production, output as JSON. In dev, use pretty-printing if pino-pretty is installed.
  ...(process.env['NODE_ENV'] !== 'production' && {
    transport: {
      target:  'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname', translateTime: 'SYS:HH:MM:ss' },
    },
  }),
  // Redact sensitive fields to prevent PII in logs
  redact: {
    paths: [
      'password', 'passwordHash', 'token', 'tokenHash',
      'email',    // Do NOT log emails in production traces
      'body.password', 'body.email', 'req.body.password',
    ],
    censor: '[REDACTED]',
  },
});

/** Create a child logger scoped to a module/service name. */
export function createStructuredLogger(service: string): pino.Logger {
  return BASE_LOGGER.child({ service });
}

/**
 * NestJS-compatible logger that writes structured JSON via Pino.
 * Pass to NestFactory.create({ logger: new PinoNestLogger() }) in main.ts
 * to replace NestJS's default console logger.
 */
export class PinoNestLogger implements LoggerService {
  private readonly logger: pino.Logger;

  constructor(context?: string) {
    this.logger = context ? BASE_LOGGER.child({ context }) : BASE_LOGGER;
  }

  log(message: unknown, context?: string):   void { this.logger.info(  { context }, String(message)); }
  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string):  void { this.logger.warn(  { context }, String(message)); }
  debug(message: unknown, context?: string): void { this.logger.debug( { context }, String(message)); }
  verbose(message: unknown, context?: string): void { this.logger.trace({ context }, String(message)); }
}
