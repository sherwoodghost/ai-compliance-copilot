import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

// All required fields and their "topic clusters"
const FIELD_CLUSTERS: Record<string, { fields: string[]; priority: number; label: string }> = {
  company_basics: {
    priority: 1,
    label: 'Company Basics',
    fields: ['companyName', 'companyType', 'employeeCount', 'industry', 'website'],
  },
  tech_stack: {
    priority: 2,
    label: 'Technology Stack',
    fields: ['cloudProviders', 'infrastructure', 'codeRepositories', 'ciCdTools', 'monitoringTools'],
  },
  data_handling: {
    priority: 3,
    label: 'Data & Privacy',
    fields: ['dataTypes', 'dataResidency', 'piiHandling', 'dataRetentionDays', 'encryptionAtRest'],
  },
  current_posture: {
    priority: 4,
    label: 'Current Security Posture',
    fields: ['existingControls', 'previousAudits', 'securityTeamSize', 'incidentHistory'],
  },
  compliance_goals: {
    priority: 5,
    label: 'Compliance Goals',
    fields: ['targetFrameworks', 'complianceDriver', 'targetDate', 'budget'],
  },
};

// Minimum required fields to consider the profile complete
const REQUIRED_FIELDS = new Set([
  'companyName', 'companyType', 'employeeCount', 'industry',
  'cloudProviders', 'dataTypes', 'targetFrameworks', 'complianceDriver',
]);

export interface DialogueDecision {
  nextTopic: string;
  suggestedQuestion: string;
  completedFields: string[];
  pendingFields: string[];
  isComplete: boolean;
  completionPct: number;
}

@Injectable()
export class DialogueManagerService {
  private readonly logger = new Logger(DialogueManagerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: LlmGatewayService,
  ) {}

  async getOrCreateState(orgId: string, sessionId: string) {
    const existing = await this.prisma.dialogueState.findUnique({ where: { orgId } });
    if (existing) return existing;

    const allFields = Object.values(FIELD_CLUSTERS).flatMap((c) => c.fields);
    return this.prisma.dialogueState.create({
      data: {
        orgId,
        sessionId,
        currentTopic: 'company_basics',
        completedFields: [],
        pendingFields: allFields,
        questionHistory: [],
        turnCount: 0,
      },
    });
  }

  /**
   * After each user message, update extracted fields and decide what to ask next.
   * Returns the next question selected by rule-based logic + LLM phrasing through gateway.
   */
  async updateAndDecide(
    orgId: string,
    extractedFields: Record<string, unknown>,
    latestAnswer: string,
    _runId: string,
  ): Promise<DialogueDecision> {
    const state = await this.prisma.dialogueState.findUnique({ where: { orgId } });
    if (!state) throw new Error('Dialogue state not found');

    const completed = state.completedFields as string[];
    const pending = state.pendingFields as string[];
    const history = state.questionHistory as any[];

    // Mark newly extracted fields as completed
    const newlyCompleted = Object.keys(extractedFields).filter(
      (f) => extractedFields[f] != null && !completed.includes(f),
    );
    const updatedCompleted = [...completed, ...newlyCompleted];
    const updatedPending = pending.filter((f) => !newlyCompleted.includes(f));

    // Check completion
    const requiredDone = [...REQUIRED_FIELDS].filter((f) => updatedCompleted.includes(f));
    const isComplete = requiredDone.length === REQUIRED_FIELDS.size;
    const completionPct = Math.round((requiredDone.length / REQUIRED_FIELDS.size) * 100);

    // Rule-based topic selection: pick highest-priority cluster with uncovered fields
    const nextTopic = this.selectNextTopic(updatedCompleted);

    // Generate question via LLM Gateway (registered prompt — no inline prompts)
    let suggestedQuestion = '';
    if (!isComplete) {
      suggestedQuestion = await this.generateQuestion(
        orgId,
        nextTopic,
        updatedCompleted,
        history,
      );
    }

    // Append to history
    if (latestAnswer) {
      history.push({
        topic: state.currentTopic,
        answer: latestAnswer,
        fieldsExtracted: newlyCompleted,
        timestamp: new Date().toISOString(),
      });
    }

    // Persist updated state
    await this.prisma.dialogueState.update({
      where: { orgId },
      data: {
        currentTopic: nextTopic,
        completedFields: updatedCompleted as any,
        pendingFields: updatedPending as any,
        questionHistory: history as any,
        turnCount: { increment: 1 },
      },
    });

    return {
      nextTopic,
      suggestedQuestion,
      completedFields: updatedCompleted,
      pendingFields: updatedPending,
      isComplete,
      completionPct,
    };
  }

  private selectNextTopic(completed: string[]): string {
    for (const [topic, cluster] of Object.entries(FIELD_CLUSTERS).sort(
      ([, a], [, b]) => a.priority - b.priority,
    )) {
      const uncovered = cluster.fields.filter((f) => !completed.includes(f));
      if (uncovered.length > 0) return topic;
    }
    return 'compliance_goals';
  }

  /**
   * Generate the next onboarding question using the registered LLM Gateway prompt.
   * All LLM calls go through the gateway — no raw provider calls, no inline prompts.
   */
  private async generateQuestion(
    orgId: string,
    topic: string,
    completed: string[],
    history: any[],
  ): Promise<string> {
    const cluster = FIELD_CLUSTERS[topic];
    if (!cluster) return 'Can you tell me more about your compliance goals?';

    const uncoveredFields = cluster.fields.filter((f) => !completed.includes(f));
    const recentQuestions = history.slice(-3).map((h) => h.question).filter(Boolean);

    try {
      const response = await this.gateway.call({
        promptTemplateId: 'onboarding-dialogue-question',
        promptTemplateVersion: 'v1',
        variables: {
          clusterLabel: cluster.label,
          uncoveredFields: uncoveredFields.join(', ') || 'none',
          recentQuestions: recentQuestions.join('; ') || 'none',
        },
        taskType: 'onboarding',
        orgId,
        agentName: 'onboarding',
        maxTokens: 150,
      });

      return response.content.trim();
    } catch (err: any) {
      this.logger.warn(`DialogueManager question generation failed: ${err.message} — using fallback`);
      return `Could you tell me more about your ${cluster.label.toLowerCase()}?`;
    }
  }

  async getCompletionStatus(orgId: string): Promise<{ completionPct: number; isComplete: boolean; missingFields: string[] }> {
    const state = await this.prisma.dialogueState.findUnique({ where: { orgId } });
    if (!state) return { completionPct: 0, isComplete: false, missingFields: [...REQUIRED_FIELDS] };

    const completed = state.completedFields as string[];
    const requiredDone = [...REQUIRED_FIELDS].filter((f) => completed.includes(f));
    const missing = [...REQUIRED_FIELDS].filter((f) => !completed.includes(f));

    return {
      completionPct: Math.round((requiredDone.length / REQUIRED_FIELDS.size) * 100),
      isComplete: missing.length === 0,
      missingFields: missing,
    };
  }
}
