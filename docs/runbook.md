# Operations Runbook

This runbook covers operational procedures for running the AI Compliance Copilot in production.

---

## Service Overview

| Service | Port | Health check |
|---------|------|-------------|
| NestJS backend | 3001 | `GET /api/v1/health` |
| Next.js frontend | 3000 | `GET /` |
| PostgreSQL | 5432 | `pg_isready` |
| Redis | 6379 | `redis-cli ping` |

---

## 1. Startup Sequence

Start services in this order:

```bash
# 1. Start infrastructure
docker compose up postgres redis -d

# 2. Wait for healthy (typically 10–15s)
docker compose ps

# 3. Run migrations (idempotent)
cd backend && npx prisma migrate deploy

# 4. Seed control library (idempotent — upserts)
npm run prisma:seed

# 5. Enable pgvector extension (run once per fresh DB)
docker exec -it $(docker compose ps -q postgres) \
  psql -U compliance -d compliance_db \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

# 6. Start backend
npm run start:prod   # or start:dev for watch mode

# 7. Start frontend
cd ../frontend && npm run build && npm run start
```

---

## 2. Health Checks

### Backend health
```bash
curl http://localhost:3001/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Redis connectivity
```bash
redis-cli -h localhost -p 6379 ping
# Expected: PONG
```

### PostgreSQL connectivity
```bash
docker exec -it $(docker compose ps -q postgres) pg_isready -U compliance
# Expected: localhost:5432 - accepting connections
```

### pgvector extension
```bash
docker exec -it $(docker compose ps -q postgres) \
  psql -U compliance -d compliance_db \
  -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
# Expected: 1 row returned with extname=vector
```

### BullMQ queue depths
```bash
# Install bull-repl if not present: npm install -g bull-repl
bull-repl> connect localhost 6379
bull-repl> use agent.scoping
bull-repl> counts
```

---

## 3. Triggering a Full Assessment

### Step 1 — Authenticate
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"Demo1234!"}' \
  | jq -r '.accessToken')
```

### Step 2 — Get framework IDs
```bash
curl -s http://localhost:3001/api/v1/controls/library \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.frameworks[] | {id, name}'
```

### Step 3 — Trigger assessment
```bash
curl -X POST http://localhost:3001/api/v1/orchestrator/assess \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"frameworkIds":["<SOC2_FRAMEWORK_ID>"]}'
# Expected: {"workflowId":"...","status":"started"}
```

### Step 4 — Monitor progress (WebSocket)
Connect to `ws://localhost:3001` with the JWT token. Listen for `workflow:progress` events:
```json
{"event":"workflow:progress","data":{"workflowId":"...","currentAgent":"planner","progress":35}}
```

### Step 5 — Check workflow status
```bash
curl http://localhost:3001/api/v1/orchestrator/workflows/<workflowId> \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Human Checkpoint Handling

When an agent requires human review, the pipeline pauses and a `HumanCheckpoint` record is created.

### List pending checkpoints
```bash
curl http://localhost:3001/api/v1/orchestrator/checkpoints \
  -H "Authorization: Bearer $TOKEN"
```

### Approve a checkpoint (admin/security_lead role required)
```bash
curl -X POST \
  http://localhost:3001/api/v1/orchestrator/checkpoints/<checkpointId>/approve \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"approved","notes":"Scope looks correct"}'
```

### Reject a checkpoint
```bash
curl -X POST \
  http://localhost:3001/api/v1/orchestrator/checkpoints/<checkpointId>/reject \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"decision":"rejected","notes":"Missing cloud boundary definition"}'
```

---

## 5. Monitoring Key Metrics

### LLM call volume and cost
```sql
SELECT 
  DATE(created_at) as day,
  COUNT(*) as calls,
  SUM(input_tokens + output_tokens) as total_tokens,
  SUM(cost_usd)::numeric(10,4) as total_cost_usd,
  AVG(latency_ms)::int as avg_latency_ms
FROM llm_calls
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY day ORDER BY day DESC;
```

### Forbidden language detections
```sql
SELECT COUNT(*) as detections, MAX(created_at) as last_seen
FROM llm_calls
WHERE forbidden_language_detected = true
  AND created_at > NOW() - INTERVAL '24 hours';
