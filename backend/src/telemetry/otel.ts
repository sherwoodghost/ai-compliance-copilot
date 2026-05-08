/**
 * OpenTelemetry Setup — E5 Observability & Telemetry
 *
 * This file MUST be imported at the very top of main.ts, before all other imports,
 * for auto-instrumentation to work correctly (OTel instruments at module load time).
 *
 * Install packages to activate:
 *   npm install @opentelemetry/sdk-node \
 *               @opentelemetry/auto-instrumentations-node \
 *               @opentelemetry/exporter-trace-otlp-http \
 *               @opentelemetry/resources \
 *               @opentelemetry/semantic-conventions
 *
 * Environment variables:
 *   OTEL_ENABLED=true                  — master switch (default: false)
 *   OTEL_SERVICE_NAME=compliance-api   — service name in traces
 *   OTEL_EXPORTER_OTLP_ENDPOINT=...    — e.g. http://localhost:4318 (Jaeger/Tempo/Grafana Cloud)
 *
 * If the packages are not installed, this module is a safe no-op.
 */

const OTEL_ENABLED = process.env['OTEL_ENABLED'] === 'true';

if (OTEL_ENABLED) {
  try {
    // Dynamic import so the app compiles without the packages installed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require('@opentelemetry/resources');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } =
      require('@opentelemetry/semantic-conventions');

    const sdk = new NodeSDK({
      resource: new Resource({
        [SEMRESATTRS_SERVICE_NAME]:    process.env['OTEL_SERVICE_NAME'] ?? 'compliance-api',
        [SEMRESATTRS_SERVICE_VERSION]: process.env['npm_package_version'] ?? '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
          ? `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']}/v1/traces`
          : 'http://localhost:4318/v1/traces',
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable noisy instrumentations we don't need
          '@opentelemetry/instrumentation-dns':  { enabled: false },
          '@opentelemetry/instrumentation-net':  { enabled: false },
          '@opentelemetry/instrumentation-fs':   { enabled: false },
          // Keep HTTP, NestJS, Prisma, BullMQ, Redis
          '@opentelemetry/instrumentation-http': { enabled: true },
        }),
      ],
    });

    sdk.start();
    console.info('[OTel] OpenTelemetry SDK started — traces exported to', process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] ?? 'http://localhost:4318');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown().then(
        () => console.info('[OTel] SDK shut down'),
        (err: unknown) => console.error('[OTel] Shutdown error', err),
      );
    });
  } catch (err: unknown) {
    console.warn(
      '[OTel] OpenTelemetry packages not installed — tracing disabled. ' +
      'Run: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node ' +
      '@opentelemetry/exporter-trace-otlp-http',
    );
  }
} else {
  if (process.env['NODE_ENV'] !== 'production') {
    // Development hint — suppress in prod to keep logs clean
    // console.debug('[OTel] Tracing disabled. Set OTEL_ENABLED=true to enable.');
  }
}

// ── Span helper (no-op safe) ──────────────────────────────────────────────────
// Use this in services for manual spans. Falls back to a no-op if OTel is not installed.
export interface SpanOptions {
  attributes?: Record<string, string | number | boolean>;
}

export async function withSpan<T>(
  name:     string,
  fn:       () => Promise<T>,
  opts?:    SpanOptions,
): Promise<T> {
  if (!OTEL_ENABLED) return fn();

  try {
    const { trace, SpanStatusCode } = require('@opentelemetry/api');
    const tracer = trace.getTracer('compliance-api');
    return tracer.startActiveSpan(name, { attributes: opts?.attributes ?? {} }, async (span: any) => {
      try {
        const result = await fn();
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err?.message });
        throw err;
      } finally {
        span.end();
      }
    });
  } catch {
    // OTel API not available — run fn directly
    return fn();
  }
}
