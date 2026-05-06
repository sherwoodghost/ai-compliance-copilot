# Frontend — AI Compliance Copilot

Next.js 14 (App Router) dashboard for the compliance platform. Runs on port 3000.

## Tech Stack

| Library | Version | Purpose |
|---------|---------|---------|
| **Next.js** | 14 | App Router, server components, API routes |
| **React** | 18 | UI rendering |
| **TanStack Query** | v5 | Server state, caching, background refetch |
| **Zustand** | v4 | Client state (auth tokens, user session) |
| **Tailwind CSS** | v3 | Utility-first styling |
| **Recharts** | v2 | Dashboard charts and score visualizations |
| **Socket.io Client** | v4 | Real-time workflow progress updates |
| **Axios** | v1 | HTTP client |

## Environment Variables

Create `.env.local` in `/frontend`:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend base URL (default: `http://localhost:3001/api/v1`) |
| `NEXT_PUBLIC_WS_URL` | Optional | WebSocket URL (default: `http://localhost:3001`) |

## Running

```bash
npm install
npm run dev      # Development (port 3000, hot reload)
npm run build    # Production build
npm run start    # Serve production build
npm run lint     # ESLint check
```

## Page Inventory

### Auth Group `/(auth)`

| Route | Purpose |
|-------|---------|
| `/login` | Email/password login form with JWT token storage |
| `/register` | New organization sign-up |

### Onboarding Group `/(onboarding)`

| Route | Purpose |
|-------|---------|
| `/onboarding` | Conversational onboarding — AI-driven business profile collection |

### Dashboard Group `/(dashboard)`

| Route | Purpose |
|-------|---------|
| `/overview` | Executive summary — overall readiness score, recent activity, quick actions |
| `/readiness` | Detailed readiness score breakdown — per-category charts, score history, improvement recommendations |
| `/controls` | Organization control status table — filter by status, assign owners, track progress |
| `/control-library` | Full SOC 2 + ISO 27001 control library with crosswalk mappings |
| `/control-panel` | Admin panel — compliance journey stages, queue status, agent run history |
| `/policies` | Policy library — view, edit, and approve generated policies |
| `/evidence` | Evidence dashboard — validity status, expiry warnings, upload new items |
| `/risks` | Risk register — severity matrix, treatment tracking, risk acceptance workflow |
| `/tasks` | Task management — priority queue, assignee filtering, due date tracking |
| `/scope` | SOC 2 scope definition + ISO ISMS scope — systems in/out, approval workflow |
| `/integrations` | Integration connectors — AWS, GitHub, Okta, Datadog, Slack, Jira |
| `/vendors` | Vendor risk assessments — vendor tiers, SOC 2 report tracking |
| `/audit-exports` | Generate and download audit packages — SOC 2 readiness report, ISO SoA, evidence binder |
| `/llm-gateway` | LLM admin view — call audit log, prompt templates, eval results, cost tracking |
| `/journey` | Compliance journey progress — 18-stage pipeline visualization with real-time updates |
| `/profile-history` | Business profile version history — see what changed and when |
| `/settings` | Organization settings — users, roles, billing, API keys |

## Project Structure

```
src/
├── app/                    Next.js App Router
│   ├── (auth)/             Login / Register
│   ├── (onboarding)/       Onboarding flow
│   └── (dashboard)/        All authenticated pages
├── components/
│   ├── ui/                 Shared UI primitives (buttons, cards, badges)
│   ├── charts/             Recharts wrappers (readiness gauges, trend lines)
│   ├── layout/             Sidebar, topbar, nav
│   └── [feature]/          Feature-specific components
├── lib/
│   ├── api.ts              Axios instance with JWT interceptors + auto-refresh
│   ├── store.ts            Zustand auth store
│   └── utils.ts            Shared helpers
└── types/                  Shared TypeScript interfaces
```

## Authentication Flow

1. Login → `POST /auth/login` → stores `accessToken` + `refreshToken` in Zustand + localStorage
2. All API requests include `Authorization: Bearer <accessToken>` via Axios interceptor
3. On 401 → automatically calls `POST /auth/refresh` → retries the original request
4. Logout clears all tokens and redirects to `/login`
