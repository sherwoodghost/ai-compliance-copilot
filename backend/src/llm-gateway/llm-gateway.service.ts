import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { LlmService } from '../llm/llm.service';
import { PromptRegistryService } from './prompt-registry.service';
import { ContextPackerService, TaskType, COMPLIANCE_SAFE_WRAPPER } from './context-packer.service';
import { OutputValidatorService } from './output-validator.service';
import { RagService, RagSourceType } from './rag/rag.service';
import { RetrievalLogService } from './rag/retrieval-log.service';

export interface LlmGatewayRequest {
  /** Registered prompt template ID */
  promptTemplateId: string;
  /** Version — defaults to 'v1' */
  promptTemplateVersion?: string;
  /** Variables to substitute into the user prompt template */
  variables?: Record<string, string>;
  /** Override: raw user message (used when not using a template) */
  userMessage?: string;
  /** Task type for context packing */
  taskType?: TaskType;
  /** Org ID for context injection */
  orgId?: string;
  /** Agent name for model routing */
  agentName?: string;
  /** Workflow / run IDs for audit logging */
  workflowId?: string;
  agentRunId?: string;
  /** Model override */
  model?: string;
  maxTokens?: number;
  temperature?: number;
  /** Whether to validate control IDs in output */
  requiresControlValidation?: boolean;
  /** Optional specific control IDs to include in context */
  contextControlIds?: string[];
  /** RAG query — if set, retrieves relevant chunks from the vector store */
  ragQuery?: string;
  /** RAG source types to restrict retrieval to */
  ragSourceTypes?: RagSourceType[];
}

export interface LlmGatewayResponse {
  content: string;
  llmCallId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  schemaValid: boolean;
  controlIdsValid: boolean;
  forbiddenLanguageDetected: boolean;
}

// Model routing — same as LlmService but centralized here going forward
const AGENT_MODEL_ROUTING: Record<string, string> = {
  review:             'claude-sonnet-4-6',
  onboarding:         'claude-sonnet-4-6',
  policy:             'claude-sonnet-4-6',
  'gap-analysis':     'claude-sonnet-4-6',
  validator:          'claude-sonnet-4-6',
  planner:            'claude-sonnet-4-6',
  audit:              'claude-sonnet-4-6',
  scoping:            'claude-sonnet-4-6',
  risk:               'claude-sonnet-4-6',
  'control-mapper':   'claude-haiku-4-5-20251001',
  evidence:           'claude-haiku-4-5-20251001',
  task:               'claude-haiku-4-5-20251001',
  'vendor-risk':      'claude-haiku-4-5-20251001',
  'drift-detector':   'claude-haiku-4-5-20251001',
  dashboard:          'claude-haiku-4-5-20251001',
};