```

### Failed agent runs
```sql
SELECT agent_name, COUNT(*) as failures, MAX(created_at) as last_failure
FROM agent_runs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY agent_name ORDER BY failures DESC;
```

### Queue backlog (via Redis)
```bash
redis-cli llen bull:agent.scoping:wait
redis-cli llen bull:agent.planner:wait
redis-cli llen bull:agent.audit:wait
```

---

## 6. Common Incident Procedures

### Agent stuck in queue
**Symptom**: Job has been in `wait` state for >5 minutes

**Steps**:
1. Check Redis: `redis-cli lrange bull:agent.<name>:wait 0 -1`
2. Check worker logs: `docker logs backend --tail 100`
3. If worker crashed: restart backend service
4. If job is malformed: move to failed queue manually via Bull admin UI

---

### LLM rate limit errors
**Symptom**: `Error: 429 Too Many Requests` in logs

**Steps**:
1. Check `llm_calls` table for burst pattern
2. Increase `THROTTLE_TTL`/`THROTTLE_LIMIT` if frontend is the source
3. Add `ANTHROPIC_API_KEY` rate limit headers to alert
4. Temporary: reduce pipeline concurrency (set BullMQ `concurrency: 1` per queue)

---

### pgvector out of sync
**Symptom**: RAG returning stale results; `RagService: in-memory fallback active`

**Steps**:
1. Verify extension: `SELECT extname FROM pg_extension WHERE extname='vector';`
2. Re-enable: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Re-index control library: `POST /api/v1/rag/reindex` (admin only)
4. Check `vector_embeddings` row count: `SELECT COUNT(*) FROM vector_embeddings;`

---

### Database connection pool exhausted
**Symptom**: `Error: P2024 — Timed out fetching a connection from the connection pool`

**Steps**:
1. Add `?connection_limit=20` to `DATABASE_URL`
2. Restart backend to reset pool
3. Check for long-running queries: `SELECT * FROM pg_stat_activity WHERE state != 'idle';`
4. Kill blocking queries if needed: `SELECT pg_terminate_backend(<pid>);`

---

### Worker memory leak
**Symptom**: Backend memory growing unbounded, eventually OOM

**Steps**:
1. Check agent run table for stuck `in_progress` runs older than 1 hour
2. Restart backend (workers re-register automatically)
3. Monitor with: `docker stats backend`

---

## 7. Database Backup

### Manual backup
```bash
docker exec $(docker compose ps -q postgres) \
  pg_dump -U compliance compliance_db \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Restore
```bash
gunzip -c backup_<timestamp>.sql.gz \
  | docker exec -i $(docker compose ps -q postgres) \
  psql -U compliance compliance_db
```

---

## 8. Log Locations

| Context | Log source |
|---------|-----------|
| Backend app logs | `docker logs backend` or stdout |
| NestJS structured logs | JSON format when `LOG_LEVEL=info` |
| BullMQ job logs | Stored in Redis — check Bull admin UI |
| LLM call audit | `llm_calls` table |
| Agent step logs | `agent_steps` table |
| Retrieval logs | `llm_retrieval_sources` table |

### Filtering logs for an org
```bash
docker logs backend 2>&1 | grep '"orgId":"<ORG_ID>"'
```

### Filtering logs for a workflow
```bash
docker logs backend 2>&1 | grep '"workflowId":"<WORKFLOW_ID>"'
```

---

## 9. Replay a Failed Assessment

Every LLM call stores its rendered prompt + hash. To replay:

```bash
# Get the llm_call record
curl http://localhost:3001/api/v1/llm/calls/<callId> \
  -H "Authorization: Bearer $TOKEN"

# Replay with same inputs
curl http://localhost:3001/api/v1/llm/calls/<callId>/replay \
  -H "Authorization: Bearer $TOKEN"
```

For full workflow replay (re-runs entire pipeline from step 0 with `isReplay: true`):
```bash
curl -X POST http://localhost:3001/api/v1/orchestrator/workflows/<workflowId>/replay \
  -H "Authorization: Bearer $TOKEN"
```

---

## 10. Environment Variables Reference

See `backend/.env.example` for the full list. Critical production variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | ✅ | BullMQ Redis connection |
| `JWT_ACCESS_SECRET` | ✅ | Min 32 chars, generate with `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | ✅ | Min 32 chars, different from access secret |
| `ANTHROPIC_API_KEY` | ✅ (prod) | Skip with `ENABLE_MOCK_LLM=true` |
| `VOYAGE_API_KEY` | ✅ (prod) | Skip with `ENABLE_MOCK_EMBEDDINGS=true` |
| `ENABLE_MOCK_LLM` | — | `true` for CI/dev without API keys |
| `ENABLE_MOCK_EMBEDDINGS` | — | `true` for CI/dev without Voyage key |
| `ENABLE_RAG_IN_MEMORY_FALLBACK` | — | `true` if pgvector unavailable |
| `LOG_LEVEL` | — | `info` (prod), `debug` (dev) |

---

## 11. CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main` and `develop`:

1. **Backend job**: typecheck → unit tests → 4 compliance gates
2. **Frontend job**: typecheck → build
3. **Control library quality gate**: validates seed structure (runs after backend)

Compliance gates enforced in CI:
- No inline `SYSTEM_PROMPT` constants in `src/agents/`
- No raw LLM calls (`new Anthropic`, `this.llm.complete`, `anthropic.messages`) in `src/agents/`
- No direct `.execute(` calls between agents
- No forbidden certification language in `src/prompts/`
