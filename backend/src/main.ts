import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// ─── Global Redis/Upstash error guard ──────────────────────────────────────────
// When the Upstash free-tier request limit is reached, IORedis throws on every
// Redis command (including AUTH at connection time). Without these handlers the
// process exits immediately. We catch those specific errors and log a warning so
// the app keeps serving HTTP traffic even without a working Redis/Bull layer.
const isRedisLimitError = (err: unknown) => {
  const msg = (err as any)?.message ?? String(err);
  return msg.includes('max requests limit exceeded') || msg.includes('ERR max requests');
};

process.on('unhandledRejection', (reason) => {
  if (isRedisLimitError(reason)) {
    new Logger('Redis').warn('Upstash request limit exceeded — queued jobs are disabled until limit resets');
    return;
  }
  // Re-throw genuinely unhandled rejections so they aren't silently swallowed
  throw reason;
});

process.on('uncaughtException', (err) => {
  if (isRedisLimitError(err)) {
    new Logger('Redis').warn('Upstash request limit exceeded — queued jobs are disabled until limit resets');
    return;
  }
  throw err;
});

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3001;
  const apiPrefix = configService.get<string>('apiPrefix') ?? 'api/v1';
  const frontendUrl = configService.get<string>('frontendUrl') ?? 'http://localhost:3000';
  const nodeEnv = configService.get<string>('nodeEnv') ?? 'development';

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS — allow configured FRONTEND_URL plus any Vercel preview deployments
  const allowedOrigins = [
    frontendUrl,
    'http://localhost:3000',
    'http://localhost:3001',
  ].filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Swagger, mobile)
      if (!origin) return callback(null, true);
      // Allow configured origins or any Vercel deployment for this project
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/ai-compliance-copilot.*\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-org-id'],
  });

  // Global prefix
  app.setGlobalPrefix(apiPrefix);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger (non-production)
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI Compliance Copilot API')
      .setDescription('SOC 2 and ISO 27001 compliance automation platform')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('organizations', 'Organization management')
      .addTag('users', 'User management')
      .addTag('controls', 'Compliance controls')
      .addTag('evidence', 'Evidence management')
      .addTag('workflows', 'Agent workflows')
      .addTag('onboarding', 'Onboarding system')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  }

  await app.listen(port);
  logger.log(`Application running on port ${port} [${nodeEnv}]`);
}

bootstrap();
