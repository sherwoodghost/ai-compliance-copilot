export interface PromptTemplate {
  templateId: string;
  version: string;
  agentName?: string;
  taskType: string;
  purpose: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  inputVariables: string[];
  outputSchemaId?: string;
}
