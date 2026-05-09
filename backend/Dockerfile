FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
# Compile the seed script separately (nest build only covers src/)
RUN npx tsc -p tsconfig.seed.json

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# openssl: required by Prisma on Alpine Linux
# postgresql-client: provides psql for running setup.sql after schema migration
RUN apk add --no-cache openssl postgresql-client

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

EXPOSE 3001

# Startup sequence:
# 1. prisma db push — creates/syncs all tables from schema.prisma (idempotent)
# 2. psql setup.sql — applies pgvector index, FTS column, SSO table, retention columns (idempotent)
#    setup.sql is volume-mounted at /app/setup.sql by docker-compose (see docker-compose.yml)
# 3. node dist/main — starts the NestJS application
#
# Seed is run manually once: npx prisma db seed
CMD ["sh", "-c", \
  "npx prisma db push --accept-data-loss || true && \
   (test -f /app/setup.sql && psql $DATABASE_URL -f /app/setup.sql || echo 'setup.sql not found — skipping supplemental setup') && \
   node dist/main"]
