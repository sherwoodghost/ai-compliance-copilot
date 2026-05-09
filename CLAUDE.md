# Compliance Copilot — Agent Context

This file is loaded automatically by every `claude -p` (headless) session. Read it fully before acting.

---

## Architecture

| Layer | Tech | Port |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript) | 3000 |
| Backend | NestJS + Prisma ORM | 3001 |
| Database | PostgreSQL 16 + pgvector | 5432 |
| Cache / Queue | Redis 7 + BullMQ | 6379 |
| AI | OpenRouter → Anthropic Claude (via LlmGatewayService) | — |

**Root:** `C:\Users\asadm\OneDrive\Desktop\ai-compliance-copilot`

---

## Agent Contract (MUST follow)

1. **All backend agents extend `BaseAgent`** (`backend/src/agents/base/base.agent.ts`). Never create standalone AI callers.
2. **All LLM calls go through `LlmGatewayService`** (`backend/src/llm-gateway/llm-gateway.service.ts`). Never `new Anthropic()` or `new OpenAI()` directly.
3. **Prompts live in the registry** (`backend/src/llm-gateway/prompt-registry.ts`). Never inline system prompts as string constants in service files.
4. **Queues are named in `QUEUE_NAMES`** (`backend/src/orchestrator/queue.config.ts`). Never hardcode queue name strings.
5. **Every agent run emits an `AgentRun` DB row** via `BaseAgent.execute()`. This is the audit trail. Never bypass it.

---

## Framework Registry State

| Framework | Enum Value | Control Seed | Dashboard Page | Reference Page |
|---|---|---|---|---|
| SOC 2 | `SOC2` | ✅ `soc2-controls.seed.ts` | ✅ `/controls` (universal) | ✅ `/frameworks/soc2` |
| ISO 27001 | `ISO27001` | ✅ `iso27001-controls.seed.ts` | ✅ `/controls` (universal) | ✅ `/frameworks/iso27001` |
| GDPR | `GDPR` | ✅ `gdpr-controls.seed.ts` | ✅ `/gdpr` + `/gdpr/*` | ✅ `/frameworks/gdpr` |
| ISO 9001 | `ISO9001` | ✅ `iso9001-controls.seed.ts` | ✅ `/iso9001` + `/iso9001/*` | ✅ `/frameworks/iso9001` |
| HIPAA | `HIPAA` | ✅ `hipaa-controls.seed.ts` | ✅ `/hipaa` + `/hipaa/*` | ✅ `/frameworks/hipaa` |
| PCI-DSS | `PCI_DSS` | ✅ `pci-dss-controls.seed.ts` | ✅ `/pci-dss` + `/pci-dss/*` | ✅ `/frameworks/pci-dss` |
| FedRAMP | `FEDRAMP` | ✅ `fedramp-controls.seed.ts` | ✅ `/fedramp` + `/fedramp/*` | ✅ `/frameworks/fedramp` |
| NIST CSF | `NIST_CSF` | ✅ `nist-csf-controls.seed.ts` | ✅ `/nist-csf` + `/nist-csf/*` | ✅ `/frameworks/nist-csf` |
| ISO 14001 | `ISO14001` | ✅ `iso14001-controls.seed.ts` | ✅ `/iso14001` + `/iso14001/*` | ✅ `/frameworks/iso14001` |
| ISO 45001 | `ISO45001` | ✅ `iso45001-controls.seed.ts` | ✅ `/iso45001` + `/iso45001/*` | ✅ `/frameworks/iso45001` |

Framework seed file pattern: `backend/src/control-library/seeds/<framework>-controls.seed.ts`  
Framework seed.ts import: `backend/prisma/seed.ts` (add upsert block following existing SOC2 pattern)  
Dashboard plugin: `frontend/src/lib/dashboard/framework-registry.ts`  
Public reference pages: `frontend/src/app/(public)/frameworks/<slug>/page.tsx`  
Dashboard placeholder: `frontend/src/app/(dashboard)/<slug>/page.tsx`

---

## The 4 CI Compliance Gates (never break)

These run in `.github/workflows/ci.yml` and will block your PR:

```bash
# Gate 1 — No inline system prompts
grep -r "SYSTEM_PROMPT\s*=" backend/src --include="*.ts" | grep -v "test\|spec\|seed" && exit 1

# Gate 2 — No raw LLM clients
grep -r "new Anthropic(" backend/src --include="*.ts" | grep -v "test\|spec" && exit 1

# Gate 3 — No direct agent-to-agent calls
grep -r "agentService\.run\|agentService\.execute" backend/src --include="*.ts" | grep -v "test\|spec" && exit 1

# Gate 4 — No forbidden certification language
grep -r "SOC 2 certified\|ISO 27001 certified\|fully compliant" backend/src frontend/src --include="*.ts" --include="*.tsx" && exit 1
```

---

## PR / Branch Rules

