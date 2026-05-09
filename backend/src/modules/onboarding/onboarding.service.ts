import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from '../../orchestrator/queue.config';
import { DialogueManagerService } from '../../agents/onboarding/dialogue-manager.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { TasksService } from '../tasks/tasks.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string }>;
import mammoth = require('mammoth');

/** Minimum completeness fraction (0–1) required to allow finalize */
const FINALIZE_COMPLETENESS_THRESHOLD = 0.85;

// ─── Enterprise Compliance Infrastructure Discovery Engine ────────────────────
const ONBOARDING_SYSTEM_PROMPT = `You are the Compliance Copilot — an elite GRC advisor running a Compliance Infrastructure Discovery session. You think like a Big 4 auditor combined with a CISO: analytical, insightful, and you spot compliance risks that most companies miss until an auditor does. You ask ONE intelligent question per turn and extract maximum context from every answer.

This is NOT a form — it's a strategic compliance discovery interview to build a complete Compliance Digital Twin.

━━━ CONTEXT ━━━
Conversation so far:
{{conversationHistory}}

Profile collected so far:
{{existingProfile}}

User's latest message:
{{userMessage}}

━━━ 7-PHASE DISCOVERY ENGINE (complete each phase before advancing) ━━━

PHASE 1 — FOUNDATION
Fields: companyName [actual company name, never a description], companyType [startup|smb|enterprise|nonprofit|government], industry [saas|fintech|healthcare|ecommerce|edtech|legal|manufacturing|logistics|real_estate|media|professional_services|other], employeeCount [1-10|11-50|51-200|201-1000|1000+], regions [array: US|EU|APAC|UK|Canada|Global], workforceModel [fully_remote|hybrid|on_premise|distributed_global]
→ Add industry insight when foundation is complete: "For a [size] [industry] company, [specific compliance implication]."

PHASE 2 — COMPLIANCE GOALS
Fields: targetFrameworks [array: SOC2|SOC2_TYPE1|SOC2_TYPE2|ISO27001|HIPAA|GDPR|PCI-DSS|NIST|CCPA|FedRAMP], auditType [type1|type2|certification|gap_assessment|renewal], targetDate [ISO date if mentioned], complianceDriver [customer_requirement|investor|regulatory|internal|ipo_prep|m_and_a|government_contract], existingCertifications [array of any certs already held]
→ Connect driver to urgency: "Customer requirement + enterprise sales = you need Type 1 within 3-4 months."

PHASE 3 — INFRASTRUCTURE
Fields: cloudProviders [array: aws|gcp|azure|self-hosted|on-premise|multi-cloud], keyDatabases [array: postgres|mysql|mongodb|dynamodb|firestore|snowflake|redis|other], cicdTools [array: github_actions|jenkins|gitlab_ci|circleci|buildkite|other], sourceControl [github|gitlab|bitbucket|azure_devops|other], saasTools [array: slack|jira|notion|salesforce|okta|google_workspace|microsoft_365|pagerduty|datadog|github|crowdstrike|other], internetFacing [boolean]
→ Quantify automation: "With [their tools], we can automate ~X SOC 2 controls without manual evidence collection."

PHASE 4 — SECURITY OPERATIONS
Fields: mfaStatus [none|partial|all_users|all_users_phishing_resistant], identityProvider [okta|azure_ad|google|jumpcloud|active_directory|none|other], loggingMaturity [none|basic|centralized|siem_integrated], siemTool [splunk|sumo_logic|datadog|elastic|sentinel|none|other], endpointManagement [none|basic|mdm|edr|full_edr], vulnerabilityScanning [none|manual|automated_basic|automated_continuous], patchManagement [manual|scheduled|automated|realtime], incidentResponsePlan [none|informal|documented|tested], backupStatus [none|basic|tested|automated_tested]
→ Flag gaps immediately: "No MFA on admin accounts is the #1 finding in SOC 2 audits — critical to remediate before your assessment window."

PHASE 5 — DATA & PRIVACY
Fields: dataTypes [array: pii|phi|pci|financial|ip|confidential|public], gdprExposure [none|minimal|moderate|significant], ccpaExposure [none|minimal|significant], hipaaScope [none|covered_entity|business_associate], dataRetentionPolicy [none|informal|documented|automated], subprocessorCount [0|1-5|6-20|20+], crossBorderTransfers [boolean]
→ Surface regulatory implications: "EU users + US-hosted infrastructure = you need Standard Contractual Clauses in place — commonly missed until GDPR auditors ask."

PHASE 6 — OWNERSHIP & GOVERNANCE
Fields: ownerAccess [name or role], ownerInfrastructure [name or role], ownerIncidentResponse [name or role], ownerCompliance [name or role], ownerPolicies [name or role], ownerVendors [name or role], teamStructure [has_dedicated_security|security_hat|no_security|outsourced_mssp]
→ If no dedicated security: flag ownership gaps as risks; auditors look for explicit DRI per control category.

PHASE 7 — AUDIT READINESS
Fields: documentationMaturity [none|scattered|partial|documented|automated], accessReviewCadence [none|ad_hoc|quarterly|monthly|continuous], vendorReviewCadence [none|ad_hoc|annual|semi_annual|quarterly], existingGRCTooling [none|spreadsheets|drata|vanta|secureframe|tugboat|other|this_platform]

━━━ EXTRACTION INTELLIGENCE ━━━
- Extract ALL fields from each answer, even ones not directly asked
- "we use Okta" → identityProvider: "okta" AND add "okta" to saasTools
- "AWS and some on-prem" → cloudProviders: ["aws", "on-premise"]
- "about 80 people" → employeeCount: "51-200"
- "SOC 2 Type 2" → targetFrameworks: ["SOC2_TYPE2"], auditType: "type2"
- "customers are asking for it" → complianceDriver: "customer_requirement"
- "we're based in the EU but sell globally" → regions: ["EU", "Global"]
- "no SSO yet" → identityProvider: "none", likely mfaStatus: "partial" or "none"
- Never infer companyName from a description — only extract explicit company names

━━━ RISK OBSERVATION RULES ━━━
Generate riskObservations in real time. Include ALL risks you detect, not just new ones this turn.
- HIGH severity: mfaStatus="none", incidentResponsePlan="none", backupStatus="none", loggingMaturity="none", significant GDPR exposure without policy
- MEDIUM severity: mfaStatus="partial", patchManagement="manual", vendorReviewCadence="none" or "ad_hoc", missing ownership roles, no retention policy
- LOW severity: documentationMaturity="none" or "scattered", accessReviewCadence="none" or "ad_hoc", no GRC tooling

━━━ INTEGRATION INTELLIGENCE ━━━
When tools are mentioned, generate integrationRecommendations. Accumulate across turns.
- aws → { tool: "AWS", reason: "CloudTrail + GuardDuty + IAM Access Analyzer cover infrastructure logging, threat detection, and access management", priority: "high", automatesControls: 52 }
- okta → { tool: "Okta", reason: "Access provisioning audit trail, MFA enforcement, user lifecycle management, SSO evidence", priority: "high", automatesControls: 47 }
- github → { tool: "GitHub", reason: "Code change management, branch protection rules, access controls, CI/CD audit trail", priority: "high", automatesControls: 23 }
- datadog → { tool: "Datadog", reason: "Infrastructure monitoring, log management, alerting, availability metrics", priority: "medium", automatesControls: 31 }
- google_workspace → { tool: "Google Workspace", reason: "Email retention, access policies, admin audit logs, DLP controls", priority: "medium", automatesControls: 18 }
- microsoft_365 → { tool: "Microsoft 365", reason: "Conditional access, DLP, email retention, compliance center", priority: "medium", automatesControls: 22 }
- crowdstrike → { tool: "CrowdStrike", reason: "EDR, threat detection, endpoint compliance monitoring", priority: "high", automatesControls: 28 }
- pagerduty → { tool: "PagerDuty", reason: "Incident management records, on-call documentation, response evidence", priority: "medium", automatesControls: 12 }

━━━ CONVERSATION INTELLIGENCE ━━━
1. Never ask about fields already in the profile — check PROFILE COLLECTED SO FAR every turn
2. Never repeat a question from conversation history
3. Use peer benchmarks: "Most Series B SaaS companies at 100 employees already have..."
4. When isComplete becomes true: write a compelling summary of what you discovered and the key next steps, mentioning the automation potential from their stack
5. Keep replies to 2-3 sentences — intelligence is in WHAT you ask, not how much you say
6. First turn (no history): greet warmly, explain what you'll discover together, ask for company name
7. Adapt language: executives get business implications, engineers get technical precision

━━━ REQUIRED FIELDS (must collect 8 of 9 to enable finalization) ━━━
companyName, companyType, industry, employeeCount (Phase 1)
targetFrameworks, complianceDriver (Phase 2)
cloudProviders (Phase 3)
mfaStatus (Phase 4)
dataTypes (Phase 5)

Enrichment fields (improve profile depth — not required for finalization):
regions, workforceModel, auditType, targetDate, existingCertifications, keyDatabases, cicdTools, sourceControl, saasTools, internetFacing, identityProvider, loggingMaturity, siemTool, endpointManagement, vulnerabilityScanning, patchManagement, incidentResponsePlan, backupStatus, gdprExposure, ccpaExposure, hipaaScope, dataRetentionPolicy, subprocessorCount, crossBorderTransfers, ownerAccess, ownerInfrastructure, ownerIncidentResponse, ownerCompliance, ownerPolicies, ownerVendors, teamStructure, documentationMaturity, accessReviewCadence, vendorReviewCadence, existingGRCTooling

━━━ COMPLETENESS SCORING ━━━
requiredCollected = count of required fields with values
enrichmentCollected = count of enrichment fields with values
completionScore = min(100, round((requiredCollected / 9 × 70) + (enrichmentCollected / 35 × 30)))
isComplete = requiredCollected >= 8

phaseCompletion = percent of fields collected per phase (0-100 each)

━━━ OUTPUT — RETURN ONLY VALID JSON ━━━
{
  "nextMessage": "<2-3 sentence intelligent reply: acknowledge + add insight/risk if relevant + ask ONE question for next uncollected field>",
  "currentPhase": "<foundation|compliance_goals|infrastructure|security_ops|data_privacy|ownership|readiness>",
  "extractedFields": { "<fieldName>": <value> },
  "riskObservations": [{ "area": "<security area>", "severity": "<high|medium|low>", "observation": "<specific actionable finding>" }],
  "integrationRecommendations": [{ "tool": "<tool name>", "reason": "<why valuable for their compliance>", "priority": "<high|medium|low>", "automatesControls": <number> }],
  "phaseCompletion": { "foundation": <0-100>, "compliance_goals": <0-100>, "infrastructure": <0-100>, "security_ops": <0-100>, "data_privacy": <0-100>, "ownership": <0-100>, "readiness": <0-100> },
  "completionScore": <0-100>,
  "isComplete": <true|false>
}

CRITICAL: Your entire response MUST be a single valid JSON object. No text before or after it. No markdown code fences.`;

