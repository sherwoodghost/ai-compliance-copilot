import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async chat(orgId: string, message: string, history: ChatMessage[] = []) {
    // Gather rich live context from the DB
    const context = await this.gatherContext(orgId);

    const systemPrompt = `You are the Compliance Copilot — an expert GRC advisor embedded in a multi-framework compliance platform. You have two modes:

1. LIVE DATA MODE: You have real-time read access to this org's compliance data below. Answer questions about their current program with names, codes, and dates — never counts alone.
2. FRAMEWORK ADVISOR MODE: When a user asks about adding a new framework, pursuing a certification, or building a new compliance program — you explain exactly what that entails, what's required, what dashboards and modules exist in this platform to support it, and guide them to Settings → Frameworks to activate it. You are NOT restricted to the org's current framework — you know all 10 frameworks the platform supports.

═══ PLATFORM CAPABILITIES ═══

This platform supports 10 compliance frameworks. Each has dedicated dashboards and modules:

📋 SOC 2 (TSC 2017) — Trust Services Criteria
  Dashboards: Readiness Score, Control Library, Evidence Vault, Auditor Portal
  Key modules: Controls (CC1–CC9, A1, C1, PI1, P1-P8), Evidence, Policies, RFI Management
  Timeline: Type 1 = 3–4 months | Type 2 = 6–12 months observation window
  View status: Settings → Frameworks tab

🔒 ISO 27001:2022 — Information Security Management
  Dashboards: Annex A Heatmap, Risk Treatment, Open Findings, Readiness Score
  Key modules: Controls (A.5–A.8 Annexes), Risk Register, Policies, Internal Audit, Management Review
  Timeline: Gap assessment → implementation → Stage 1 audit → Stage 2 = typically 9–18 months
  View status: Settings → Frameworks tab

🛡️ GDPR — General Data Protection Regulation
  Dashboards: DSAR Queue, ROPA Coverage, Breach Clock, Lawful Basis Map
  Key modules: ROPA (Record of Processing Activities), DSAR Tracker, DPIA Register, Breach Log
  Key requirement: Appoint DPO if required; 72-hour breach notification SLA; data subject rights process
  View status: Settings → Frameworks tab

🏥 HIPAA — Health Insurance Portability & Accountability Act
  Dashboards: PHI Coverage, Safeguard Readiness, BAA Tracker
  Key modules: Administrative Safeguards (§164.308), Physical Safeguards (§164.310), Technical Safeguards (§164.312), BAA Management
  Key requirement: Covered Entity or Business Associate? Formal Risk Analysis mandatory.
  View status: Settings → Frameworks tab

💳 PCI DSS v4.0 — Payment Card Industry Data Security Standard
  Dashboards: CDE Scope, Requirement Coverage, SAQ Status
  Key modules: 12 PCI Requirements, CDE Network Map, QSA Evidence, SAQ tracker
  Key requirement: Merchant level determines SAQ vs full QSA audit; CDE segmentation critical
  View status: Settings → Frameworks tab

🏛️ FedRAMP Rev 5 — Federal Risk & Authorization Management Program
  Dashboards: ATO Tracker, SSP Completion, ConMon Status, POA&M Board
  Key modules: ATO Package Manager, System Security Plan (SSP), Plan of Action & Milestones (POA&M), Continuous Monitoring
  Key requirement: Impact level (Low/Moderate/High) determines control baseline; 3PAO assessment required
  View status: Settings → Frameworks tab

🧭 NIST CSF 2.0 — Cybersecurity Framework
  Dashboards: Tier Assessment, Profile Gap View, Function Heatmap
  Key modules: CSF Profiles (Current vs Target), Tier Assessment, Action Plan
  Key requirement: Voluntary framework — set target Tier (1–4) per function; no external certification
  View status: Settings → Frameworks tab

🏆 ISO 9001:2015 — Quality Management System
  Dashboards: NCR Aging, CAPA Effectiveness, Quality Objectives, Process Audit Schedule
  Key modules: NCR Tracker, CAPA Board, Quality Objectives, Process Audits, Management Review
  Timeline: QMS implementation → internal audit → Stage 1 → Stage 2 = typically 6–12 months
  View status: Settings → Frameworks tab

🌿 ISO 14001:2015 — Environmental Management System
  Dashboards: Aspects Register, Objectives Tracker, Legal Compliance, Emergency Preparedness
  Key modules: Environmental Aspects & Impacts, Legal Register, Environmental Objectives, Emergency Plans
  Timeline: EMS implementation → internal audit → certification = typically 6–12 months
  View status: Settings → Frameworks tab

⛑️ ISO 45001:2018 — Occupational Health & Safety
  Dashboards: Hazard Register, Incident Tracker, OHS Objectives, Emergency Plans
  Key modules: Hazard Identification, OHS Incidents, Risk Assessment, Emergency Response Plans
  Timeline: OHSMS implementation → internal audit → certification = typically 6–12 months
  View status: Settings → Frameworks tab

═══ FRAMEWORK GUIDANCE RULES ═══
- When a user asks "I want to get [framework]" or "how do I get [framework] certified" or "what do I need for [framework]":
  → Explain what that framework covers and who needs it
  → List the 3–5 most critical requirements to start working on NOW
  → Name the specific dashboards/modules in this platform that support it
  → Tell them to check Settings → Frameworks tab to see which frameworks are active, and mention they can ask the Copilot to walk them through adding a new framework to their program via the onboarding flow
  → Estimate realistic timeline based on typical company size
- When a user asks to "add" a framework to their existing program:
  → Identify overlaps with their current framework(s) to reduce duplicate work
  → Explain the incremental effort needed
  → Guide them through activation

═══ LIVE COMPLIANCE DATA (Current Active Framework: ${context.framework}) ═══

CONTROLS:
- Total: ${context.controls.total} | Implemented: ${context.controls.implemented} | In progress: ${context.controls.inProgress} | Not started: ${context.controls.notStarted}
${context.controls.criticalNotStarted.length > 0 ? `
CRITICAL NOT STARTED (highest priority — these are audit gaps):
${context.controls.criticalNotStarted.map((c) => `  • ${c.code} — ${c.title} [${c.category}]`).join('\n')}` : ''}
${context.controls.inProgressList.length > 0 ? `
IN PROGRESS:
${context.controls.inProgressList.map((c) => `  • ${c.code} — ${c.title}`).join('\n')}` : ''}

EVIDENCE:
- Total: ${context.evidence.total} | Valid: ${context.evidence.valid} | Expired: ${context.evidence.expired} | Expiring in 30d: ${context.evidence.expiringSoon}
${context.evidence.expiredItems.length > 0 ? `
EXPIRED (needs immediate recollection):
${context.evidence.expiredItems.map((e) => `  • "${e.title}" → ${e.controlCode} (expired ${e.expiredDaysAgo}d ago)`).join('\n')}` : ''}
${context.evidence.expiringSoonItems.length > 0 ? `
EXPIRING SOON:
${context.evidence.expiringSoonItems.map((e) => `  • "${e.title}" → ${e.controlCode} (expires ${e.expiresInDays}d)`).join('\n')}` : ''}
${context.evidence.aiIssues.length > 0 ? `
AI-FLAGGED EVIDENCE CONCERNS:
${context.evidence.aiIssues.map((e) => `  • "${e.title}" (confidence ${e.confidence}%) — ${e.flags.join('; ')}`).join('\n')}` : ''}

TASKS:
- Open: ${context.tasks.open} | Overdue: ${context.tasks.overdue} | Done this month: ${context.tasks.completedThisMonth}
${context.tasks.overdueItems.length > 0 ? `
OVERDUE TASKS:
${context.tasks.overdueItems.map((t) => `  • "${t.title}" — ${t.daysOverdue}d overdue${t.assignee ? ` (assigned: ${t.assignee})` : ''}`).join('\n')}` : ''}
${context.tasks.dueSoonItems.length > 0 ? `
DUE THIS WEEK:
${context.tasks.dueSoonItems.map((t) => `  • "${t.title}"${t.assignee ? ` (${t.assignee})` : ''} — due ${t.daysUntilDue}d`).join('\n')}` : ''}

RISKS:
- Total: ${context.risks.total} | Critical/High unmitigated: ${context.risks.critical} | Accepted: ${context.risks.accepted}
${context.risks.criticalItems.length > 0 ? `
TOP CRITICAL/HIGH RISKS:
${context.risks.criticalItems.map((r) => `  • "${r.title}" [${r.severity}] — ${r.status}`).join('\n')}` : ''}

POLICIES:
- Approved: ${context.policies.approved} | Draft: ${context.policies.draft} | Overdue for review: ${context.policies.overdueReview}
${context.policies.overdueItems.length > 0 ? `
POLICIES DUE FOR REVIEW:
${context.policies.overdueItems.map((p) => `  • "${p.title}" v${p.version} (approved ${p.daysSinceApproval}d ago)`).join('\n')}` : ''}

READINESS:
- Score: ${context.readiness.score}% | Primary Framework: ${context.readiness.framework}
- Status: ${context.readiness.score >= 85 ? 'AUDIT READY' : context.readiness.score >= 70 ? 'NEAR READY' : context.readiness.score >= 40 ? 'IN PROGRESS' : 'EARLY STAGE'}

OPEN AUDITOR RFIs: ${context.rfis.open}${context.rfis.open > 0 ? ` (${context.rfis.overdueItems.map((r) => `"${r.question.slice(0, 50)}…"`).join(', ')})` : ''}

EXCEPTIONS: ${context.exceptions.total} active${context.exceptions.expiringSoon > 0 ? ` (${context.exceptions.expiringSoon} expiring soon — need re-approval)` : ''}

═══ RESPONSE RULES ═══
- Be specific: use names, codes, dates — not generic advice
- Keep answers to 3–6 sentences unless drafting text or explaining a new framework
- If asked to draft (email, summary, report): produce clean professional copy
- If asked about a specific control: reference its code + category
- Use exact evidence titles / task names from the live data above
- When something is ✅ good, say so briefly; when it's critical, be direct
- NEVER say "I'm only focused on [X] framework" — you help with ALL 10 frameworks
- When recommending a new framework: always end with the Settings → Frameworks activation path`;

    const messages = [
      ...history.slice(-12),
      { role: 'user' as const, content: message },
    ];

    // Resolve per-org BYOK key
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    });
    const orgSettings = (org?.settings ?? {}) as Record<string, unknown>;
    const orgApiKey = orgSettings['openRouterKey'] as string | undefined;

    const response = await this.llm.complete(messages, {
      systemPrompt,
      agentName: 'copilot',
      maxTokens: 1200,
      temperature: 0.25,
      ...(orgApiKey ? { orgApiKey } : {}),
    } as any);

    return {
      message: response.content,
      context: {
        controlsTotal: context.controls.total,
        readinessScore: context.readiness.score,
      },
    };
  }

  // ─── Rich context gathering ────────────────────────────────────────────────────
  private async gatherContext(orgId: string) {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86_400_000);
    const thirtyDays = new Date(now.getTime() + 30 * 86_400_000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const oneYearAgo = new Date(now.getTime() - 365 * 86_400_000);

    const [
      orgControls,
      evidenceAll,
      tasks,
      risks,
      policies,
      readiness,
      rfis,
      exceptions,
    ] = await Promise.all([
      // Controls with full detail
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: {
          control: { select: { code: true, title: true, category: true, weight: true } },
        },
      }),
      // Evidence with metadata
      this.prisma.evidence.findMany({
        where: { orgId },
        include: { control: { select: { code: true } } },
      }),
      // Tasks
      this.prisma.task.findMany({
        where: { orgId },
        include: { assignee: { select: { fullName: true } } },
      }),
      // Risks
      this.prisma.riskItem.findMany({
        where: { orgId },
        select: { id: true, title: true, status: true, severity: true },
      }),
      // Policies
      this.prisma.policy.findMany({
        where: { orgId },
        select: { id: true, title: true, status: true, version: true, approvedAt: true },
      }),
      // Latest readiness score
      this.prisma.readinessScore.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: 'desc' },
        select: { overallScore: true, framework: true },
      }),
      // Open auditor RFIs
      this.prisma.auditorRfi.findMany({
        where: { orgId, status: { not: 'resolved' } },
        select: { id: true, question: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Active exceptions
      this.prisma.controlException.findMany({
        where: { orgId, status: 'approved' },
        select: { id: true, expiresAt: true },
      }),
    ]);

    const framework = readiness?.framework ?? 'SOC2';

    // ── Controls ──────────────────────────────────────────────────────────────
    const notStarted = orgControls.filter((c) => c.status === 'not_started');
    const inProgress = orgControls.filter((c) => c.status === 'in_progress');
    const implemented = orgControls.filter((c) => c.status === 'implemented');

    // Sort not-started by weight (highest = most critical)
    const criticalNotStarted = notStarted
      .sort((a, b) => ((b.control as any)?.weight ?? 1) - ((a.control as any)?.weight ?? 1))
      .slice(0, 8)
      .map((c) => ({
        code: (c.control as any)?.code ?? '',
        title: (c.control as any)?.title ?? '',
        category: (c.control as any)?.category ?? '',
      }));

    const inProgressList = inProgress.slice(0, 6).map((c) => ({
      code: (c.control as any)?.code ?? '',
      title: (c.control as any)?.title ?? '',
    }));

    // ── Evidence ──────────────────────────────────────────────────────────────
    const expiredItems = (evidenceAll as any[])
      .filter((e) => e.expiresAt && new Date(e.expiresAt) < now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
      .slice(0, 5)
      .map((e) => ({
        title: e.title,
        controlCode: (e.control as any)?.code ?? '',
        expiredDaysAgo: Math.floor((now.getTime() - new Date(e.expiresAt).getTime()) / 86_400_000),
      }));

    const expiringSoonItems = (evidenceAll as any[])
      .filter((e) => e.expiresAt && new Date(e.expiresAt) >= now && new Date(e.expiresAt) <= thirtyDays)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
      .slice(0, 5)
      .map((e) => ({
        title: e.title,
        controlCode: (e.control as any)?.code ?? '',
        expiresInDays: Math.ceil((new Date(e.expiresAt).getTime() - now.getTime()) / 86_400_000),
      }));

    // AI-flagged evidence with confidence < 60 or flags
    const aiIssues = (evidenceAll as any[])
      .filter((e) => {
        const meta = (e.metadata ?? {}) as Record<string, any>;
        return meta.aiConfidence != null && (meta.aiConfidence < 60 || (meta.aiFlags ?? []).length > 0);
      })
      .slice(0, 5)
      .map((e) => {
        const meta = (e.metadata ?? {}) as Record<string, any>;
        return {
          title: e.title,
          confidence: meta.aiConfidence ?? 0,
          flags: (meta.aiFlags ?? []).slice(0, 2) as string[],
        };
      });

    // ── Tasks ─────────────────────────────────────────────────────────────────
    const allTasks = tasks as any[];
    const overdueItems = allTasks
      .filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 6)
      .map((t) => ({
        title: t.title,
        daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate).getTime()) / 86_400_000),
        assignee: (t.assignee as any)?.fullName ?? null,
      }));

    const dueSoonItems = allTasks
      .filter((t) => t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= sevenDays && t.status !== 'done')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5)
      .map((t) => ({
        title: t.title,
        daysUntilDue: Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / 86_400_000),
        assignee: (t.assignee as any)?.fullName ?? null,
      }));

    // ── Risks ─────────────────────────────────────────────────────────────────
    const criticalRisks = (risks as any[])
      .filter((r) => ['critical', 'high'].includes(r.severity ?? '') && r.status !== 'accepted')
      .slice(0, 5)
      .map((r) => ({ title: r.title, severity: r.severity, status: r.status }));

    // ── Policies ──────────────────────────────────────────────────────────────
    const approvedPolicies = (policies as any[]).filter((p) => p.status === 'approved');
    const overdueForReview = approvedPolicies
      .filter((p) => p.approvedAt && new Date(p.approvedAt) < oneYearAgo)
      .slice(0, 4)
      .map((p) => ({
        title: p.title,
        version: p.version,
        daysSinceApproval: Math.floor((now.getTime() - new Date(p.approvedAt).getTime()) / 86_400_000),
      }));

    // ── Exceptions ────────────────────────────────────────────────────────────
    const expiringSoonExceptions = (exceptions as any[]).filter(
      (e) => e.expiresAt && new Date(e.expiresAt) <= thirtyDays,
    ).length;

    return {
      framework,
      controls: {
        total: orgControls.length,
        implemented: implemented.length,
        inProgress: inProgress.length,
        notStarted: notStarted.length,
        criticalNotStarted,
        inProgressList,
      },
      evidence: {
        total: (evidenceAll as any[]).length,
        valid: (evidenceAll as any[]).filter((e) => e.isValid).length,
        expired: expiredItems.length + (evidenceAll as any[]).filter((e) => e.expiresAt && new Date(e.expiresAt) < now).length - expiredItems.length,
        expiringSoon: expiringSoonItems.length,
        expiredItems,
        expiringSoonItems,
        aiIssues,
      },
      tasks: {
        open: allTasks.filter((t) => t.status !== 'done').length,
        overdue: overdueItems.length,
        completedThisMonth: allTasks.filter((t) => t.status === 'done' && new Date(t.updatedAt) >= startOfMonth).length,
        overdueItems,
        dueSoonItems,
      },
      risks: {
        total: (risks as any[]).length,
        critical: criticalRisks.length,
        accepted: (risks as any[]).filter((r) => r.status === 'accepted').length,
        criticalItems: criticalRisks,
      },
      policies: {
        approved: approvedPolicies.length,
        draft: (policies as any[]).filter((p) => p.status === 'draft').length,
        overdueReview: overdueForReview.length,
        overdueItems: overdueForReview,
      },
      readiness: {
        score: readiness?.overallScore ?? 0,
        framework: readiness?.framework ?? 'SOC2',
      },
      rfis: {
        open: (rfis as any[]).length,
        overdueItems: (rfis as any[]).slice(0, 3).map((r) => ({ question: r.question })),
      },
      exceptions: {
        total: (exceptions as any[]).length,
        expiringSoon: expiringSoonExceptions,
      },
    };
  }
}
