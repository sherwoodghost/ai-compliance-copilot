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
const ONBOARDING_SYSTEM_PROMPT = `You are the Compliance Copilot — an expert GRC onboarding assistant. You collect information about a company to build their compliance profile through friendly, natural conversation. You ask exactly ONE question per turn.

━━━ CONVERSATION SO FAR ━━━
{{conversationHistory}}

━━━ PROFILE DATA ALREADY COLLECTED ━━━
{{existingProfile}}

━━━ USER'S LATEST MESSAGE ━━━
{{userMessage}}

━━━ THE 9 FIELDS YOU MUST COLLECT (priority order) ━━━
1. companyName       — the company's name (e.g. "Acme Corp", "RASTEC"). ONLY extract an actual company name — never a description like "we're a startup" or "it's a tech company"
2. companyType       — exactly one of: startup, smb, enterprise, nonprofit, government
3. industry          — exactly one of: saas, fintech, healthcare, ecommerce, edtech, legal, manufacturing, logistics, real_estate, media, other
4. employeeCount     — exactly one of: 1-10, 11-50, 51-200, 201-1000, 1000+
5. cloudProviders    — array of any: aws, gcp, azure, self-hosted, on-premise
6. dataTypes         — array of any: pii, phi, pci, ip, public
7. targetFrameworks  — array of any: SOC2, ISO27001, HIPAA, GDPR, PCI-DSS
8. complianceDriver  — exactly one of: customer_requirement, investor, internal, regulatory
9. targetDate        — ISO date string like "2025-12-01" — only if the user mentions a target date, otherwise omit

━━━ EXTRACTION RULES ━━━
- Extract ALL information from the user's message, even if they answer multiple fields at once
- "we use Amazon" → cloudProviders: ["aws"] | "Google Cloud" → ["gcp"] | "Microsoft Azure" → ["azure"]
- "we handle client data and payments" → dataTypes: ["pii", "pci"]
- "SOC 2" or "soc2" or "SOC2" → targetFrameworks: ["SOC2"]
- "building trust with customers" or "customers require it" → complianceDriver: "customer_requirement"
- "real estate company" or "property" → industry: "real_estate"
- "startup" or "early stage" → companyType: "startup" | "small company" or "SMB" → companyType: "smb"
- Never infer companyName from a description. If user says "it's a real estate company", that's industry info, NOT the company name
- If user says "I'm RASTEC" or "Company is RASTEC" or just "RASTEC", extract companyName: "RASTEC"

━━━ CONVERSATION STYLE ━━━
- NEVER greet the company name as if it's a person. Don't say "Nice to meet you, RASTEC!" — the company name is not a person. Instead say "Great, thanks! So RASTEC is..." or "Perfect, we'll set up RASTEC's compliance profile."
- Look at PROFILE DATA ALREADY COLLECTED — never ask about fields that already have values
- Look at CONVERSATION SO FAR — never repeat a question you or the user already covered
- Acknowledge what the user said naturally, then ask the next missing field
- Keep replies to 2–3 sentences max. Be warm and professional
- Vary your acknowledgements — don't start every message with "Great!" or "Perfect!"
- If they give you multiple answers in one message, extract all of them and ask only one follow-up
- If this is the first turn (no conversation history), greet warmly and ask for the company name

━━━ COMPLETENESS ━━━
- completionScore = (number of collected fields / 9) × 100, rounded to nearest integer
- isComplete = true when completionScore ≥ 89 (8 or more of the 9 fields collected)
- When isComplete is true, write a brief upbeat summary of the collected profile and tell them they're ready to start

━━━ OUTPUT — RETURN ONLY VALID JSON, NOTHING ELSE ━━━
{
  "nextMessage": "<2-3 sentence reply: acknowledge answer + ask ONE question for next missing field>",
  "extractedFields": { "<fieldName>": <value> },
  "completionScore": <integer 0–100>,
  "isComplete": <true or false>
}

CRITICAL: Your entire response MUST be a single valid JSON object. No text before or after it. No markdown code fences. No explanations outside the JSON.`;

// ─── Required fields for completeness gate ───────────────────────────────────
const REQUIRED_FIELDS_FOR_FINALIZE = [
  'companyName', 'companyType', 'industry', 'employeeCount',
  'cloudProviders', 'dataTypes', 'targetFrameworks', 'complianceDriver',
] as const;

// ─── Mapping helpers — extracted values → Prisma enum values ─────────────────
function toCompanyType(raw: unknown): string {
  const v = String(raw ?? '').toLowerCase().trim();
  if (['startup', 'start-up', 'early stage'].some((x) => v.includes(x))) return 'startup';
  if (['smb', 'small', 'medium', 'sme'].some((x) => v.includes(x))) return 'smb';
  if (v.includes('enterprise')) return 'enterprise';
  if (v.includes('nonprofit') || v.includes('non-profit')) return 'nonprofit';
  if (v.includes('government') || v.includes('govt')) return 'government';
  return 'smb'; // safe default
}

