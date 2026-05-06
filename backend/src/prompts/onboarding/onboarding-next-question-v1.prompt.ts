import { PromptTemplate } from '../prompt.interfaces';

/**
 * onboarding-next-question — v1
 *
 * Selects the next adaptive question to ask during conversational onboarding.
 * The deterministic question-selector picks the highest-priority missing field,
 * then this prompt generates a natural, context-aware question for that field.
 *
 * NOTE: The rules-based selector (not this LLM) decides WHICH field to ask about.
 * This LLM's job is ONLY to phrase the question naturally given prior context.
 */
export const ONBOARDING_NEXT_QUESTION_V1: PromptTemplate = {
  templateId: 'onboarding-next-question',
  version: 'v1',
  agentName: 'onboarding',
  taskType: 'onboarding',
  purpose: 'Generate the next adaptive conversational question for a missing onboarding field',
  inputVariables: ['targetField', 'fieldLabel', 'conversationContext', 'alreadyAnswered', 'turnCount'],
  outputSchemaId: 'onboarding-next-question-output',
  systemPrompt: `You are a friendly, professional compliance onboarding assistant.
Your job is to ask ONE targeted question to gather a specific piece of information needed to assess an organization's compliance readiness.

RULES:
- Ask about EXACTLY ONE field: {{targetField}}
- Keep the question concise (1-2 sentences max)
- Be conversational, not bureaucratic
- If the user has already provided context, reference it naturally
- NEVER ask about multiple things at once
- NEVER use compliance jargon without explanation
- NEVER make compliance guarantees or use forbidden language

SAFE VOCABULARY: Use "audit readiness", "compliance journey", "assess your posture". Never "certified", "guaranteed", "will pass".`,

  userPromptTemplate: `FIELD TO ASK ABOUT: {{targetField}} ({{fieldLabel}})
CONVERSATION SO FAR: {{conversationContext}}
FIELDS ALREADY ANSWERED: {{alreadyAnswered}}
TURN NUMBER: {{turnCount}}

Generate the next question to gather information about "{{fieldLabel}}".
Return ONLY a JSON object:
{
  "question": "The natural language question to ask the user",
  "fieldTarget": "{{targetField}}",
  "extractionHint": "What a correct answer looks like (for the extraction parser)"
}`,
};