// ─── Required fields for the finalize completeness gate ──────────────────────
const REQUIRED_FIELDS_FOR_FINALIZE = [
  'companyName', 'companyType', 'industry', 'employeeCount',
  'targetFrameworks', 'complianceDriver',
  'cloudProviders', 'mfaStatus', 'dataTypes',
] as const;

// ─── Enrichment fields (bonus completeness points, not required) ──────────────
const ENRICHMENT_FIELDS = [
  'regions', 'workforceModel', 'auditType', 'targetDate', 'existingCertifications',
  'keyDatabases', 'cicdTools', 'sourceControl', 'saasTools', 'internetFacing',
  'identityProvider', 'loggingMaturity', 'siemTool', 'endpointManagement',
  'vulnerabilityScanning', 'patchManagement', 'incidentResponsePlan', 'backupStatus',
  'gdprExposure', 'ccpaExposure', 'hipaaScope', 'dataRetentionPolicy',
  'subprocessorCount', 'crossBorderTransfers',
  'ownerAccess', 'ownerInfrastructure', 'ownerIncidentResponse', 'ownerCompliance',
  'ownerPolicies', 'ownerVendors', 'teamStructure',
  'documentationMaturity', 'accessReviewCadence', 'vendorReviewCadence', 'existingGRCTooling',
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
    private readonly tasksService: TasksService,
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
  async chatSync(orgId: string, userId: string, userMessage: string | null, file?: Express.Multer.File) {
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
    // Limit history to last 20 messages to avoid context overflow with long conversations
    const allMessages: { role: string; content: string }[] = (session as any).messages ?? [];
    const existingMessages = allMessages.slice(-20);
    const turnIndex = allMessages.length;

    // 2. Save user message
    if (userMessage?.trim()) {
      await this.prisma.onboardingMessage.create({
        data: {
          sessionId,
          turnIndex,
          role: 'user',
          content: userMessage.trim(),
          extractedFields: {} as any,
          stateAtTime: (session as any).currentState ?? 'FOUNDATION',
        },
      });
    }

    // 3. Build conversation history string (last 20 turns BEFORE this one)
    const historyLines = existingMessages.length > 0
      ? existingMessages
          .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
          .join('\n')
      : '(this is the very start of the conversation — no messages yet)';

    // 4. Get extracted profile so far (omit internal meta keys when sending to LLM)
    const extractedSoFar = (session as any).extractedData as Record<string, unknown> ?? {};
    const profileForLLM: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(extractedSoFar)) {
      if (!k.startsWith('_')) profileForLLM[k] = v;
    }
    const profileSummary = Object.keys(profileForLLM).length > 0
      ? JSON.stringify(profileForLLM)
      : '(nothing collected yet)';

    // 5. Build the current user turn context
    // Process file attachment if present
    let fileContext = '';
    if (file) {
      const extractedText = await this.processAttachment(file);
      if (!extractedText.startsWith('[IMAGE:')) {
        fileContext = `\n\n[ATTACHED DOCUMENT: ${file.originalname}]\n${extractedText}\n[END DOCUMENT]`;
      }
    }

    const currentUserMessage = userMessage?.trim()
      ? `${userMessage.trim()}${fileContext}`
      : '(no user message — this is the opening greeting, introduce yourself and explain the discovery process, then ask for the company name)';

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
    let currentPhase = 'foundation';
    let riskObservations: Array<{ area: string; severity: string; observation: string }> = [];
    let integrationRecommendations: Array<{ tool: string; reason: string; priority: string; automatesControls: number }> = [];
    let phaseCompletion: Record<string, number> = {};

    const llmUserMessage = userMessage?.trim()
      || 'Please begin the compliance discovery session. Greet the user, briefly explain what you will discover together, and ask for their company name.';

    try {
      const response = await this.gateway.callRaw(
        systemPrompt,
        llmUserMessage,
        {
          taskType: 'onboarding',
          orgId,
          agentName: 'OnboardingAgent',
          maxTokens: 1400,
          temperature: 0.4,
        },
      );

      const raw = response.content?.trim() ?? '';
      this.logger.debug(`chatSync raw LLM response: ${raw.slice(0, 300)}`);

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
          extractedFields = typeof parsed.extractedFields === 'object' ? (parsed.extractedFields ?? {}) : {};
          completionScore = typeof parsed.completionScore === 'number' ? parsed.completionScore : 0;
          isComplete = parsed.isComplete === true;
          currentPhase = typeof parsed.currentPhase === 'string' ? parsed.currentPhase : 'foundation';
          riskObservations = Array.isArray(parsed.riskObservations) ? parsed.riskObservations : [];
          integrationRecommendations = Array.isArray(parsed.integrationRecommendations) ? parsed.integrationRecommendations : [];
          phaseCompletion = typeof parsed.phaseCompletion === 'object' && parsed.phaseCompletion ? parsed.phaseCompletion : {};
        } catch (parseErr: any) {
          this.logger.warn(`chatSync JSON parse failed: ${parseErr.message} — raw: ${raw.slice(0, 300)}`);
          assistantContent = cleaned;
        }
      } else {
        assistantContent = cleaned;
      }

      if (!assistantContent) {
        assistantContent = "Thanks for that! Let's continue building your compliance profile — what else can you tell me?";
      }

    } catch (err: any) {
      this.logger.error(`chatSync LLM call failed: ${err.message}`, err.stack);
      const collected = Object.keys(profileForLLM);
      if (!collected.includes('companyName')) {
        assistantContent = "Hi! I'm your Compliance Copilot 👋 I'll run a deep discovery session to map your entire compliance infrastructure. Let's start — what's your company name?";
      } else if (!collected.includes('industry')) {
        assistantContent = `Got it! What industry is ${profileForLLM.companyName} in? (e.g. SaaS, FinTech, Healthcare)`;
      } else if (!collected.includes('employeeCount')) {
        assistantContent = "How many employees does your company have?";
      } else if (!collected.includes('targetFrameworks')) {
        assistantContent = "Which compliance framework are you targeting? (SOC 2, ISO 27001, HIPAA, GDPR…)";
      } else if (!collected.includes('cloudProviders')) {
        assistantContent = "What cloud infrastructure do you use? (e.g. AWS, GCP, Azure)";
      } else if (!collected.includes('mfaStatus')) {
        assistantContent = "Does your team use multi-factor authentication (MFA)? Is it enforced for all users, just some, or not yet deployed?";
      } else if (!collected.includes('dataTypes')) {
        assistantContent = "What types of sensitive data does your platform handle? (e.g. personal data/PII, payment data/PCI, health data/PHI)";
      } else {
        assistantContent = "Thanks for that! What's driving your compliance initiative — customer requirement, investor due diligence, or regulatory pressure?";
      }
    }

    // 8. Save assistant message
    const newTurnIndex = userMessage?.trim() ? turnIndex + 1 : turnIndex;
    await this.prisma.onboardingMessage.create({
      data: {
        sessionId,
        turnIndex: newTurnIndex,
        role: 'assistant',
        content: assistantContent,
        extractedFields: extractedFields as any,
        stateAtTime: currentPhase.toUpperCase(),
      },
    });

    // 9. Merge extracted data
    const mergedData = { ...extractedSoFar };
    for (const [k, v] of Object.entries(extractedFields)) {
      if (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)) {
        mergedData[k] = v;
      }
    }

    // 9a. Accumulate risk observations (deduplicated by area+observation)
    const existingRisks = Array.isArray(mergedData._riskObservations) ? mergedData._riskObservations as any[] : [];
    const mergedRisks = [...existingRisks];
    for (const r of riskObservations) {
      if (r.area && r.observation && !mergedRisks.some((e) => e.area === r.area && e.observation === r.observation)) {
        mergedRisks.push(r);
      }
    }
    mergedData._riskObservations = mergedRisks;

    // 9b. Accumulate integration recommendations (deduplicated by tool)
    const existingIntegrations = Array.isArray(mergedData._integrationRecommendations) ? mergedData._integrationRecommendations as any[] : [];
    const mergedIntegrations = [...existingIntegrations];
    for (const i of integrationRecommendations) {
      if (i.tool && !mergedIntegrations.some((e) => e.tool === i.tool)) {
        mergedIntegrations.push(i);
      }
    }
    mergedData._integrationRecommendations = mergedIntegrations;

    // 9c. Store phase completion + current phase
    if (Object.keys(phaseCompletion).length > 0) {
      mergedData._phaseCompletion = phaseCompletion;
    }
    mergedData._currentPhase = currentPhase;

    // 10. Recompute completion score server-side (authoritative weighted scoring)
    const requiredCollected = REQUIRED_FIELDS_FOR_FINALIZE.filter((f) => {
      const v = mergedData[f];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
    const enrichmentCollected = ENRICHMENT_FIELDS.filter((f) => {
      const v = mergedData[f];
      if (v == null || v === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    }).length;
    const actualScore = Math.min(100, Math.round(
      (requiredCollected / REQUIRED_FIELDS_FOR_FINALIZE.length) * 70 +
      (enrichmentCollected / ENRICHMENT_FIELDS.length) * 30,
    ));
    const actualComplete = requiredCollected >= 8;

    const finalStatus = actualComplete ? 'completed' : 'in_progress';
    await this.prisma.onboardingSession.update({
      where: { id: sessionId },
      data: {
        extractedData: mergedData as any,
        turnCount: { increment: userMessage?.trim() ? 2 : 1 },
        status: finalStatus as any,
        currentState: currentPhase.toUpperCase(),
        completedAt: actualComplete ? new Date() : undefined,
      },
    });

    // 11. Upsert BusinessProfile so getCompleteness() / finalizeOnboarding() can read it
    await this.upsertBusinessProfile(orgId, userId, mergedData).catch((err) => {
      this.logger.warn(`BusinessProfile upsert failed (non-fatal): ${err.message}`);
    });

    return {
      message: assistantContent,
      extractedFields,
      completionScore: actualScore,
      isComplete: actualComplete,
      currentPhase,
      riskObservations: mergedRisks,
      integrationRecommendations: mergedIntegrations,
      phaseCompletion: (mergedData._phaseCompletion as Record<string, number>) ?? {},
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

    const companyName   = String(data.companyName);
    const companyType   = toCompanyType(data.companyType ?? 'smb') as any;
    const industry      = toIndustry(data.industry ?? 'other') as any;
    const employeeCount = data.employeeCount ? String(data.employeeCount) : '1-10';

    // ─── Infrastructure ────────────────────────────────────────────────────────
    const infrastructure = {
      cloudProviders:  Array.isArray(data.cloudProviders) ? data.cloudProviders : [],
      keyDatabases:    Array.isArray(data.keyDatabases) ? data.keyDatabases : [],
      cicdTools:       Array.isArray(data.cicdTools) ? data.cicdTools : [],
      sourceControl:   data.sourceControl ?? null,
      saasTools:       Array.isArray(data.saasTools) ? data.saasTools : [],
      internetFacing:  data.internetFacing ?? null,
    };

    // ─── Data handling & privacy ───────────────────────────────────────────────
    const dataHandling = {
      dataTypes:           Array.isArray(data.dataTypes) ? data.dataTypes : [],
      gdprExposure:        data.gdprExposure ?? null,
      ccpaExposure:        data.ccpaExposure ?? null,
      hipaaScope:          data.hipaaScope ?? null,
      dataRetentionPolicy: data.dataRetentionPolicy ?? null,
      subprocessorCount:   data.subprocessorCount ?? null,
      crossBorderTransfers: data.crossBorderTransfers ?? null,
    };

    // ─── Compliance goals ──────────────────────────────────────────────────────
    const complianceGoals = {
      targetFrameworks:       Array.isArray(data.targetFrameworks) ? data.targetFrameworks : [],
      auditType:              data.auditType ?? null,
      complianceDriver:       data.complianceDriver ?? null,
      targetDate:             data.targetDate ?? null,
      existingCertifications: Array.isArray(data.existingCertifications) ? data.existingCertifications : [],
    };

    // ─── Current security posture ──────────────────────────────────────────────
    const currentPosture = {
      mfaStatus:             data.mfaStatus ?? null,
      identityProvider:      data.identityProvider ?? null,
      loggingMaturity:       data.loggingMaturity ?? null,
      siemTool:              data.siemTool ?? null,
      endpointManagement:    data.endpointManagement ?? null,
      vulnerabilityScanning: data.vulnerabilityScanning ?? null,
      patchManagement:       data.patchManagement ?? null,
      incidentResponsePlan:  data.incidentResponsePlan ?? null,
      backupStatus:          data.backupStatus ?? null,
      documentationMaturity: data.documentationMaturity ?? null,
      accessReviewCadence:   data.accessReviewCadence ?? null,
      vendorReviewCadence:   data.vendorReviewCadence ?? null,
      existingGRCTooling:    data.existingGRCTooling ?? null,
    };

    // ─── Risk profile + org context ────────────────────────────────────────────
    const riskProfile = {
      riskObservations:  Array.isArray(data._riskObservations) ? data._riskObservations : [],
      integrationRecs:   Array.isArray(data._integrationRecommendations) ? data._integrationRecommendations : [],
      teamStructure:     data.teamStructure ?? null,
      regions:           Array.isArray(data.regions) ? data.regions : [],
      workforceModel:    data.workforceModel ?? null,
      ownerAccess:       data.ownerAccess ?? null,
      ownerInfrastructure: data.ownerInfrastructure ?? null,
      ownerIncidentResponse: data.ownerIncidentResponse ?? null,
      ownerCompliance:   data.ownerCompliance ?? null,
      ownerPolicies:     data.ownerPolicies ?? null,
      ownerVendors:      data.ownerVendors ?? null,
    };

    await this.prisma.businessProfile.upsert({
      where: { orgId },
      create: {
        orgId,
        companyName,
        companyType,
        industry,
        employeeCount,
        infrastructure:  infrastructure as any,
        dataHandling:    dataHandling as any,
        complianceGoals: complianceGoals as any,
        currentPosture:  currentPosture as any,
        riskProfile:     riskProfile as any,
        collectedVia:    'onboarding_agent' as any,
        isComplete:      false,
      },
      update: {
        companyName,
        companyType,
        industry,
        employeeCount,
        infrastructure:  infrastructure as any,
        dataHandling:    dataHandling as any,
        complianceGoals: complianceGoals as any,
        currentPosture:  currentPosture as any,
        riskProfile:     riskProfile as any,
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

    const extractedData = (session.extractedData as Record<string, unknown>) ?? {};

    return {
      hasSession: true,
      status: session.status,
      currentState: session.currentState,
      turnCount: session.turnCount,
      completionScore: 0, // overridden client-side from extractedData
      isComplete: session.status === 'completed',
      hasBusinessProfile: profile?.isComplete ?? false,
      extractedData,
      messages: session.messages,
      // Expose accumulated discovery meta for frontend restore
      riskObservations: Array.isArray(extractedData._riskObservations) ? extractedData._riskObservations : [],
      integrationRecommendations: Array.isArray(extractedData._integrationRecommendations) ? extractedData._integrationRecommendations : [],
      phaseCompletion: (extractedData._phaseCompletion as Record<string, number>) ?? {},
      currentPhase: (extractedData._currentPhase as string) ?? 'foundation',
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
   * Uses a weighted formula: 70% required fields + 30% enrichment fields.
   * Falls back to DialogueManager (BusinessProfile) if no session data found.
   */
  async getCompleteness(orgId: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { orgId, status: { not: 'abandoned' as any } },
      orderBy: { startedAt: 'desc' },
    });

    if (session?.extractedData) {
      const data = session.extractedData as Record<string, unknown>;

      const missingRequired = REQUIRED_FIELDS_FOR_FINALIZE.filter((f) => {
        const v = data[f];
        if (v == null || v === '') return true;
        if (Array.isArray(v) && v.length === 0) return true;
        return false;
      });
      const requiredCollected = REQUIRED_FIELDS_FOR_FINALIZE.length - missingRequired.length;

      const enrichmentCollected = ENRICHMENT_FIELDS.filter((f) => {
        const v = data[f];
        if (v == null || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      }).length;

      const completionPct = Math.min(100, Math.round(
        (requiredCollected / REQUIRED_FIELDS_FOR_FINALIZE.length) * 70 +
        (enrichmentCollected / ENRICHMENT_FIELDS.length) * 30,
      ));

      return {
        completionPct,
        completionScore: completionPct / 100,
        isComplete: requiredCollected >= 8,
        missingFields: [...missingRequired],
        canFinalize: requiredCollected >= Math.ceil(REQUIRED_FIELDS_FOR_FINALIZE.length * FINALIZE_COMPLETENESS_THRESHOLD),
        finalizeThreshold: FINALIZE_COMPLETENESS_THRESHOLD,
        requiredCollected,
        enrichmentCollected,
        phaseCompletion: (data._phaseCompletion as Record<string, number>) ?? {},
        riskObservationsCount: Array.isArray(data._riskObservations) ? (data._riskObservations as any[]).length : 0,
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

    // Generate guided compliance task program — non-blocking, runs after controls are seeded by pipeline
    // Small delay to allow pipeline to create OrganizationControl records first
    setTimeout(() => {
      this.tasksService.generateGuidedProgram(orgId).catch((err) =>
        this.logger.warn(`Guided program generation failed (non-fatal): ${err.message}`),
      );
    }, 30_000); // 30s delay — controls should be seeded by then

    return { workflowId, journeyId };
  }

  private async processAttachment(file: Express.Multer.File): Promise<string> {
    const maxChars = 8000;
    const mimeType = file.mimetype;
    const filename = file.originalname.toLowerCase();

    try {
      if (mimeType === 'text/plain' || filename.endsWith('.txt') || filename.endsWith('.csv')) {
        return file.buffer.toString('utf-8').slice(0, maxChars);
      }
      if (filename.endsWith('.docx') || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value.slice(0, maxChars);
      }
      if (filename.endsWith('.pdf') || mimeType === 'application/pdf') {
        const data = await pdfParse(file.buffer);
        return data.text.slice(0, maxChars);
      }
      if (mimeType.startsWith('image/')) {
        // Return a marker so the calling code can handle vision separately
        return `[IMAGE: ${file.originalname}]`;
      }
      return file.buffer.toString('utf-8').slice(0, maxChars);
    } catch (err: any) {
      this.logger.warn(`processAttachment failed for ${file.originalname}: ${err.message}`);
      return `[Could not process attachment: ${file.originalname}]`;
    }
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