function toIndustry(raw: unknown): string {
  const v = String(raw ?? '').toLowerCase().trim();
  const MAP: Record<string, string> = {
    saas: 'saas', 'software as a service': 'saas',
    fintech: 'fintech', 'financial technology': 'fintech', finance: 'fintech',
    healthcare: 'healthcare', health: 'healthcare', medical: 'healthcare',
    ecommerce: 'ecommerce', 'e-commerce': 'ecommerce', retail: 'ecommerce',
    edtech: 'edtech', education: 'edtech',
    legal: 'legal', law: 'legal',
    manufacturing: 'manufacturing',
    logistics: 'logistics', supply: 'logistics',
    real_estate: 'real_estate', 'real estate': 'real_estate', property: 'real_estate', realestate: 'real_estate',
    professional_services: 'professional_services', 'professional services': 'professional_services', consulting: 'professional_services',
    media: 'media',
  };
  for (const [k, mapped] of Object.entries(MAP)) {
    if (v.includes(k)) return mapped;
  }
  return 'other';
}

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
    // 1. Ensure session exists (ignore abandoned sessions — they belong to a previous run)
    let session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: { not: 'abandoned' as any } },
      orderBy: { startedAt: 'desc' },
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
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        mergedData[k] = v;
      }
    }

    // Recompute completionScore from merged data (authoritative)
    const collectedCount = REQUIRED_FIELDS_FOR_FINALIZE.filter((f) => {
      const v = mergedData[f];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
    const actualScore = Math.round((collectedCount / REQUIRED_FIELDS_FOR_FINALIZE.length) * 100);
    const actualComplete = actualScore >= 89;

    const finalStatus = actualComplete ? 'completed' : 'in_progress';
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        extractedData: mergedData as any,
        turnCount: { increment: userMessage?.trim() ? 2 : 1 },
        status: finalStatus as any,
        completedAt: actualComplete ? new Date() : undefined,
      },
    });

    // 9. Upsert BusinessProfile so getCompleteness() / finalizeOnboarding() can read it
    await this.upsertBusinessProfile(orgId, userId, mergedData).catch((err) => {
      this.logger.warn(`BusinessProfile upsert failed (non-fatal): ${err.message}`);
    });

    return {
      message: assistantContent,
      extractedFields,
      completionScore: actualScore,
      isComplete: actualComplete,
    };
  }

  /**
   * Upsert BusinessProfile from the session's extractedData.
   * Only writes fields that have been collected; required fields get safe defaults.
   * This ensures getCompleteness() always reflects live chat progress.
   */
  private async upsertBusinessProfile(
    orgId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Only upsert if we have at least a company name
    if (!data.companyName) return;

    const companyName = String(data.companyName);
    const companyType = toCompanyType(data.companyType ?? 'smb') as any;
    const industry    = toIndustry(data.industry ?? 'other') as any;
    const employeeCount = data.employeeCount ? String(data.employeeCount) : '1-10';

    const infrastructure = {
      cloudProviders: Array.isArray(data.cloudProviders) ? data.cloudProviders : [],
    };
    const dataHandling = {
      dataTypes: Array.isArray(data.dataTypes) ? data.dataTypes : [],
    };
    const complianceGoals = {
      targetFrameworks: Array.isArray(data.targetFrameworks) ? data.targetFrameworks : [],
      complianceDriver: data.complianceDriver ?? null,
      targetDate: data.targetDate ?? null,
    };

    await this.prisma.businessProfile.upsert({
      where: { orgId },
      create: {
        orgId,
        companyName,
        companyType,
        industry,
        employeeCount,
        infrastructure: infrastructure as any,
        dataHandling: dataHandling as any,
        complianceGoals: complianceGoals as any,
        collectedVia: 'onboarding_agent' as any,
        isComplete: false,
      },
      update: {
        companyName,
        companyType,
        industry,
        employeeCount,
        infrastructure: infrastructure as any,
        dataHandling: dataHandling as any,
        complianceGoals: complianceGoals as any,
      },
    });
  }

  async getSessionStatus(orgId: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: { not: 'abandoned' as any } },
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
   * Reset the onboarding session for the org.
   * Marks all existing sessions as 'abandoned' and clears extractedData
   * so the next POST /onboarding/chat starts fresh from the greeting.
   */
  async resetSession(orgId: string): Promise<{ reset: boolean }> {
    await this.prisma.onboardingSession.updateMany({
      where: { orgId, status: { in: ['in_progress', 'completed'] } },
      data: { status: 'abandoned' as any, extractedData: {} as any },
    });
    this.logger.log(`Onboarding session reset for org=${orgId}`);
    return { reset: true };
  }

  /**
   * Returns current completeness score (0–100) from session extractedData.
   * Falls back to DialogueManager (BusinessProfile) if no session data found.
   */
  async getCompleteness(orgId: string) {
    // Primary: read from session extractedData (populated by chatSync)
    // Skip abandoned sessions — they belong to a previous/reset run
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: { not: 'abandoned' as any } },
      orderBy: { startedAt: 'desc' },
    });

    if (session?.extractedData) {
      const data = session.extractedData as Record<string, unknown>;
      const missingFields = REQUIRED_FIELDS_FOR_FINALIZE.filter((f) => {
        const v = data[f];
        if (v == null || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      });
      const collectedCount = REQUIRED_FIELDS_FOR_FINALIZE.length - missingFields.length;
      const completionPct = Math.round((collectedCount / REQUIRED_FIELDS_FOR_FINALIZE.length) * 100);
      return {
        completionPct,
        completionScore: completionPct / 100,
        isComplete: completionPct >= 89,
        missingFields: [...missingFields],
        canFinalize: completionPct >= Math.round(FINALIZE_COMPLETENESS_THRESHOLD * 100),
        finalizeThreshold: FINALIZE_COMPLETENESS_THRESHOLD,
      };
    }

    // Fallback: dialogue manager reads from BusinessProfile table
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
   * Reads completeness directly from session extractedData (not BusinessProfile)
   * to avoid the 0% bug when BusinessProfile hasn't been populated yet.
   *
   * The pipeline kick-off (workflow / journey / queue) is best-effort and NON-FATAL.
   * The user always gets redirected to the dashboard — a background failure cannot
   * block them from accessing their compliance workspace.
   */
  async finalizeOnboarding(orgId: string, userId: string): Promise<{ workflowId: string; journeyId: string }> {
    // ── Step 1: Completeness gate ──────────────────────────────────────────────
    const completeness = await this.getCompleteness(orgId);
    if (!completeness.canFinalize) {
      throw new BadRequestException(
        `Cannot finalize onboarding — completeness score ${completeness.completionPct}% is below the required ${Math.round(FINALIZE_COMPLETENESS_THRESHOLD * 100)}%. ` +
        `Missing required fields: ${completeness.missingFields.join(', ')}`,
      );
    }

    // ── Step 2: Ensure BusinessProfile exists and is marked complete ───────────
    let profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) {
      // Last resort: build from session extractedData
      const session = await this.prisma.onboardingSession.findFirst({
        where: { orgId }, orderBy: { startedAt: 'desc' },
      });
      const data = (session?.extractedData as Record<string, unknown>) ?? {};
      // Non-fatal: if upsert fails (e.g. enum mismatch), we continue anyway
      await this.upsertBusinessProfile(orgId, userId, data).catch((err) => {
        this.logger.warn(`finalizeOnboarding: BusinessProfile upsert failed (non-fatal): ${err.message}`);
      });
      profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    }

    // If still null after upsert attempt, create a minimal placeholder so the user
    // can access the dashboard. Compliance assessment will fill in details later.
    if (!profile) {
      this.logger.warn(`finalizeOnboarding: creating minimal BusinessProfile placeholder for org=${orgId}`);
      try {
        profile = await this.prisma.businessProfile.create({
          data: {
            orgId,
            companyName: 'My Company',
            companyType: 'startup' as any,
            industry: 'other' as any,
            employeeCount: '1-10',
            infrastructure: {} as any,
            dataHandling: {} as any,
            complianceGoals: {} as any,
            collectedVia: 'onboarding_agent' as any,
            isComplete: true,
            completedAt: new Date(),
          },
        });
      } catch (createErr: any) {
        this.logger.error(`finalizeOnboarding: could not create placeholder BusinessProfile: ${createErr.message}`);
        // Don't throw — continue so user can reach dashboard
      }
    }

    if (profile && !profile.isComplete) {
      await this.prisma.businessProfile.update({
        where: { orgId },
        data: { isComplete: true, completedAt: new Date() },
      }).catch(() => {/* non-fatal */});
    }

    // ── Step 3: Mark all in-progress sessions as completed ─────────────────────
    await this.prisma.onboardingSession.updateMany({
      where: { orgId, status: 'in_progress' },
      data: { status: 'completed', completedAt: new Date() },
    }).catch(() => {/* non-fatal */});

    // ── Step 4: Kick off inference pipeline (best-effort, non-fatal) ──────────
    let workflowId = 'pending';
    let journeyId = 'pending';

    try {
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

      workflowId = workflow.id;
      journeyId = journey.id;

      // Fire inference agent (first pipeline stage)
      await this.onboardingQueue.add(
        'run',
        {
          workflowId: workflow.id,
          journeyId: journey.id,
          orgId,
          businessProfile: profile as any,
          inputPayload: { onboardingVersion: (profile as any)?.version ?? 1, triggeredBy: 'onboarding_finalize' },
        },
        { ...DEFAULT_JOB_OPTIONS, priority: 1 },
      );

      this.logger.log(`Onboarding finalized + pipeline started: org=${orgId} workflow=${workflowId}`);
    } catch (pipelineErr: any) {
      // Pipeline failure is NON-FATAL — user still gets to the dashboard.
      // Operators can re-trigger from the Workflows page.
      this.logger.error(
        `finalizeOnboarding: pipeline kick-off failed (non-fatal) for org=${orgId}: ${pipelineErr.message}`,
        pipelineErr.stack,
      );
    }

    return { workflowId, journeyId };
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
