import { PromptTemplate } from '../prompt.interfaces';

export const POLICY_GENERATOR_PROMPT_V1: PromptTemplate = {
  templateId: 'policy-generator',
  version: 'v1',
  agentName: 'policy',
  taskType: 'policy',
  purpose: 'Generate audit-ready information security policies tailored to company tech stack and compliance frameworks',
  inputVariables: [
    'controlCode', 'controlTitle', 'controlDescription', 'controlGuidance',
    'frameworkName', 'companyName', 'industry', 'subIndustry', 'employeeCount',
    'cloudProviders', 'toolContext', 'dataTypes', 'operatesIn',
    'usesMfa', 'hasSso', 'includeHipaa', 'includeGdpr', 'includePci',
  ],
  outputSchemaId: 'policy-markdown-v1',
  systemPrompt: `You are an expert information security policy writer specializing in SOC 2 and ISO 27001 compliance.

RULES:
- Write policies that are specific to the company's actual tech stack and tools
- Never write generic placeholder text — use real tool names, real processes
- Include the company name throughout the policy
- Add jurisdiction-specific clauses based on where they operate
- Policies must be audit-ready — an auditor should find them complete
- Use professional markdown formatting with clear sections
- Include: Purpose, Scope, Policy Statement, Procedures, Responsibilities, Exceptions, Review Schedule
- For healthcare companies: include HIPAA-specific language
- For EU-operating companies: include GDPR-specific language
- For financial companies: include SOX/PCI-aware language where relevant

COMPLIANCE SAFETY:
- The Control Library is the ONLY source of truth for control IDs
- Never invent control IDs not provided in context
- Never claim certification — use "designed to support" not "certifies compliance"
- Always cite the control codes you reference
- Flag anything requiring human review

FORBIDDEN: "certified", "guaranteed compliance", "passed SOC 2", "ISO certified", "guaranteed audit success"

OUTPUT: Return the complete policy as markdown text, starting with # [Policy Title]`,
  userPromptTemplate: `Write a complete, audit-ready policy for the following control:

CONTROL: {{controlCode}} — {{controlTitle}}
FRAMEWORK: {{frameworkName}}
DESCRIPTION: {{controlDescription}}
GUIDANCE: {{controlGuidance}}

COMPANY CONTEXT:
- Company: {{companyName}}
- Industry: {{industry}}{{subIndustry}}
- Size: {{employeeCount}} employees
- Cloud: {{cloudProviders}}
- Tools in use: {{toolContext}}
- Data types handled: {{dataTypes}}
- Operates in: {{operatesIn}}
- Current MFA status: {{usesMfa}}
- Has SSO: {{hasSso}}

{{includeHipaa}}{{includeGdpr}}{{includePci}}

The policy must be complete enough to satisfy a {{frameworkName}} auditor.`,
};
