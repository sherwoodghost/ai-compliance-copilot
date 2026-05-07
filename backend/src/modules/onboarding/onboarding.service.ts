import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '../../orchestrator/queue.config';
import { DialogueManagerService } from '../../agents/onboarding/dialogue-manager.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

/** Minimum completeness fraction (0–1) required to allow finalize */
const FINALIZE_COMPLETENESS_THRESHOLD = 0.85;

// ─── System prompt for the synchronous onboarding chat ───────────────────────
// This prompt is injected directly into the LLM — it bypasses the template
// registry. Placeholders are replaced at runtime in chatSync().
const ONBOARDING_SYSTEM_PROMPT = `You are the Compliance Copilot — an expert GRC onboarding assistant. Your job is to collect 9 specific fields about the user's company through friendly, natural conversation. You ask exactly ONE question per turn.

━━━ CONVERSATION SO FAR ━━━
{{conversationHistory}}

━━━ PROFILE DATA ALREADY COLLECTED ━━━
{{existingProfile}}

━━━ USER'S LATEST MESSAGE ━━━
{{userMessage}}

━━━ THE 9 FIELDS YOU MUST COLLECT (in priority order) ━━━
1. companyName       — the company's legal or trading name
2. companyType       — one of: startup, smb, enterprise, nonprofit
3. industry          — one of: saas, fintech, healthcare, ecommerce, real_estate, professional_services, other
4. employeeCount     — one of: 1-10, 11-50, 51-200, 201-1000, 1000+
5. cloudProviders    — array, any of: aws, gcp, azure, self-hosted, on-premise
6. dataTypes         — array, any of: pii, phi, pci, ip, public
7. targetFrameworks  — array, any of: SOC2, ISO27001, HIPAA, GDPR, PCI-DSS
8. complianceDriver  — one of: customer_requirement, investor, internal, regulatory
9. targetDate        — optional ISO date string (e.g. "2025-12-01") — skip if not mentioned

━━━ HOW TO BEHAVE ━━━
- Look at PROFILE DATA ALREADY COLLECTED. Never ask about a field that already has a value.
- Look at CONVERSATION SO FAR to understand what was discussed. Never repeat a question.
- Acknowledge the user's latest message warmly before asking the next question.
- Extract data from casual language (e.g. "we use Amazon cloud" → cloudProviders: ["aws"]).
- Ask ONE question at a time — always the first missing field in priority order.
- Keep messages short: 1–3 sentences. Be warm, professional, encouraging.
- If the user's message contains multiple pieces of information, extract all of them but still ask only ONE follow-up question.
- If this is the very first message (no conversation history), greet the user and ask for their company name.
- Do NOT say things like "Great!", "Awesome!", "Perfect!" on every turn — vary your acknowledgements.

━━━ COMPLETION ━━━
- completionScore = count of collected fields out of 9, multiplied by 100/9 (round to integer)
- isComplete = true when completionScore >= 85 (i.e. at least 8 of 9 fields collected)
- When isComplete becomes true, provide a brief summary of what you collected and congratulate them.

━━━ OUTPUT — RETURN ONLY THIS EXACT JSON, NOTHING ELSE ━━━
{
  "nextMessage": "<your warm conversational reply, acknowledging their answer + ONE question>",
  "extractedFields": { "<fieldName>": "<value>" },
  "completionScore": <integer 0-100>,
  "isComplete": <true|false>
}

CRITICAL: Your entire response must be valid JSON matching the schema above. Do not add any text before or after the JSON. Do not wrap it in markdown code blocks.`;

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

    // 3. Build conversation history string (all turns BEFORE this one)
    const historyLines = existingMessages.length > 0
      ? existingMessages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')
      : '(this is the very start of the conversation — no messages yet)';

    // 4. Get extracted profile so far
    const extractedSoFar = (session as any).extractedData as Record<string, unknown> ?? {};
    const profileSummary = Object.keys(extractedSoFar).length > 0
      ? JSON.stringify(extractedSoFar, null, 2)
      : '(nothing collected yet)';

    // 5. Build the current user turn context
    const currentUserMessage = userMessage?.trim()
      || '(no user message — this is the opening greeting, introduce yourself and ask for the company name)';

    // 6. Inject context into system prompt
    const systemPrompt = ONBOARDING_SYSTEM_PROMPT
      .replace('{{conversationHistory}}', historyLines)
      .replace('{{existingProfile}}', profileSummary)
      .replace('{{userMessage}}', currentUserMessage);

    // 7. Call LLM
    let assistantContent = '';
    let extractedFields: Record<string, unknown> = {};
    let completionScore = 0;
    let isComplete = false;

    // The user message sent to the LLM (brief — the full context is in the system prompt)
    const llmUserMessage = userMessage?.trim()
      || 'Please start the onboarding. Greet the user and ask for their company name.';

    try {
      const response = await this.gateway.callRaw(
        systemPrompt,
        llmUserMessage,
        {
          taskType: 'onboarding',
          orgId,
          agentName: 'OnboardingAgent',
          maxTokens: 600,
          temperature: 0.5,
        },
      );

      const raw = response.content?.trim() ?? '';
      this.logger.debug(`chatSync raw LLM response: ${raw.slice(0, 200)}`);

      // Strip markdown code fences if the model wrapped the JSON
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      // Extract the outermost JSON object
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          assistantContent = (parsed.nextMessage ?? '').trim();
          extractedFields = parsed.extractedFields ?? {};
          completionScore = typeof parsed.completionScore === 'number' ? parsed.completionScore : 0;
          isComplete = parsed.isComplete === true;
        } catch (parseErr: any) {
          this.logger.warn(`chatSync JSON parse failed: ${parseErr.message} — raw: ${raw.slice(0, 300)}`);
          assistantContent = cleaned; // fallback: show raw text
        }
      } else {
        // Model returned plain text instead of JSON — use it as-is
        assistantContent = cleaned;
      }

      // Safety: if nextMessage is empty but we got JSON, provide a generic prompt
      if (!assistantContent) {
        assistantContent = "Thanks for that! What else can you tell me about your compliance goals?";
      }

    } catch (err: any) {
      this.logger.error(`chatSync LLM call failed: ${err.message}`, err.stack);
      // Context-aware fallback based on what's already been collected
      const collected = Object.keys(extractedSoFar);
      if (!collected.includes('companyName')) {
        assistantContent = "Hi! I'm your Compliance Copilot 👋 I'll help you build your compliance profile. What's your company name?";
      } else if (!collected.includes('industry')) {
        assistantContent = `Great, ${extractedSoFar.companyName}! What industry are you in? (e.g. SaaS, FinTech, Healthcare)`;
      } else if (!collected.includes('employeeCount')) {
        assistantContent = "How many employees does your company have?";
      } else if (!collected.includes('cloudProviders')) {
        assistantContent = "What cloud infrastructure do you use? (e.g. AWS, GCP, Azure, self-hosted)";
      } else if (!collected.includes('targetFrameworks')) {
        assistantContent = "Which compliance framework are you targeting? (SOC 2, ISO 27001, HIPAA, GDPR…)";
      } else {
        assistantContent = "Thanks for that! What's driving your compliance initiative — is it a customer requirement, investor due diligence, or something else?";
      }
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
