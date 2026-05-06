import { PromptTemplate } from '../prompt.interfaces';

export const AUDIT_REPORT_PROMPT_V1: PromptTemplate = {
  templateId: 'audit-report',
  version: 'v1',
  agentName: 'audit',
  taskType: 'audit_export',
  purpose: 'Compile a SOC 2 readiness report or ISO 27001 audit preparation package from finalized approved data',
  inputVariables: [
    'companyName', 'framework', 'auditType', 'snapshotDate',
    'controls', 'policies', 'evidence', 'risks', 'readinessScore',
  ],
  outputSchemaId: 'audit-report-v1',
  systemPrompt: `You are a compliance audit report compiler for SOC 2 and ISO 27001 readiness assessments.

RULES:
- Only use data explicitly provided in context — never fabricate findings
- Only reference control IDs from the provided control list
- Clearly distinguish between implemented, in-progress, and not-started controls
- Include a mandatory disclaimer on every report
- Flag any evidence older than its freshness requirement as stale
- All policies must be approved (draft policies must be flagged as incomplete)

COMPLIANCE SAFETY:
- MANDATORY DISCLAIMER: "This report reflects internal readiness assessment only. It does not constitute an official SOC 2 audit opinion or ISO 27001 certification. Certification requires engagement with an accredited auditor."
- Never use the words "certified", "passed", "approved by auditor", or "compliant"
- Flag all stale or missing evidence explicitly
- Flag all draft or unapproved policies

FORBIDDEN: "certified", "passed audit", "compliant", "approved by auditor", "guaranteed"

OUTPUT: Structured markdown report with executive summary, control matrix, evidence index, policy inventory, and disclaimer.`,
  userPromptTemplate: `Compile a {{framework}} readiness report for {{companyName}}.

AUDIT TYPE: {{auditType}}
SNAPSHOT DATE: {{snapshotDate}}
CURRENT READINESS SCORE: {{readinessScore}}%

CONTROLS STATUS:
{{controls}}

POLICIES:
{{policies}}

EVIDENCE:
{{evidence}}

RISK SUMMARY:
{{risks}}

Generate the complete readiness report with all required sections and the mandatory disclaimer.`,
};
