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
import { ONBOARDING_CHAT_V2 } from '../../prompts/onboarding/onboarding-chat-v2.prompt';

/** Minimum completeness fraction (0–1) required to allow finalize */
const FINALIZE_COMPLETENESS_THRESHOLD = 0.85;

// ─── Onboarding chat system prompt — sourced from prompt registry ─────────────
// Full template lives in backend/src/prompts/onboarding/onboarding-chat-v2.prompt.ts
// Variables injected at runtime: {{conversationHistory}}, {{existingProfile}},
//   {{userMessage}}, {{frameworkAddendum}}
const ONBOARDING_CHAT_TEMPLATE = ONBOARDING_CHAT_V2.systemPrompt;

// Template variables used at runtime: {{conversationHistory}} {{existingProfile}} {{userMessage}}


// ─── Framework-specific addendums (injected dynamically after Phase 2) ────────
function getFrameworkAddendum(extractedData: Record<string, unknown>): string {
  const frameworks: string[] = Array.isArray(extractedData['targetFrameworks'])
    ? (extractedData['targetFrameworks'] as string[])
    : [];

  if (frameworks.length === 0) return '';

  const parts: string[] = [];

  // ── GDPR ─────────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && f.toUpperCase().includes('GDPR'))) {
    parts.push(`━━━ GDPR DEEP-DIVE (active — user selected GDPR) ━━━
Since GDPR is a target framework, weave these questions into your discovery after Phase 2.
Ask ONE per turn — don't rush. Extract the fields shown.

Questions to ask (in order if not yet answered):
• "Have you appointed a Data Protection Officer (DPO)? Is it mandatory for you, or voluntary?"
• "Do you have a Record of Processing Activities (ROPA) in place today, even if informal?"
• "What lawful bases do you rely on for processing? (consent, legitimate interest, contract, legal obligation)"
• "Do you transfer personal data outside the EU/EEA? If so, what safeguards — Standard Contractual Clauses, adequacy decision, or BCRs?"
• "How do you currently handle Data Subject Access Requests — via email, a portal, or no formal process yet?"
• "Do you have a documented procedure for breach notification covering the 72-hour rule?"

Extract into these fields:
dpoAppointed [boolean], ropaExists [boolean], lawfulBases [array: consent|legitimate_interest|contract|legal_obligation|vital_interests|public_task],
euDataTransfers [boolean], transferMechanism [sccs|adequacy_decision|bcrs|none|other],
dsarProcess [none|email|portal|automated], breachNotificationProcedure [none|informal|documented],
dataRetentionPolicy [none|informal|documented|automated]

Risk rules specific to GDPR:
- HIGH: euDataTransfers=true AND transferMechanism="none" → "EU data transfers without SCCs or adequacy decision = immediate GDPR violation risk"
- HIGH: dpoAppointed=false AND company processes sensitive/health data at scale → flag DPO obligation
- MEDIUM: ropaExists=false → "No ROPA = Art. 30 violation; auditors ask for this on day 1"
- MEDIUM: dsarProcess="none" → "No DSAR process = Art. 15 non-compliance risk; 30-day clock starts from first request"`);
  }

  // ── ISO 9001 ──────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && (f.toUpperCase().includes('ISO9001') || f.toUpperCase().includes('ISO 9001')))) {
    parts.push(`━━━ ISO 9001 DEEP-DIVE (active — user selected ISO 9001) ━━━
Since ISO 9001 is a target framework, weave these questions into your discovery after Phase 2.
Ask ONE per turn. ISO 9001 is quality-focused — adapt your language: less "security", more "process consistency" and "customer satisfaction".

Questions to ask (in order if not yet answered):
• "Do you have an existing Quality Management System (QMS), even an informal one — documented processes, quality reviews?"
• "How do you currently measure customer satisfaction — NPS surveys, support ticket metrics, account manager feedback?"
• "When something goes wrong — a product defect, service failure, customer complaint — what's your current process for investigating and fixing it?"
• "Do you have a formal way to track corrective actions with owners and due dates, or is it ad hoc today?"
• "Are your core operational processes documented — not just in people's heads?"
• "Do you conduct any form of internal quality audits or process reviews today?"

Extract into these fields:
existingQms [boolean], qmsMaturity [none|informal|partial|documented|certified],
customerSatisfactionMethod [none|informal|nps|surveys|formal_metrics],
ncrProcess [none|informal|documented], capaProcess [none|informal|documented],
processesDocumented [none|partial|full], internalAuditsQuality [none|ad_hoc|scheduled|formal],
qualityCertificationTarget [iso9001_initial|iso9001_renewal|gap_assessment]

Risk rules specific to ISO 9001:
- HIGH: ncrProcess="none" → "No NCR process = Clause 10.2 nonconformity; every ISO 9001 audit starts here"
- HIGH: processesDocumented="none" → "Undocumented processes = Clause 4.4 failure; certification will be blocked"
- MEDIUM: customerSatisfactionMethod="none" → "No customer satisfaction measurement = Clause 9.1.2 gap"
- MEDIUM: internalAuditsQuality="none" → "No internal audits = Clause 9.2 gap; required before external certification"`);
  }

  // ── HIPAA ─────────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && f.toUpperCase().includes('HIPAA'))) {
    parts.push(`━━━ HIPAA DEEP-DIVE (active — user selected HIPAA) ━━━
Since HIPAA is a target framework, weave these into discovery after Phase 2.

Questions to ask:
• "Are you a Covered Entity (health plan, clearinghouse, provider) or a Business Associate handling PHI on behalf of one?"
• "What PHI do you store or process? (electronic medical records, billing data, lab results, insurance claims)"
• "Have you completed a formal HIPAA Risk Analysis — not just a general security review?"
• "Do you have Business Associate Agreements (BAAs) in place with all vendors who touch PHI?"
• "What is your HIPAA Security Officer's name and role?"

Extract: hipaaEntityType [covered_entity|business_associate|both], phiTypes [array],
hipaaRiskAnalysis [none|informal|completed], baasCurrent [boolean], hipaaSecurityOfficer [string|null]

Risk rules:
- HIGH: baasCurrent=false → "Missing BAAs with PHI-handling vendors = HIPAA §164.308(b) violation"
- HIGH: hipaaRiskAnalysis="none" → "No Risk Analysis = first item on every HIPAA audit checklist (§164.308(a)(1))"
- MEDIUM: hipaaSecurityOfficer=null → "No designated Security Officer = §164.308(a)(2) gap"`);
  }

  // ── PCI DSS ───────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && (f.toUpperCase().includes('PCI') || f.toUpperCase() === 'PCI-DSS'))) {
    parts.push(`━━━ PCI DSS DEEP-DIVE (active — user selected PCI DSS) ━━━
Since PCI DSS is a target framework, weave these into discovery after Phase 2.

Questions to ask:
• "What is your merchant level? (Level 1 = 6M+ transactions/year → requires QSA; Level 4 = <20K)"
• "Do you store, process, or transmit cardholder data directly, or do you outsource payment processing to a provider like Stripe or Braintree?"
• "Have you completed a Self-Assessment Questionnaire (SAQ) or full QSA audit before?"
• "Is your cardholder data environment (CDE) segmented from the rest of your network?"

Extract: pciMerchantLevel [1|2|3|4], pciScope [direct_processing|tokenized|outsourced|mixed],
pciPriorAssessment [none|saq|qsa], cdeSegmented [boolean|null]

Risk rules:
- HIGH: pciScope="direct_processing" AND cdeSegmented=false → "Direct card processing without CDE segmentation = PCI DSS Req 1 & 4 failure"
- HIGH: pciPriorAssessment="none" → "No prior assessment = significant gap; must complete SAQ before certification"`);
  }

  // ── FedRAMP ──────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && f.toUpperCase().includes('FEDRAMP'))) {
    parts.push(`━━━ FedRAMP DEEP-DIVE (active — user selected FedRAMP) ━━━
Since FedRAMP is a target framework, weave these into discovery after Phase 2.

Questions to ask:
• "What is your target impact level — Low, Moderate, or High? (Most commercial cloud services target Moderate)"
• "Are you pursuing Agency ATO, JAB P-ATO, or DoD IL authorization?"
• "Do you have an existing System Security Plan (SSP), or are you starting from scratch?"
• "Have you engaged a Third Party Assessment Organization (3PAO)? FedRAMP requires an accredited assessor."
• "Do you have a Plan of Action & Milestones (POA&M) process for tracking open findings?"
• "Is your system already deployed in a FedRAMP-authorized cloud environment (AWS GovCloud, Azure Government, etc.)?"

Extract: fedrampImpactLevel [low|moderate|high], fedrampAuthType [agency_ato|jab_p_ato|dod_il],
sspExists [boolean], thirdPartyAssessor3pao [string|null], poamProcess [none|informal|documented],
fedrampCloudEnvironment [aws_govcloud|azure_gov|google_cloud_gov|other|none]

Risk rules specific to FedRAMP:
- CRITICAL: fedrampImpactLevel="high" AND thirdPartyAssessor3pao=null → "High baseline requires JAB-accredited 3PAO — engage immediately; list is at marketplace.fedramp.gov"
- HIGH: sspExists=false → "No SSP = authorization package cannot begin; SSP is the primary FedRAMP deliverable"
- HIGH: fedrampCloudEnvironment="none" → "System must be hosted in a FedRAMP-authorized IaaS/PaaS; this is a prerequisite"
- MEDIUM: poamProcess="none" → "POA&M is a continuous monitoring mandatory deliverable; must be in place at authorization"`);
  }

  // ── NIST CSF ──────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && (f.toUpperCase().includes('NIST_CSF') || f.toUpperCase().includes('NIST CSF') || f.toUpperCase() === 'NIST'))) {
    parts.push(`━━━ NIST CSF DEEP-DIVE (active — user selected NIST CSF) ━━━
Since NIST CSF is a target framework, weave these into discovery after Phase 2.
Note: NIST CSF is voluntary — there is no third-party certification. The goal is selecting a target Tier and building a profile gap plan.

Questions to ask:
• "Which NIST CSF version are you targeting — 2.0 (current) or 1.1?"
• "What is your current implementation Tier — have you assessed where you are today? (Tier 1=Partial, 2=Risk Informed, 3=Repeatable, 4=Adaptive)"
• "What target Tier are you aiming for, and across which CSF Functions? (Govern, Identify, Protect, Detect, Respond, Recover)"
• "Is this for internal risk management improvement, or are you required to report NIST CSF alignment to a customer or regulator?"
• "Do you have an existing Current Profile documenting your current cybersecurity practices?"

Extract: nistCsfVersion [1_1|2_0], nistCurrentTier [1|2|3|4|unknown], nistTargetTier [1|2|3|4],
nistCsfDriver [internal|customer_requirement|regulatory|government_contract],
nistCurrentProfileExists [boolean]

Risk rules specific to NIST CSF:
- HIGH: nistCurrentProfileExists=false → "No Current Profile = no gap analysis baseline; first deliverable is documenting current state across all 6 Functions"
- MEDIUM: nistCurrentTier="1" AND nistTargetTier="4" → "Tier 1 to Tier 4 is a multi-year journey; recommend Tier 2–3 as initial target with 12-month roadmap"
- INFO: nistCsfDriver="regulatory" → "Ask which regulation requires NIST CSF alignment — CISA, FFIEC, state regulations, or contractual"`);
  }

  // ── ISO 14001 ─────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && f.toUpperCase().includes('ISO14001'))) {
    parts.push(`━━━ ISO 14001 DEEP-DIVE (active — user selected ISO 14001) ━━━
Since ISO 14001 is a target framework, weave these into discovery after Phase 2.
Note: ISO 14001 is an Environmental Management System (EMS) standard. Focus on environmental aspects, not security.

Questions to ask:
• "Do you have an existing Environmental Management System, even informal — documented environmental policies or objectives?"
• "What are your most significant environmental aspects? (energy consumption, waste generation, water use, carbon emissions, chemical use)"
• "Are there legal and regulatory environmental requirements that apply to your operations — permits, local environmental laws, reporting obligations?"
• "Do you currently measure or report your environmental performance — carbon footprint, energy consumption metrics?"
• "Have you identified environmental emergencies or incidents that could occur at your site or operations?"
• "Do you conduct any form of internal environmental audits today?"

Extract: existingEms [boolean], emsMaturity [none|informal|partial|documented|certified],
environmentalAspects [array: energy|waste|water|carbon|chemicals|noise|land_use|other],
legalComplianceTracked [boolean], environmentalMetrics [none|informal|measured|reported_externally],
environmentalIncidentHistory [boolean], internalAuditsEnvironmental [none|ad_hoc|scheduled]

Risk rules specific to ISO 14001:
- HIGH: legalComplianceTracked=false AND legalComplianceApplicable=true → "No legal compliance register = Clause 9.1.2 gap; regulatory non-compliance is highest-risk finding"
- HIGH: existingEms=false → "No EMS foundation = Clauses 4.4 and 5 require complete build from scratch; budget 6–9 months"
- MEDIUM: environmentalMetrics="none" → "No performance measurement = Clause 9.1 gap; auditors require data for at least one monitoring cycle before certification"
- MEDIUM: internalAuditsEnvironmental="none" → "No internal audits = Clause 9.2 gap; required before external Stage 2 audit"`);
  }

  // ── ISO 45001 ─────────────────────────────────────────────────────────────────
  if (frameworks.some(f => typeof f === 'string' && f.toUpperCase().includes('ISO45001'))) {
    parts.push(`━━━ ISO 45001 DEEP-DIVE (active — user selected ISO 45001) ━━━
Since ISO 45001 is a target framework, weave these into discovery after Phase 2.
Note: ISO 45001 is an Occupational Health & Safety Management System (OHSMS) standard. Focus on workplace safety, hazards, and worker participation.

Questions to ask:
• "Do you have an existing Occupational Health & Safety management system or safety program?"
• "What are your most significant workplace hazards? (physical, chemical, ergonomic, psychosocial, biological)"
• "Have you had any workplace incidents, near-misses, or injuries in the past 2 years?"
• "Are there specific OH&S legal requirements that apply to your industry and jurisdiction — OSHA regulations, local safety laws?"
• "How do you currently involve workers in safety decisions — safety committees, hazard reporting, toolbox talks?"
• "Do you have emergency response procedures documented and tested?"

Extract: existingOhsms [boolean], ohsmsMaturity [none|informal|partial|documented|certified],
workplaceHazards [array: physical|chemical|ergonomic|psychosocial|biological|fire|electrical|other],
incidentHistoryOhs [boolean|unknown], ohsLegalRequirementsTracked [boolean],
workerParticipation [none|informal|safety_committee|formal], emergencyProcedures [none|informal|documented|tested]

Risk rules specific to ISO 45001:
- CRITICAL: incidentHistoryOhs=true → "Prior incidents = must document root cause investigation and corrective actions for Clause 10.2; auditors will specifically review"
- HIGH: ohsLegalRequirementsTracked=false → "No legal compliance tracking = Clause 9.1.2 gap; OSHA/local regulations are non-negotiable"
- HIGH: workerParticipation="none" → "No worker participation mechanism = Clause 5.4 gap; ISO 45001 uniquely requires demonstrated worker consultation"
- MEDIUM: emergencyProcedures="none" → "No emergency procedures = Clause 8.2 gap; must be documented and tested before certification"`);
  }

  if (parts.length === 0) return '';

  return '\n' + parts.join('\n\n') + '\n';
}

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
    let imageBuffer: Buffer | undefined;
    let imageMimeType: string | undefined;
    if (file) {
      const extractedText = await this.processAttachment(file);
      if (extractedText.startsWith('[IMAGE:')) {
        // Image attachment — pass as vision content block
        imageBuffer = file.buffer;
        imageMimeType = file.mimetype;
      } else {
        fileContext = `\n\n[ATTACHED DOCUMENT: ${file.originalname}]\n${extractedText}\n[END DOCUMENT]`;
      }
    }

    const currentUserMessage = userMessage?.trim()
      ? `${userMessage.trim()}${fileContext}`
      : '(no user message — this is the opening greeting, introduce yourself and explain the discovery process, then ask for the company name)';

    // 6. Inject context into system prompt (including framework-specific addendum)
    const frameworkAddendum = getFrameworkAddendum(extractedSoFar);
    const systemPrompt = ONBOARDING_CHAT_TEMPLATE
      .replace('{{conversationHistory}}', historyLines)
      .replace('{{existingProfile}}', profileSummary)
      .replace('{{userMessage}}', currentUserMessage)
      .replace('{{frameworkAddendum}}', frameworkAddendum);

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
          ...(imageBuffer && { imageBuffer, imageMimeType }),
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
