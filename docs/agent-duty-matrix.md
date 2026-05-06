# Agent Duty Matrix

This document defines the responsibility, capability, and compliance properties of every agent in the pipeline.

**Pipeline order** (18 stages): scoping → control-mapper → planner → gap-analysis → policy → evidence → drift-detector → validator → risk-scoring → review → remediation-advisor → threat-intel → vendor-risk → task → interview → benchmark → audit → dashboard

**Out-of-pipeline agents**: `OnboardingAgent` (invoked directly by the onboarding flow, not the assessment pipeline)

---

## Pipeline Agents

### 1. ScopingAgent
| Property | Value |
|----------|-------|
| Queue | `agent.scoping` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `scoping-analysis` |
| Human checkpoint | Yes — scope must be approved before pipeline continues |
| Approver roles | `admin`, `security_lead` |
| DB writes | `soc2_scopes`, `iso27001_scopes`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Determines which SOC 2 Trust Service Categories and/or ISO 27001 ISMS boundaries apply to the organization. Produces a draft scope document for human review. Flags any ambiguous systems or data types that require clarification.

**Output keys**: `trustServiceCategories`, `auditType`, `systemsInScope`, `systemsOutOfScope`, `dataInScope`, `ambiguousItems`, `isoIsmsScope`

---

### 2. ControlMapperAgent
| Property | Value |
|----------|-------|
| Queue | `agent.control_mapper` |
| Calls LLM | **No** — purely deterministic |
| Task type | `deterministic` |
| Prompt template | none |
| Human checkpoint | Yes — applicability overrides require human approval |
| Approver roles | `security_lead` |
| DB writes | `control_applicability` (upsert per control per org), `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Applies the `ControlApplicabilityEngine` to determine which controls from the Control Library apply to the organization's scope. For ISO 27001, generates the Statement of Applicability (SoA) draft. No LLM involved — purely rule-based.

**Rules applied**:
- SOC 2 CC1–CC9 (Security): always applicable when SOC 2 selected
- SOC 2 A1 (Availability): applicable if uptime SLAs or availability scope
- SOC 2 C1 (Confidentiality): applicable if confidential data in scope
- SOC 2 PI1 (Processing Integrity): applicable if transaction processing
- SOC 2 P1–P8 (Privacy): applicable if PII in scope or GDPR jurisdiction
- ISO 27001 A.7 (Physical): `needs_review` for cloud-only companies

---

### 3. PlannerAgent
| Property | Value |
|----------|-------|
| Queue | `agent.planner` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `compliance-planner` |
| Human checkpoint | Yes — roadmap requires admin approval |
| Approver roles | `admin` |
| DB writes | `ComplianceJourney` (update), `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Generates a structured compliance roadmap from the applicable controls and gap data. Prioritizes controls by risk and effort. Produces a timeline with milestones.

---

### 4. GapAnalysisAgent
| Property | Value |
|----------|-------|
| Queue | `agent.gap_analysis` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `gap-analysis` |
| Human checkpoint | No |
| DB writes | `GapAnalysis` records, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Compares the current state of controls (evidence, policies, implementation status) against the applicable control requirements. Identifies gaps per control domain and per framework.

---

### 5. PolicyAgent
| Property | Value |
|----------|-------|
| Queue | `agent.policy` |
| Calls LLM | Yes |
| Task type | `policy` |
| Prompt template | `policy-generator` |
| Human checkpoint | Yes — per-policy approval required |
| Approver roles | `admin`, `security_lead` |
| DB writes | `Policy` (draft), `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Generates draft policy documents for each required policy mapped to applicable controls. Injects company-specific context (name, industry, tech stack). Uses RAG to pull relevant policy templates.

**Output**: One policy draft per required policy, each requiring human approval before becoming `approved` status.

---

### 6. EvidenceAgent
| Property | Value |
|----------|-------|
| Queue | `agent.evidence` |
| Calls LLM | Yes |
| Task type | `evidence_validation` |
| Prompt template | `evidence-collector` |
| Human checkpoint | Yes — evidence exceptions require security lead |
| Approver roles | `security_lead` |
| DB writes | `Evidence` (metadata), `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Describes the evidence required for each applicable control. Generates evidence collection tasks. In simulation mode, creates placeholder evidence records.

---

### 7. DriftDetectorAgent
| Property | Value |
|----------|-------|
| Queue | `agent.drift` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `drift-detector` |
| Human checkpoint | No |
| DB writes | `DriftReport`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Compares the current control/policy/evidence state against the last approved baseline. Detects drift in configuration, policy content, and evidence freshness.

---

### 8. ValidatorAgent
| Property | Value |
|----------|-------|
| Queue | `agent.validator` |
| Calls LLM | Yes |
| Task type | `evidence_validation` |
| Prompt template | `evidence-validator` |
| Human checkpoint | Yes — ambiguous evidence requires human review |
| Approver roles | `security_lead` |
| DB writes | `EvidenceValidation`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Validates collected evidence against control requirements. Checks freshness (staleness), completeness, and authenticity. Uses rule-first validation with LLM assist for ambiguous cases.

---

### 9. RiskScoringAgent
| Property | Value |
|----------|-------|
| Queue | `agent.risk_scoring` |
| Calls LLM | Yes |
| Task type | `risk` |
| Prompt template | `risk-register` |
| Human checkpoint | Yes — risk acceptance decisions require exec/security lead |
| Approver roles | `executive`, `security_lead` |
| DB writes | `RiskItem`, `RiskTreatment`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Builds or updates the risk register. Maps threats and vulnerabilities to applicable controls. Calculates inherent and residual risk scores. Generates risk treatment recommendations (mitigate/accept/transfer/avoid).

---

