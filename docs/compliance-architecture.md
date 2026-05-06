# AI Compliance Copilot — Architecture Overview

## Table of Contents

1. [System Overview](#system-overview)
2. [Module Map](#module-map)
3. [Database Schema Summary](#database-schema-summary)
4. [Data Flow](#data-flow)
5. [Security Architecture](#security-architecture)
6. [Pipeline Diagram](#pipeline-diagram)
7. [Compliance Framework Support](#compliance-framework-support)

---

## System Overview

AI Compliance Copilot is a multi-tenant SaaS platform that guides organizations through SOC 2 and ISO 27001 compliance readiness. It uses an agentic pipeline architecture where specialized AI agents collaborate to scope controls, map gaps, generate policies, assign tasks, score readiness, and produce audit-ready exports — all without requiring the user to understand the underlying frameworks.

### Runtime Components

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| Backend API | NestJS (Node.js) | 3001 | REST + WebSocket server, orchestration engine, all agent execution |
| Frontend | Next.js 14 (App Router) | 3000 | User-facing dashboard, onboarding flow, checkpoint review UI |
| Database | PostgreSQL + pgvector | 5432 | Primary data store; pgvector extension stores dense embeddings for RAG |
| Queue Backend | Redis + BullMQ | 6379 | Job queue for the 18-stage assessment pipeline |

### Agent Count

- **18 pipeline agents** — executed in sequence by the WorkflowEngine
- **1 onboarding agent** — runs outside the pipeline during the initial data-gathering conversation

Total: **19 agent implementations**, each backed by a versioned prompt template registered in the PromptRegistry.

---

## Module Map

All modules live under `backend/src/`. Each module is a NestJS module with its own controller, service, and (where applicable) queue processor.

### `llm-gateway/`

**Compliance-Aware LLM Gateway**

The single choke point for every LLM call in the system. No agent or service is permitted to call an LLM provider directly. The gateway enforces:

- Prompt template validation (every call must reference a registered prompt)
- ComplianceSafePromptWrapper prepended to every system prompt
- Model routing via `AGENT_MODEL_ROUTING`
- Output validation (schema, control IDs, forbidden language)
- Retry logic (up to 3 retries on forbidden-language violations)
- Full audit logging to `llm_calls` and `llm_retrieval_sources`

See [LLM Gateway documentation](./llm-gateway.md) for the complete reference.

### `control-library/`

**Source of Truth for SOC 2 and ISO 27001 Controls**

Seeded from authoritative control definitions at startup. Exposes a query API used by the ControlMapperAgent and ReadinessScoringService. The library is immutable at runtime — no agent can create or modify control definitions. It includes:

- Control domains (`control_domains` table)
- Individual controls with framework references (`controls` table)
- Evidence requirements per control (`control_evidence_requirements` table)
- Cross-framework mappings (`framework_crosswalks` table), e.g., SOC 2 CC6.1 ↔ ISO A.8.3

### `scoping/`

**SOC 2 Scope and ISO ISMS Scope Generation**

Provides services consumed by `ScopingAgent`. Persists scope decisions to `soc2_scopes` and `iso27001_scopes`. Scoping determines which Trust Service Criteria categories (Availability, Confidentiality, etc.) and ISO Annex A domains apply to the organization based on its business profile.

### `readiness/`

**Deterministic Readiness Scoring (No LLM)**

Computes a numeric readiness score for each compliance framework based on evidence collected, controls mapped, and gaps identified. Scoring is deterministic math — no LLM inference — so scores are reproducible and auditable. Results are stored in `readiness_scores` and surfaced on the executive dashboard.

### `audit-exports/`

**SOC 2 Readiness Report, ISO SoA, Evidence Binder**

Generates the three primary audit artifacts:

1. **SOC 2 Readiness Report** — narrative + control-by-control status table
2. **ISO Statement of Applicability (SoA)** — Annex A applicability decisions with justifications
3. **Evidence Binder** — all collected evidence organized by control

Exports are stored in the `audit_exports` table and downloadable as PDF or XLSX.

### `prompts/`

**Versioned Prompt Templates (19 Templates Across 18 Pipeline Agents + 1 Onboarding Agent)**

Every LLM prompt in the system is a versioned template registered here. Templates use `{{variable}}` placeholder syntax. The PromptRegistryService loads all templates at startup, computes a `contentHash` for each, and verifies the hash against the value stored in `prompt_templates`. This prevents silent prompt drift.

### `dashboard/`

**Dashboard Config Generation Per Role**

The DashboardAgent writes role-specific configuration objects to `dashboard_configs`. The frontend reads these configs to render the appropriate widgets, charts, and action items for each user role (admin, security_lead, executive, legal, contributor, auditor). Configs are regenerated after each pipeline run and after any human checkpoint decision.

### `orchestrator/`

**BullMQ WorkflowEngine and Processors**

Contains the `WorkflowEngine` service and the BullMQ queue processors for each agent. The WorkflowEngine is responsible for:

- Enqueuing the first agent job when an assessment is triggered
- Reading each agent's `WorkflowStepDecision` and deciding whether to continue, pause for human review, or halt
- Maintaining the ordered sequence of the 18-stage pipeline
- Emitting progress events via the EventBus after each step

### `agents/`

**19 Agent Implementations**

Each agent is a NestJS service that implements the `IComplianceAgent` interface. Agents do not communicate with each other directly — they read from and write to the database, and the WorkflowEngine coordinates sequencing. The 18 pipeline agents in order are:

1. ScopingAgent
2. ControlMapperAgent
3. PlannerAgent
4. GapAnalysisAgent
5. PolicyAgent
6. EvidenceAgent
7. TaskAgent
8. RiskAgent
9. VendorRiskAgent
10. DriftDetectorAgent
11. ValidatorAgent
12. ReviewAgent
13. RemediationAgent
14. TrainingAgent
15. MonitoringAgent
16. ReportingAgent
17. AuditAgent
18. DashboardAgent

The 19th agent (`OnboardingAgent`) runs outside the pipeline during the initial user conversation.

### `compliance-journey/`

**Journey State Machine**

Manages the lifecycle of a `compliance_journey` record. States include: `not_started`, `scoping`, `in_progress`, `awaiting_human_review`, `remediation`, `audit_ready`, `complete`. Transitions are triggered by WorkflowEngine decisions and human checkpoint resolutions.

### `event-bus/`

**WebSocket Event Emission**

Wraps the NestJS WebSocket gateway. The WorkflowEngine calls `EventBusService.emit()` after every agent step, checkpoint creation, and score update. The frontend subscribes to the WebSocket connection established at login and renders real-time progress without polling.

### `common/`

**Shared Utilities, Guards, Decorators**

Contains cross-cutting concerns:

- `JwtAuthGuard` and `RolesGuard`
- `@Roles()` decorator for endpoint-level RBAC
- `TenantContextInterceptor` — extracts `orgId` from the JWT and attaches it to every request
- Custom exceptions (`PolicyViolationException`, `TenantIsolationException`)
- Shared DTOs and Zod schemas used by multiple modules

### `database/`

**PrismaService**

Wraps the Prisma ORM client. Provides the `PrismaService` injectable used by all repositories. Manages connection pooling and graceful shutdown hooks.

---

## Database Schema Summary

All tables include `created_at` and `updated_at` timestamps. Multi-tenant tables include `org_id` with a foreign key to `organizations` and an index to ensure fast per-tenant queries.

| Table | Description |
|-------|-------------|
| `organizations` | Top-level tenant record. Each org has one active compliance journey at a time. |
| `users` | Org members with roles. Roles: `admin`, `security_lead`, `executive`, `legal`, `contributor`, `auditor`. |
| `business_profiles` | Structured output of the onboarding conversation: industry, size, tech stack, data types, existing tooling, regulatory requirements. |
| `compliance_journeys` | One per org per assessment cycle. Holds state machine status and references to all downstream records. |
| `agent_runs` | One row per agent execution. Records start/end time, status, and the `WorkflowStepDecision` output. |
| `agent_steps` | Sub-step audit log within a single agent run (e.g., individual RAG retrievals, validation steps). |
| `human_checkpoints` | Created when an agent returns `wait_for_human`. Holds the question posed, response options, and the reviewer's decision. |
| `controls` | Authoritative control definitions. Immutable at runtime. References `control_domains`. |
| `control_domains` | Groupings of controls (e.g., CC1 — Control Environment, A.5 — Organizational Controls). |
| `control_evidence_requirements` | Describes what evidence is required to satisfy each control. |
| `framework_crosswalks` | Maps equivalent controls across frameworks (SOC 2 ↔ ISO 27001). |
| `soc2_scopes` | Scoping decisions for SOC 2: which Trust Service Criteria categories apply and why. |
| `iso27001_scopes` | Scoping decisions for ISO 27001: which Annex A domains are in scope and ISMS boundary definition. |
| `iso_statement_of_applicability` | Per-control applicability decisions for the ISO SoA export. |
| `prompt_templates` | Versioned prompt templates. `content_hash` verified at startup by PromptRegistryService. |
| `llm_calls` | Audit log of every LLM call: prompt hash, model, token counts, cost, latency, validation flags, retry count. |
| `llm_retrieval_sources` | RAG chunk log. Records which vector embedding chunks were retrieved and injected for a given `llm_call_id`. |
| `vector_embeddings` | Dense vector representations of control library content, policy snippets, and evidence summaries. Used for RAG. Stored with `org_id` for tenant isolation. |
| `readiness_scores` | Deterministic readiness scores per framework per journey. Updated after every pipeline completion. |
| `dashboard_configs` | Role-specific JSON config objects written by DashboardAgent. Read by the frontend at page load. |
| `audit_exports` | Metadata and storage references for generated audit artifacts (Readiness Report, SoA, Evidence Binder). |
| `risk_items` | Identified risks with likelihood, impact, and inherent risk score. |
| `risk_treatments` | Treatment decisions for each risk item: accept, mitigate, transfer, or avoid. |
| `policies` | Generated or uploaded policy documents linked to controls. |
| `evidence` | Evidence artifacts (documents, screenshots, config exports) linked to controls and evidence requirements. |
| `tasks` | Remediation and implementation tasks assigned to users, generated by TaskAgent. |

---

## Data Flow

The following describes the end-to-end flow from user onboarding through a completed assessment.

### Step 1 — Onboarding

The user completes a guided onboarding conversation with the `OnboardingAgent`. The agent asks structured questions about the organization's business, technology stack, data handling practices, and regulatory environment. Responses are validated and stored as a `business_profile` record. This step runs outside the pipeline queue.

### Step 2 — Assessment Trigger

An admin user clicks "Start Assessment" in the dashboard. The backend creates a `compliance_journey` record in state `scoping` and calls `WorkflowEngine.startPipeline()`, which enqueues the first job (`ScopingAgent`) into the BullMQ queue.

### Step 3 — Agent Execution Loop

Each agent follows the same internal lifecycle:

1. BullMQ worker picks up the job
2. Agent validates its input (reads required records from DB, asserts preconditions)
3. Agent calls `context.llmGateway.call()` with a registered prompt template and its variables
4. LLM response is validated and parsed
5. Agent writes its outputs to the database (e.g., scope records, controls, gaps, policies, tasks)
6. Agent returns a `WorkflowStepDecision`:
   - `{ action: 'continue' }` — processing was successful, proceed to next agent
   - `{ action: 'wait_for_human', checkpoint: { ... } }` — human input required, pause pipeline
   - `{ action: 'halt', reason: '...' }` — unrecoverable error, stop pipeline

### Step 4 — Human Checkpoint (when applicable)

When an agent returns `wait_for_human`, the WorkflowEngine:

1. Creates a `human_checkpoint` record with the question and options
2. Transitions the journey to `awaiting_human_review`
3. Emits a WebSocket event so the reviewer sees a notification immediately

When the reviewer submits their decision via the frontend, the checkpoint is marked resolved, the journey transitions back to `in_progress`, and the WorkflowEngine re-enqueues the agent that created the checkpoint (or the next agent, depending on checkpoint type).

### Step 5 — Pipeline Continuation

When an agent returns `continue`, the WorkflowEngine looks up the next agent in the ordered pipeline sequence and enqueues its job. The `agent_runs` record for the completed agent is marked `success`.

### Step 6 — Readiness Scoring

After the final pipeline agent completes, `ReadinessScoringService.computeScores()` is called. It reads all controls, mapped evidence, and gap records for the journey and produces a numeric readiness percentage per framework. Results are written to `readiness_scores`. No LLM is involved in this step.

### Step 7 — Dashboard Generation

The DashboardAgent (the last pipeline agent) reads the readiness scores and all journey data, then writes role-specific `dashboard_config` records for each role in the organization. The executive config shows high-level scores and risk summaries; the security lead config shows control-by-control status and open tasks; the auditor config shows evidence completeness.

### Step 8 — Real-Time Progress

Throughout the entire flow, the `EventBusService` emits WebSocket events after every agent step, checkpoint event, and score update. The Next.js frontend subscribes to these events on the authenticated WebSocket connection and updates the UI without requiring page refreshes or polling.

---

## Security Architecture

### Authentication

- **JWT access tokens** with a 15-minute expiry. Short-lived to minimize the impact of token theft.
- **Refresh tokens** with a 7-day expiry, stored as an `httpOnly` cookie to prevent JavaScript access.
- Token rotation: a new refresh token is issued on every refresh, and the previous token is invalidated.

### Tenant Isolation

- Every authenticated request passes through `TenantContextInterceptor`, which extracts the `orgId` claim from the JWT and attaches it to the request context.
- Every database query in every repository includes a `WHERE org_id = $orgId` condition. There is no shared query path that could return cross-tenant data.
- Vector embedding queries (RAG) include an `org_id` filter before the similarity search, preventing one tenant's content from being retrieved in another tenant's context.
- A `TenantIsolationException` is thrown and logged if a query is constructed without an `orgId` in any context where one is expected.

### Role-Based Access Control

Six roles are supported, each with a distinct permission surface:

| Role | Description |
|------|-------------|
| `admin` | Full access. Can trigger assessments, manage users, and approve all checkpoint types. |
| `security_lead` | Can review and approve technical checkpoints. Can upload evidence and manage tasks. |
| `executive` | Read-only access to executive dashboard. Can approve policy-level checkpoints. |
| `legal` | Can review and approve legal and privacy-related checkpoints and policies. |
| `contributor` | Can upload evidence and complete assigned tasks. No access to scores or exports. |
| `auditor` | Read-only access to controls, evidence, and audit exports. Cannot modify any data. |

The `@Roles()` decorator and `RolesGuard` enforce role requirements at the controller endpoint level.

### Rate Limiting

`@nestjs/throttler` is applied globally with per-route overrides for expensive endpoints (e.g., assessment trigger, export generation). Default limits are 100 requests per minute per IP.

### Output Sanitization

The `OutputValidatorService` in the LLM Gateway checks every LLM response for forbidden language before it is persisted or returned. If forbidden language is detected, the response is not used, a correction hint is appended to the prompt, and the call is retried (up to 3 times). If all retries fail, the agent step is marked failed and a human checkpoint is created.

### HTTP Security Headers

`helmet` middleware is applied to all HTTP responses, setting:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`

---

## Pipeline Diagram

The 18-stage assessment pipeline executes agents in the following order. Each arrow represents a `WorkflowStepDecision { action: 'continue' }`. Human checkpoint pauses (represented by `[HCP]`) may occur at any stage that returns `wait_for_human`.

```
                        ASSESSMENT TRIGGER
                               |
                               v
                        [ ScopingAgent ]
                          Determines which SOC 2 TSC categories
                          and ISO Annex A domains apply
                               |
                          [HCP possible]
                               |
                               v
                     [ ControlMapperAgent ]
                       Maps business profile to
                       specific controls from library
                               |
                               v
                        [ PlannerAgent ]
                          Builds implementation
                          roadmap + milestones
                               |
                          [HCP possible]
                               |
                               v
                      [ GapAnalysisAgent ]
                        Identifies control gaps
                        vs. current state
                               |
                               v
                        [ PolicyAgent ]
                          Drafts required policies
                          for in-scope controls
                               |
                          [HCP possible]
                               |
                               v
                       [ EvidenceAgent ]
                         Identifies required evidence
                         per control requirement
                               |
                               v
                        [ TaskAgent ]
                          Creates remediation tasks
                          assigned to users by role
                               |
                               v
                        [ RiskAgent ]
                          Identifies and scores
                          compliance risks
                               |
                          [HCP possible]
                               |
                               v
                      [ VendorRiskAgent ]
                        Assesses third-party
                        vendor risk posture
                               |
                               v
                     [ DriftDetectorAgent ]
                       Checks for control drift
                       vs. previous assessment
                               |
                               v
                      [ ValidatorAgent ]
                        Validates completeness
                        of all prior outputs
                               |
                               v
                       [ ReviewAgent ]
                         Final review of all
                         agent outputs for accuracy
                               |
                          [HCP possible]
                               |
                               v
                     [ RemediationAgent ]
                       Prioritizes open gaps
                       and assigns remediation
                               |
                               v
                      [ TrainingAgent ]
                        Identifies training
                        requirements by role
                               |
                               v
                     [ MonitoringAgent ]
                       Sets up continuous
                       monitoring requirements
                               |
                               v
                      [ ReportingAgent ]
                        Generates internal
                        status report
                               |
                               v
                       [ AuditAgent ]
                         Prepares audit-ready
                         export artifacts
                               |
                          [HCP possible]
                               |
                               v
                     [ DashboardAgent ]
                       Generates role-specific
                       dashboard configs
                               |
                               v
                    ReadinessScoringService
                    (deterministic, no LLM)
                               |
                               v
                        ASSESSMENT COMPLETE
```

Legend:
- `[HCP possible]` — this stage may pause the pipeline and create a HumanCheckpoint requiring reviewer action before proceeding.

---

## Compliance Framework Support

### SOC 2 (2017 Trust Services Criteria)

The control library includes all Trust Services Criteria from the 2017 AICPA framework. Categories:

| Category Code | Category Name | Always In Scope |
|---------------|--------------|-----------------|
| CC1 | Control Environment | Yes |
| CC2 | Communication and Information | Yes |
| CC3 | Risk Assessment | Yes |
| CC4 | Monitoring of Controls | Yes |
| CC5 | Control Activities | Yes |
| CC6 | Logical and Physical Access Controls | Yes |
| CC7 | System Operations | Yes |
| CC8 | Change Management | Yes |
| CC9 | Risk Mitigation | Yes |
| A1 | Availability | Conditional |
| C1 | Confidentiality | Conditional |
| PI1 | Processing Integrity | Conditional |
| P1–P8 | Privacy | Conditional |

The ScopingAgent determines which conditional categories apply based on the organization's business profile (e.g., P1–P8 are included when the org handles personal data).

### ISO 27001 (2022 Edition)

The control library covers all Annex A control domains from the ISO/IEC 27001:2022 standard:

| Domain | Name |
|--------|------|
| A.5 | Organizational Controls (37 controls) |
| A.6 | People Controls (8 controls) |
| A.7 | Physical Controls (14 controls) |
| A.8 | Technological Controls (34 controls) |

The ISO ISMS scope (clause 4.3) is generated by the ScopingAgent based on the organization's boundaries, interested parties, and the services covered by the management system.

### Cross-Framework Mapping

The `framework_crosswalks` table maps equivalent controls between SOC 2 and ISO 27001. When a control is satisfied in one framework, the mapping is used to partially credit the equivalent control in the other framework, reducing duplicate evidence collection for organizations pursuing both certifications simultaneously.