const MAX_RETRIES = 3;

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly promptRegistry: PromptRegistryService,
    private readonly contextPacker: ContextPackerService,
    private readonly outputValidator: OutputValidatorService,
    private readonly ragService: RagService,
    private readonly retrievalLog: RetrievalLogService,
  ) {}

  /**
   * The single entrypoint for all LLM calls on this platform.
   * Enforces: prompt registry, context packing, compliance wrapper, output validation, audit logging.
   */
  async call(request: LlmGatewayRequest): Promise<LlmGatewayResponse> {
    const {
      promptTemplateId,
      promptTemplateVersion = 'v1',
      variables = {},
      userMessage,
      taskType = 'generic',
      orgId,
      agentName,
      workflowId,
      agentRunId,
      requiresControlValidation = false,
      contextControlIds,
      ragQuery,
      ragSourceTypes,
    } = request;

    // ── Step 1: Load and render prompt from registry ─────────────────────────
    const template = this.promptRegistry.get(promptTemplateId, promptTemplateVersion);
    const rendered = userMessage
      ? { systemPrompt: template.systemPrompt, userPrompt: userMessage, contentHash: template.contentHash, templateId: promptTemplateId, version: promptTemplateVersion }
      : this.promptRegistry.render(promptTemplateId, promptTemplateVersion, variables);

    // ── Step 2: Build context pack (includes RAG retrieval if query provided) ─
    const contextPack = await this.contextPacker.build(taskType, orgId, {
      controlIds: contextControlIds,
      includeRisks: ['compliance', 'risk', 'audit_export'].includes(taskType),
      includePolicies: ['policy', 'audit_export'].includes(taskType),
      ragQuery,
      ragSourceTypes,
    });
    const requiresRetrieval = !!ragQuery;

    const contextString = this.contextPacker.serialize(contextPack);

    // ── Step 3: Build final system prompt (wrapper + context + template) ──────
    const systemPrompt = [
      COMPLIANCE_SAFE_WRAPPER,
      contextString ? `${contextString}\n\n` : '',
      rendered.systemPrompt,
    ].join('');

    const promptHash = createHash('sha256').update(systemPrompt + rendered.userPrompt).digest('hex');

    // ── Step 4: Select model ──────────────────────────────────────────────────
    const model = request.model ??
      (agentName ? (AGENT_MODEL_ROUTING[agentName] ?? 'claude-sonnet-4-6') : 'claude-sonnet-4-6');

    // ── Step 5: Call LLM with retry + forbidden language re-try ──────────────
    const startTime = Date.now();
    let content = '';
    let rawOutput = '';
    let retryCount = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let validationResult: Awaited<ReturnType<OutputValidatorService['validate']>> | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.llm.complete(
          [{ role: 'user', content: rendered.userPrompt }],
          {
            agentName,
            model,
            maxTokens: request.maxTokens ?? 4096,
            temperature: request.temperature ?? 0.2,
            systemPrompt,
          },
        );

        content = response.content;
        rawOutput = content;
        inputTokens = response.tokensIn ?? 0;
        outputTokens = response.tokensOut ?? 0;

        // ── Step 6: Validate output ─────────────────────────────────────────
        validationResult = await this.outputValidator.validate(content, {
          requiresControlValidation,
          outputSchemaId: template.outputSchemaId,
        });

        if (validationResult.forbiddenLanguageDetected && attempt < MAX_RETRIES) {
          retryCount++;
          this.logger.warn(
            `Forbidden language in LLM output (attempt ${attempt}/${MAX_RETRIES}), retrying...`,
          );
          // Append a correction hint for retry
          rendered.userPrompt += `\n\n[SYSTEM CORRECTION: Your previous response contained forbidden language. Do NOT use the words: certified, guaranteed compliance, passed audit, ISO certified, fully compliant. Rewrite your response.]\n`;
          continue;
        }

        break; // Valid output — exit retry loop
      } catch (error: any) {
        this.logger.error(`LLM call failed (attempt ${attempt}): ${error.message}`);
        if (attempt === MAX_RETRIES) throw error;
        retryCount++;
        await this.sleep(1000 * attempt);
      }
    }

    const latencyMs = Date.now() - startTime;

    // ── Step 7: Log to llm_calls ──────────────────────────────────────────────
    const llmCallRecord = await this.prisma.llmCall.create({
      data: {
        orgId: orgId ?? null,
        workflowId: workflowId ?? null,
        agentRunId: agentRunId ?? null,
        taskType,
        promptTemplateId,
        promptTemplateVersion,
        promptHash,
        renderedPrompt: {
          system: systemPrompt.slice(0, 2000), // truncate for storage
          user: rendered.userPrompt.slice(0, 2000),
        },
        model,
        provider: 'anthropic',
        inputTokens,
        outputTokens,
        costUsd: this.estimateCost(model, inputTokens, outputTokens),
        latencyMs,
        requiresRetrieval,
        requiresControlValidation,
        schemaValid: validationResult?.schemaValid ?? true,
        controlIdsValid: validationResult?.controlIdsValid ?? true,
        hallucinationDetected: validationResult?.hallucinationDetected ?? false,
        forbiddenLanguageDetected: validationResult?.forbiddenLanguageDetected ?? false,
        retryCount,
        rawOutput: rawOutput.slice(0, 10000), // truncate for storage
      },
    });

    if (validationResult?.issues?.length) {
      this.logger.warn(
        `LLM call ${llmCallRecord.id} validation issues: ${validationResult.issues.join('; ')}`,
      );
    }

    // ── Log retrieval sources if RAG was used ─────────────────────────────────
    if (ragQuery && contextPack.ragContext) {
      // We already retrieved chunks during context packing — log them
      // Re-retrieve to get chunk IDs for logging (lightweight since already cached by context packer)
      try {
        const logChunks = await this.ragService.retrieve(ragQuery, orgId, {
          sourceTypes: ragSourceTypes,
          topK: 6,
        });
        const includedIds = new Set(logChunks.map((c) => c.id));
        await this.retrievalLog.logRetrieval(llmCallRecord.id, logChunks, includedIds);
      } catch {
        // Non-fatal
      }
    }

    return {
      content: validationResult?.sanitizedContent ?? content,
      llmCallId: llmCallRecord.id,
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      schemaValid: validationResult?.schemaValid ?? true,
      controlIdsValid: validationResult?.controlIdsValid ?? true,
      forbiddenLanguageDetected: validationResult?.forbiddenLanguageDetected ?? false,
    };
  }

  /**
   * Convenience method for raw LLM calls that bypass the template registry
   * (used for backward compatibility with existing agents during migration).
   * Still enforces the compliance wrapper and audit logging.
   */
  async callRaw(
    systemPrompt: string,
    userMessage: string,
    options: Omit<LlmGatewayRequest, 'promptTemplateId' | 'variables'> & { promptTemplateId?: string },
  ): Promise<LlmGatewayResponse> {
    return this.call({
      promptTemplateId: options.promptTemplateId ?? 'onboarding-dialogue', // fallback — should not be used
      promptTemplateVersion: options.promptTemplateVersion,
      userMessage,
      taskType: options.taskType,
      orgId: options.orgId,
      agentName: options.agentName,
      workflowId: options.workflowId,
      agentRunId: options.agentRunId,
      model: options.model,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      requiresControlValidation: options.requiresControlValidation,
    });
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Approximate pricing (USD per 1K tokens)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-6': { input: 0.003, output: 0.015 },
      'claude-haiku-4-5-20251001': { input: 0.00025, output: 0.00125 },
    };

    const rates = pricing[model] ?? { input: 0.003, output: 0.015 };
    return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