### 10. ReviewAgent
| Property | Value |
|----------|-------|
| Queue | `agent.review` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `review-summary` |
| Human checkpoint | Yes — final review sign-off |
| Approver roles | `admin`, `security_lead` |
| DB writes | `ReviewSummary`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Synthesizes all prior pipeline outputs into a review summary. Identifies remaining gaps, open risks, and required actions before audit readiness.

---

### 11. RemediationAdvisorAgent
| Property | Value |
|----------|-------|
| Queue | `agent.remediation` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `remediation-advisor` |
| Human checkpoint | No |
| DB writes | `RemediationPlan`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Generates specific, actionable remediation steps for each identified gap or failed control. Prioritizes by risk impact and implementation effort.

---

### 12. ThreatIntelAgent
| Property | Value |
|----------|-------|
| Queue | `agent.threat_intel` |
| Calls LLM | Yes |
| Task type | `risk` |
| Prompt template | `threat-intel` |
| Human checkpoint | No |
| DB writes | `ThreatIntelReport`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Assesses threat landscape relevant to the organization's industry, tech stack, and data types. Maps threats to applicable controls and open risks.

---

### 13. VendorRiskAgent
| Property | Value |
|----------|-------|
| Queue | `agent.vendor_risk` |
| Calls LLM | Yes |
| Task type | `risk` |
| Prompt template | `vendor-risk` |
| Human checkpoint | Yes — critical vendor risk requires security lead |
| Approver roles | `security_lead` |
| DB writes | `VendorRiskAssessment`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Assesses third-party vendor compliance risk. Reviews vendor certifications, contractual obligations, and data processing agreements for SOC 2 / ISO 27001 requirements.

---

### 14. TaskAgent
| Property | Value |
|----------|-------|
| Queue | `agent.task` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `task-generator` |
| Human checkpoint | No |
| DB writes | `ComplianceTask`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Converts remediation plans and gap findings into assigned, trackable tasks with owners, due dates, and priority levels.

---

### 15. InterviewAgent
| Property | Value |
|----------|-------|
| Queue | `agent.interview` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `interview-prep` |
| Human checkpoint | No |
| DB writes | `InterviewGuide`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Generates auditor interview preparation guides. Maps likely auditor questions to controls and evidence. Prepares staff talking points.

---

### 16. BenchmarkAgent
| Property | Value |
|----------|-------|
| Queue | `agent.benchmark` |
| Calls LLM | Yes |
| Task type | `compliance` |
| Prompt template | `benchmark` |
| Human checkpoint | No |
| DB writes | `BenchmarkReport`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Benchmarks the organization's control maturity against industry peers (by company size and industry). Produces a maturity level rating (1–5) per control domain.

---

### 17. AuditAgent
| Property | Value |
|----------|-------|
| Queue | `agent.audit` |
| Calls LLM | Yes |
| Task type | `audit_export` |
| Prompt template | `audit-export` |
| Human checkpoint | Yes — final audit package sign-off required |
| Approver roles | `admin`, `executive` |
| DB writes | `AuditExport`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Compiles the final audit package. Gathers all approved policies, validated evidence, accepted risk treatments, and approved controls. Generates the SOC 2 Readiness Report and/or ISO Statement of Applicability. Always includes `AUDIT_DISCLAIMER`.

---

### 18. DashboardAgent
| Property | Value |
|----------|-------|
| Queue | `agent.dashboard` |
| Calls LLM | Yes |
| Task type | `dashboard` |
| Prompt template | `dashboard-config` |
| Human checkpoint | No |
| DB writes | `dashboard_configs`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Generates role-specific dashboard configurations (`executive`, `security`, `auditor`, `admin`, `contributor`). Pulls readiness scores, control status, task backlog, and evidence freshness. Produces `DashboardConfig` JSON consumed by the frontend renderer.

---

## Out-of-Pipeline Agents

### OnboardingAgent
| Property | Value |
|----------|-------|
| Queue | `agent.onboarding` |
| Calls LLM | Yes (via DialogueManagerService) |
| Task type | `onboarding` |
| Prompt template | `onboarding-dialogue`, `onboarding-dialogue-question` |
| Human checkpoint | Yes — after profile is complete |
| Approver roles | `admin` |
| DB writes | `BusinessProfile`, `OnboardingSession`, `AgentRun`, `AgentStep` |
| Tenant isolation | All writes include `orgId` |

**Responsibility**: Conducts a multi-turn dialogue to extract structured business profile data (company info, tech stack, data types, compliance goals, infrastructure). Uses `DialogueManagerService` for conversation state management. Profile completion triggers the full assessment pipeline.

---

## Compliance Gate Summary

| Rule | Enforced by |
|------|-------------|
| No inline prompts | CI scan + code review |
| No raw LLM calls in agents | CI scan |
| No direct agent-to-agent calls | CI scan |
| No forbidden certification language | CI scan (prompts) + OutputValidatorService (runtime) |
| All DB writes include orgId | Code review + tenant isolation tests |
| Human checkpoints for high-risk decisions | Agent contract + orchestrator |

---

## Readiness Scoring Inputs by Agent

The `ReadinessScoringService` pulls from these agent outputs (not from agent responses directly — from the DB records they write):

| Score Component | Source Agents |
|----------------|--------------|
| `control_design_score` | ControlMapperAgent (applicability), ValidatorAgent (pass/fail) |
| `evidence_score` | EvidenceAgent (collection), ValidatorAgent (acceptance) |
| `policy_score` | PolicyAgent (generation), human approvals |
| `operational_score` | TaskAgent (completion rate), RiskScoringAgent (high risk resolution) |
| `risk_management_score` | RiskScoringAgent (treatment decisions) |
