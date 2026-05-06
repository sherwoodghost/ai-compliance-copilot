import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

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

  // CORS
  app.enableCors({
    origin: [frontendUrl],
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
