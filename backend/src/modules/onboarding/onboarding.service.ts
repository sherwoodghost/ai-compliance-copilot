import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '../../orchestrator/queue.config';
import { DialogueManagerService } from '../../agents/onboarding/dialogue-manager.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

/** Minimum completeness fraction (0–1) required to allow finalize */
const FINALIZE_COMPLETENESS_THRESHOLD = 0.85;

// ─── Inline system prompt for sync chat ──────────────────────────────────────
// Mirrors the 'onboarding-agent' seed prompt; used when calling the LLM
// directly without going through the job queue.
const ONBOARDING_SYSTEM_PROMPT = `You are a compliance onboarding specialist guiding a new client through their first GRC conversation. You are warm, precise, and efficient. Your goal is to collect the information needed to build their business profile so the platform can generate a tailored compliance plan.

CONVERSATION HISTORY:
{{conversationHistory}}

EXISTING PROFILE DATA COLLECTED SO FAR:
{{existingProfile}}

USER'S LATEST MESSAGE:
{{message}}

━━━ FIELDS TO COLLECT (priority order) ━━━
1. companyName — the company's name
2. companyType — startup / smb / enterprise / nonprofit
3. industry — saas / fintech / healthcare / ecommerce / real_estate / professional_services / other
4. employeeCount — number of employees
5. cloudProviders — aws / gcp / azure / self-hosted (array)
6. dataTypes — pii / phi / pci_data / ip / public (array)
7. targetFrameworks — SOC2 / ISO27001 / HIPAA / GDPR / PCI-DSS (array)
8. complianceDriver — customer_requirement / investor / internal / regulatory
9. targetDate — optional ISO date string for audit target

━━━ RULES ━━━
- Ask ONE question at a time — the most critical missing field.
- Acknowledge the user's previous answer before asking the next question.
- Extract structured data from casual language.
- Never re-ask about fields already collected.
- When completionScore reaches 85+, summarize what you know and confirm.
- Mirror the user's communication style.

━━━ OUTPUT FORMAT (return ONLY valid JSON, no other text) ━━━
{
  "nextMessage": "string — warm, conversational, ONE question",
  "extractedFields": { "fieldName": "value" },
  "completionScore": number (0-100),
  "isComplete": boolean (true when score >= 85)
}`;

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.AGENT_ONBOARDING) private readonly onboardingQueue: Queue,
    private readonly dialogueManager: DialogueManagerService,
    private readonly gateway: LlmGatewayService,
  ) {}

  async getOrCreateSession(orgId: string, userId: string) {
    const existing = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: 'in_progress' },
      include: {
        messages: { orderBy: { turnIndex: 'asc' } },
      },
    });

    if (existing) return existing;

    // Create new session + trigger greeting message
    const session = await this.prisma.onboardingSession.create({
      data: {
        orgId,
        userId,
        status: 'in_progress',
        currentState: 'GREETING',
      },
    });

    // Queue greeting job (no user message → agent sends first)
    await this.enqueueMessage(session.id, orgId, null, userId);

    return this.prisma.onboardingSession.findUnique({
      where: { id: session.id },
      include: { messages: { orderBy: { turnIndex: 'asc' } } },
    });
  }

  async sendMessage(orgId: string, userId: string, message: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: 'in_progress' },
    });

    if (!session) {
      throw new NotFoundException('No active onboarding session. Start a new session first.');
    }

    if (!message?.trim()) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Add to queue and return jobId for WebSocket tracking
    const job = await this.enqueueMessage(session.id, orgId, message, userId);
    return { sessionId: session.id, jobId: job.id };
  }

  // ─── Synchronous chat endpoint (no queue, no WebSocket) ─────────────────────
  // Called by POST /onboarding/chat. Processes the message inline and returns
  // the AI response directly in the HTTP response.
  // Pass userMessage=null for the initial greeting.
  async chatSync(orgId: string, userId: string, userMessage: string | null) {
    // 1. Ensure session exists
    let session = await this.prisma.onboardingSession.findFirst({
      where: { orgId },
      include: { messages: { orderBy: { turnIndex: 'asc' } } },
    });

    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: { orgId, userId, status: 'in_progress', currentState: 'GREETING' },
        include: { messages: { orderBy: { turnIndex: 'asc' } } },
      }) as any;
    }

    const sessionId = session!.id;
    const existingMessages: { role: string; content: string }[] = (session as any).messages ?? [];
    const turnIndex = existingMessages.length;

    // 2. Save user message
    if (userMessage?.trim()) {
      await this.prisma.onboardingMessage.create({
        data: {
          sessionId,
          turnIndex,
          role: 'user',
          content: userMessage.trim(),
          extractedFields: {} as any,
          stateAtTime: (session as any).currentState ?? 'GREETING',
        },
      });
    }

    // 3. Build conversation history string
    const historyLines = existingMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // 4. Get extracted profile so far
    const extractedSoFar = (session as any).extractedData as Record<string, unknown> ?? {};

    // 5. Build the full system prompt with context
    const systemPrompt = ONBOARDING_SYSTEM_PROMPT
      .replace('{{conversationHistory}}', historyLines || '(no messages yet)')
      .replace('{{existingProfile}}', Object.keys(extractedSoFar).length
        ? JSON.stringify(extractedSoFar, null, 2)
        : '(none yet)')
      .replace('{{message}}', userMessage?.trim() || '(start of conversation — send your greeting)');

    // 6. Call LLM
    let assistantContent = '';
    let extractedFields: Record<string, unknown> = {};
    let completionScore = 0;
    let isComplete = false;

    const llmUserMessage = userMessage?.trim() || 'Please start the onboarding conversation with a warm greeting.';

    try {
      const response = await this.gateway.callRaw(
        systemPrompt,
        llmUserMessage,
        {
          taskType: 'onboarding',
          orgId,
          agentName: 'OnboardingAgent',
          maxTokens: 512,
          temperature: 0.4,
        },
      );

      const raw = response.content?.trim() ?? '';

      // Parse JSON response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          assistantContent = parsed.nextMessage ?? '';
          extractedFields = parsed.extractedFields ?? {};
          completionScore = parsed.completionScore ?? 0;
          isComplete = parsed.isComplete ?? false;
        } catch {
          // fallback: treat entire response as the message
          assistantContent = raw;
        }
      } else {
        assistantContent = raw;
      }
    } catch (err: any) {
      this.logger.error(`chatSync LLM call failed: ${err.message}`);
      // Graceful fallback messages
      const fallbacks: Record<string, string> = {
        GREETING: "Hi! I'm your Compliance Copilot. I'll help you get set up for your SOC 2 or compliance journey. To get started — what's your company name and what do you do?",
        COMPANY_BASICS: "Could you tell me a bit more about your company — how many employees do you have, and what industry are you in?",
        TECH_STACK: "What cloud providers or infrastructure does your company use? (e.g. AWS, GCP, Azure)",
        COMPLIANCE_GOALS: "What compliance framework are you targeting — SOC 2, ISO 27001, HIPAA, or something else?",
      };
      const state = (session as any).currentState ?? 'GREETING';
      assistantContent = fallbacks[state] ?? "Thanks for that! Can you tell me more about your compliance goals?";
    }

    // 7. Save assistant message
    const newTurnIndex = userMessage?.trim() ? turnIndex + 1 : turnIndex;
    await this.prisma.onboardingMessage.create({
      data: {
        sessionId,
        turnIndex: newTurnIndex,
        role: 'assistant',
        content: assistantContent,
        extractedFields: extractedFields as any,
        stateAtTime: (session as any).currentState ?? 'GREETING',
      },
    });

    // 8. Merge extracted data + update session
    const mergedData = { ...extractedSoFar };
    for (const [k, v] of Object.entries(extractedFields)) {
      if (v !== null && v !== undefined && v !== '') mergedData[k] = v;
    }

    const finalStatus = isComplete ? 'completed' : 'in_progress';
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        extractedData: mergedData as any,
        turnCount: { increment: userMessage?.trim() ? 2 : 1 },
        status: finalStatus as any,
        completedAt: isComplete ? new Date() : undefined,
      },
    });

    return {
      message: assistantContent,
      extractedFields,
      completionScore,
      isComplete,
    };
  }

  async getSessionStatus(orgId: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId },
      orderBy: { startedAt: 'desc' },
      include: {
        messages: { orderBy: { turnIndex: 'asc' } },
      },
    });

    if (!session) return { hasSession: false };

    const profile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
      select: { isComplete: true, industry: true, companyType: true, riskProfile: true },
    });

    return {
      hasSession: true,
      status: session.status,
      currentState: session.currentState,
      turnCount: session.turnCount,
      completionScore: 0, // base; overridden client-side from extractedData
      isComplete: session.status === 'completed',
      hasBusinessProfile: profile?.isComplete ?? false,
      extractedData: (session.extractedData as Record<string, unknown>) ?? {},
      messages: session.messages,
    };
  }

  async getBusinessProfile(orgId: string) {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
    });
    if (!profile) throw new NotFoundException('Business profile not found. Complete onboarding first.');
    return profile;
  }

  async updateBusinessProfile(orgId: string, userId: string, updates: Record<string, unknown>) {
    const existing = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!existing) throw new NotFoundException('Business profile not found');

    await this.prisma.profileChangeLog.create({
      data: {
        orgId,
        changedBy: userId,
        previousProfile: existing as any,
        newProfile: { ...existing, ...updates } as any,
        changeReason: 'manual_update',
      },
    });

    return this.prisma.businessProfile.update({
      where: { orgId },
      data: {
        ...updates,
        version: { increment: 1 },
      } as any,
    });
  }

  async getProfileVersions(orgId: string) {
    return this.prisma.businessProfileVersion.findMany({
      where: { orgId },
      include: { changedBy: { select: { fullName: true, email: true } } },
      orderBy: { version: 'desc' },
    });
  }

  async rollbackProfile(orgId: string, changedById: string, targetVersion: number): Promise<void> {
    const versionRecord = await this.prisma.businessProfileVersion.findUnique({
      where: { orgId_version: { orgId, version: targetVersion } },
    });
    if (!versionRecord) throw new NotFoundException(`Version ${targetVersion} not found`);

    // Save current before rollback
    const current = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (current) {
      const latest = await this.prisma.businessProfileVersion.findFirst({
        where: { orgId }, orderBy: { version: 'desc' },
      });
      await this.prisma.businessProfileVersion.create({
        data: {
          orgId,
          version: (latest?.version ?? 0) + 1,
          snapshot: current as any,
          changedById,
          changeReason: `Pre-rollback snapshot before restoring v${targetVersion}`,
          diff: {},
        },
      });
    }

    const snap = versionRecord.snapshot as Record<string, unknown>;
    await this.prisma.businessProfile.update({
      where: { orgId },
      data: {
        companyName: snap.companyName as string,
        companyType: snap.companyType as any,
        industry: snap.industry as any,
        employeeCount: snap.employeeCount as string,
        infrastructure: snap.infrastructure as any,
        tools: snap.tools as any,
        dataHandling: snap.dataHandling as any,
        currentPosture: snap.currentPosture as any,
        complianceGoals: snap.complianceGoals as any,
        riskProfile: snap.riskProfile as any,
      },
    });
  }

  /**
   * Returns current completeness score (0–100) and the list of missing required fields.
   * Uses the DialogueManagerService as the single source of truth.
   */
  async getCompleteness(orgId: string) {
    const status = await this.dialogueManager.getCompletionStatus(orgId);
    return {
      completionPct: status.completionPct,
      completionScore: status.completionPct / 100,
      isComplete: status.isComplete,
      missingFields: status.missingFields,
      canFinalize: (status.completionPct / 100) >= FINALIZE_COMPLETENESS_THRESHOLD,
      finalizeThreshold: FINALIZE_COMPLETENESS_THRESHOLD,
    };
  }

  /**
   * Finalize onboarding — marks the profile complete and triggers the inference pipeline.
   * Blocked if completeness_score < FINALIZE_COMPLETENESS_THRESHOLD (0.85).
   */
  async finalizeOnboarding(orgId: string, userId: string): Promise<{ workflowId: string; journeyId: string }> {
    // Gate: completeness check
    const completeness = await this.getCompleteness(orgId);
    if (!completeness.canFinalize) {
      throw new BadRequestException(
        `Cannot finalize onboarding — completeness score ${completeness.completionPct}% is below the required ${Math.round(FINALIZE_COMPLETENESS_THRESHOLD * 100)}%. ` +
        `Missing required fields: ${completeness.missingFields.join(', ')}`,
      );
    }

    // Ensure the business profile is marked complete
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      throw new NotFoundException('Business profile not found — complete the onboarding chat first');
    }

    if (!profile.isComplete) {
      await this.prisma.businessProfile.update({
        where: { orgId },
        data: { isComplete: true, completedAt: new Date() },
      });
    }

    // Mark session as completed
    await this.prisma.onboardingSession.updateMany({
      where: { orgId, status: 'in_progress' },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Create a workflow + trigger inference pipeline
    const workflow = await this.prisma.workflow.create({
      data: {
        orgId,
        name: `Compliance Assessment — ${new Date().toLocaleDateString()}`,
        type: 'full_assessment',
        status: 'running',
        inputPayload: { orgId, triggeredBy: 'onboarding_finalize' } as any,
        triggeredBy: userId,
        startedAt: new Date(),
      },
    });

    const journey = await this.prisma.complianceJourney.create({
      data: {
        orgId,
        workflowId: workflow.id,
        status: 'active',
        currentStage: 'planning',
      },
    });

    // Fire inference agent (first pipeline stage)
    await this.onboardingQueue.add(
      'run',
      {
        workflowId: workflow.id,
        journeyId: journey.id,
        orgId,
        businessProfile: profile as any,
        inputPayload: { onboardingVersion: profile.version ?? 1, triggeredBy: 'onboarding_finalize' },
      },
      { ...DEFAULT_JOB_OPTIONS, priority: 1 },
    );

    this.logger.log(`Onboarding finalized: org=${orgId} workflow=${workflow.id}`);
    return { workflowId: workflow.id, journeyId: journey.id };
  }

  private async enqueueMessage(sessionId: string, orgId: string, userMessage: string | null, userId: string) {
    return this.onboardingQueue.add(
      'run',
      {
        workflowId: sessionId, // Reuse sessionId as workflowId for observability
        orgId,
        businessProfile: {} as any, // Not needed for onboarding
        inputPayload: { sessionId, userMessage },
      },
      { ...DEFAULT_JOB_OPTIONS, priority: 1 },
    );
  }
}
