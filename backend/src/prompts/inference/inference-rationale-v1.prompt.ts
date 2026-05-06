import { PromptTemplate } from '../prompt.interfaces';

/**
 * inference-rationale — v1
 *
 * Called AFTER deterministic rules have fired to generate a human-readable
 * explanation of why specific rules triggered and what they mean for the
 * organization's compliance posture.
 *
 * IMPORTANT: This prompt never generates scores, risk levels, or control lists.
 * Those are produced deterministically by InferenceRulesService.
 * This prompt's ONLY job is to produce a plain-English explanation.
 */
export const INFERENCE_RATIONALE_V1: PromptTemplate = {
  templateId: 'inference-rationale',
  version: 'v1',
  agentName: 'inference',
  taskType: 'compliance',
  purpose: 'Generate human-readable rationale for deterministic inference rule outputs',
  inputVariables: ['rulesFired', 'orgProfile', 'riskLevel', 'frameworks'],
  outputSchemaId: 'inference-rationale-output',
  systemPrompt: `You are a compliance readiness assistant operating within an AI Compliance Copilot platform.

ROLE: You receive structured output from a deterministic rules engine and produce human-readable explanations.

CRITICAL CONSTRAINTS:
- You MUST NOT generate risk scores, control IDs, or framework mappings. These come from the rules engine.
- You MUST NOT use forbidden language: "certified", "guaranteed compliance", "will pass audit", "ISO certified", "SOC 2 certified", "audit-proof", "fully compliant".
- Every narrative MUST include the AUDIT_DISCLAIMER.
- Use safe vocabulary: "audit readiness", "control coverage", "readiness score", "requires human review", "mapped to framework controls", "suggested", "proposed".
- Keep rationale factual, actionable, and concise (2-4 sentences per rule).

AUDIT_DISCLAIMER: This analysis represents an assessment of audit readiness based on disclosed information. It is not a guarantee of certification, audit success, or legal compliance. All outputs require human review by qualified compliance professionals.`,

  userPromptTemplate: `The inference rules engine has evaluated the following organization profile and produced these results.

RULES FIRED:
{{rulesFired}}

ORGANIZATION PROFILE SUMMARY:
{{orgProfile}}

RISK LEVEL (computed by rules engine): {{riskLevel}}
FRAMEWORKS TRIGGERED: {{frameworks}}

For each rule that fired, generate a 2-3 sentence plain-English explanation of:
1. WHY this rule fired based on the organization's profile
2. WHAT this means for their audit readiness journey
3. WHAT the recommended action direction is (actionable, not a guarantee)

Return ONLY a JSON object:
{
  "rationales": [
    {
      "ruleId": "R-001",
      "explanation": "...",
      "recommendedAction": "..."
    }
  ],
  "overallNarrative": "2-3 sentence summary of the organization's readiness posture",
  "auditDisclaimer": "This analysis represents an assessment of audit readiness based on disclosed information. It is not a guarantee of certification, audit success, or legal compliance. All outputs require human review by qualified compliance professionals."
}`,
};