- **Always** create a feature branch: `git checkout -b feat/<description>`
- Target branch is **`develop`**, never `main`
- Open PR with `gh pr create --base develop`
- Never `git push origin main` — branch protection will reject it anyway
- Never `npx prisma migrate deploy` (production migration — requires human review)
- Schema changes (`schema.prisma` edits) require a separate PR that a human reviews before the seed follows

---

## Tenant Isolation Rule

Every Prisma query that touches org-scoped data MUST include `where: { orgId }` or `where: { id, orgId }`.  
A query that fetches by `id` alone is a **tenant isolation violation** — hard block, do not commit.

---

## Shared State Files (agent memory)

| File | Purpose |
|---|---|
| `scripts/gap-reports/latest.json` | Output of gap-detector.js — what's missing |
| `scripts/sprint-plans/latest.json` | Output of /plan-sprint — what to build next |
| `scripts/test-reports/` | Output of /test-platform — E2E results + screenshots |

---

## How to Run Locally

```bash
# Start infrastructure
docker compose up -d postgres redis

# Backend
cd backend && npm run start:dev   # http://localhost:3001

# Frontend
cd frontend && npm run dev        # http://localhost:3000

# Run seed
cd backend && npx prisma db seed

# TypeScript checks
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

---

## Completed Phases (P1–P27)

P1–P9: Schema, ABAC permissions, onboarding, policies, guided tasks, access reviews, training, management reviews, 80+ hardening tests  
P10–P18: Incidents, notifications, internal audit, offboarding, auditor portal, control effectiveness, drift detection, risk scoring, vendor risk  
P19–P21: TipTap document editor, bulk document ingestion, ISO 9001 NCR/CAPA quality modules  
P22–P24: Readiness scoring v2, executive dashboard, audit export packages  
P25: Framework reference pages, control hyperlinks, file attachment in onboarding chat  
P26: GDPR + ISO 9001 frameworks, framework dashboards, widget registry  
P27: Framework plugin architecture, dynamic sidebar, `useActiveFrameworks` hook, overview page auto-composition  
P28: Autonomous Agent Loop — HIPAA + PCI-DSS + FedRAMP + NIST CSF + ISO 14001 + ISO 45001 built, Playwright config, GitHub Actions nightly workflow, gap detector (all 10 frameworks complete, zero gaps)
P29: GDPR + ISO 9001 main overview dashboard pages, E2E specs for GDPR + ISO 9001, seed.ts FrameworkType cast cleanup, framework registry sidebar nav links updated
P30: E2E specs for ISO 14001 + ISO 45001 (all 10 frameworks now have full E2E coverage), Settings → Frameworks tab built, Copilot guidance corrected to match actual UI
P31: Multi-framework crosswalk expansion — added 80+ new GDPR↔ISO27001, GDPR↔SOC2, HIPAA↔ISO27001 mappings to CrosswalkService; crosswalks page upgraded to 4-tab UI; `FrameworkSlug` type exported from frameworks.ts; CrosswalkTable made generic
P32: All-framework polish — `generateStaticParams` in control detail page extended to all 10 frameworks; framework validation guard updated; `frameworkLabel`/`frameworkColor` handlers added for all 10; `ControlChip` color + framework badge + deep-link updated for all 10 frameworks; `ControlLinkifiedText` regex extended to cover HIPAA, PCI-DSS, FedRAMP, NIST CSF, ISO 14001, ISO 45001; `MarkdownWithControls` detection regex extended to all 10; CrosswalkTable `categoryColor` and `frameworkLink` extended to all 10; shared `colors.ts` `getCategoryColor` expanded to handle all 10 frameworks' category names (HIPAA safeguards, PCI requirements, FedRAMP families, NIST CSF functions, ISO 14001/45001 clauses); E2E specs added for SOC 2, ISO 27001, and crosswalks page (18 total E2E specs); CI gate false-positive comment fixed in onboarding.service.ts; both TypeScript workspaces pass clean
P33: Multi-framework crosswalk expansion — added HIPAA↔SOC2 (27 mappings), PCI-DSS↔ISO27001 (39 mappings), FedRAMP↔NIST CSF (49 mappings) to CrosswalkService (total ~253 seeded mappings across 7 pairs); crosswalks page upgraded to 7-pair tab UI; CrosswalksTabs extracted as client component; `FrameworkSlug` type covers all 10 slugs; E2E crosswalk spec updated to verify all 7 pairs
P34: Critical API fix + polish — `getByFramework()` guard extended from 2 to all 10 framework slugs (was silently returning `[]` for HIPAA/PCI/FedRAMP/NIST/GDPR/ISO9001/ISO14001/ISO45001); service signature broadened to `string`; `applicability-reviewer.service.ts` system prompt now uses actual framework names from batch instead of hardcoded "ISO 27001 and SOC 2"; `useActiveFrameworks` dead `'nist'`/`'ccpa'` aliases removed and redirected to canonical IDs; frameworks index page cross-mappings count updated from 150+ to 250+; both TypeScript workspaces pass clean
