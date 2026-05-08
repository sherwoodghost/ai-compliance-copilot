export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  // Note: the version suffix ('/v1') is handled by NestJS URI versioning in main.ts.
  // Setting this to 'api' + enableVersioning keeps URLs identical (GET /api/v1/...)
  // while enabling proper per-controller versioning for future v2 endpoints.
  apiPrefix: process.env.API_PREFIX ?? 'api',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD ?? undefined,
    tls: process.env.REDIS_TLS === 'true',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  llm: {
    provider: process.env.LLM_PROVIDER ?? 'anthropic',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    openrouterDefaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? 'anthropic/claude-sonnet-4.5',
    defaultModel: process.env.DEFAULT_LLM_MODEL ?? 'claude-sonnet-4-6',
  },

  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 's3',
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION ?? 'us-east-1',
      bucket: process.env.AWS_S3_BUCKET,
    },
  },

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
