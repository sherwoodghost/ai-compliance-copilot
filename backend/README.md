# Backend — AI Compliance Copilot

NestJS API server powering the compliance platform. Runs on port 3001.

## Module Map

| Module | Path | Purpose |
|--------|------|---------|
| **App** | `src/app.module.ts` | Root module — wires all 20+ modules |
| **Auth** | `src/modules/auth/` | JWT login, refresh, bcrypt passwords |
| **Organizations** | `src/modules/organizations/` | Org CRUD + settings |
| **Users** | `src/modules/users/` | User management, role updates |
| **LLM Gateway** | `src/llm-gateway/` | Compliance-aware LLM call routing, prompt registry, forbidden language detection |
| **Prompt Registry** | `src/llm-gateway/prompt-registry.service.ts` | 19 versioned prompt templates, SHA-256 content hashing |
| **RAG** | `src/llm-gateway/rag/` | pgvector retrieval, tenant-isolated embeddings, in-memory fallback |
| **Control Library** | `src/control-library/` | Source of truth: 58 SOC 2 + ISO 27001 controls, applicability engine |
| **Agents** | `src/agents/` | 18-stage BullMQ compliance pipeline workers |
| **Orchestrator** | `src/orchestrator/` | BullMQ queue wiring, pipeline sequencing |
| **Readiness** | `src/readiness/` | Deterministic scoring formulas (no LLM) |
| **Scoping** | `src/scoping/` | SOC 2 scope + ISO ISMS scope management |
| **Audit Exports** | `src/audit-exports/` | SOC 2 readiness reports, ISO SoA, evidence binders |
| **Compliance Journey** | `src/compliance-journey/` | State machine tracking 18 stages |
| **Gateways** | `src/gateways/` | WebSocket gateway for real-time updates |
| **Risks** | `src/modules/risks/` | Risk register CRUD |
| **Policies** | `src/modules/policies/` | Policy CRUD + approval workflow |
| **Evidence** | `src/modules/evidence/` | Evidence CRUD + validation |
| **Tasks** | `src/modules/tasks/` | Task management |
| **Integrations** | `src/modules/integrations/` | AWS, GitHub, Okta, Datadog connectors |
| **Eval Harness** | `src/llm-gateway/eval/` | Golden dataset CI runner |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Start with hot reload (port 3001) |
| `npm run start:prod` | Start compiled output |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run Jest test suites |
| `npm run test:ci` | Tests with coverage, forceExit |
| `npm run typecheck` | `tsc --noEmit` — zero-error gate |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run pending migrations |
| `npm run prisma:seed` | Seed frameworks, controls, demo org + users |
| `npm run prisma:studio` | Open Prisma Studio on port 5555 |

## Environment Variables

Create `.env` in `/backend`. Copy from `.env.example`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string with `?schema=public` |
| `REDIS_URL` | ✅ | Redis connection string (default: `redis://localhost:6379`) |
| `JWT_SECRET` | ✅ | Secret for signing access tokens (min 32 chars) |
| `JWT_REFRESH_SECRET` | ✅ | Secret for refresh tokens (different from JWT_SECRET) |
| `JWT_EXPIRY` | Optional | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRY` | Optional | Refresh token TTL (default: `7d`) |
| `ANTHROPIC_API_KEY` | ✅ | Anthropic API key for Claude models |
| `ANTHROPIC_MODEL` | Optional | Default model (default: `claude-haiku-3-5`) |
| `OPENAI_API_KEY` | Optional | OpenAI key for embeddings (falls back to in-memory) |
| `NODE_ENV` | Optional | `development` / `production` / `test` |
| `PORT` | Optional | HTTP port (default: `3001`) |

## API Base

`http://localhost:3001/api/v1`

**Swagger UI**: `http://localhost:3001/api/v1/docs`

## Key Endpoints

```
POST   /auth/login                     Login → { accessToken, refreshToken }
POST   /auth/refresh                   Refresh access token
GET    /readiness                      Current readiness scores
POST   /readiness/recalculate          Trigger fresh calculation
GET    /controls/library               Full control library
GET    /controls/applicability         Org's applicability matrix
GET    /llm/calls                      LLM call audit log
GET    /llm/calls/:id/replay           Replay an LLM call
GET    /llm/prompts                    List prompt templates
POST   /workflows                      Trigger compliance workflow
GET    /audit-exports                  List generated exports
POST   /audit-exports/soc2-readiness   Generate SOC 2 readiness report
```

## Testing

```bash
# All tests (167 cases, 9 suites)
npm test -- --forceExit

# Single suite
npm test -- llm-gateway-hardening --forceExit

# With coverage
npm run test:ci
```

Test suites:
- `llm-gateway-hardening.spec.ts` — 21 hardening tests (H01–H21)
- `rag/rag.spec.ts` — 12 RAG tests (R01–R12)
- `common/tenant-isolation.spec.ts` — 10 tenant isolation tests (TI01–TI10)
- `output-validator.spec.ts` — Output validation tests
- And 5 more across agents and services
