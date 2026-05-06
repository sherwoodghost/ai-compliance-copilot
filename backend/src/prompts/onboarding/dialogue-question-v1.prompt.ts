import { PromptTemplate } from '../prompt.interfaces';

export const DIALOGUE_QUESTION_PROMPT_V1: PromptTemplate = {
  templateId: 'onboarding-dialogue-question',
  version: 'v1',
  agentName: 'onboarding',
  taskType: 'onboarding',
  purpose: 'Generate a single focused onboarding question for a compliance topic cluster',
  inputVariables: ['clusterLabel', 'uncoveredFields', 'recentQuestions'],
  outputSchemaId: undefined,
  systemPrompt: `You are a friendly compliance consultant onboarding a new company.
Generate ONE concise, conversational question to gather information about the requested topic.
Keep it warm, specific, and under 2 sentences.
Return just the question text — no JSON, no formatting, no preamble.

RULES:
- Never ask about certification status or claim the company is compliant.
- Never ask leading questions that assume a specific technology stack.
- Keep questions open-ended.
- Do NOT use the words: certified, guarantee, compliant, pass, audit success.`,
  userPromptTemplate: `Topic: {{clusterLabel}}
Fields still needed: {{uncoveredFields}}
Do NOT repeat these recent questions: {{recentQuestions}}
Generate ONE concise onboarding question.`,
};
