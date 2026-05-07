import {
  Controller, Post, Get, Body, UnauthorizedException,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { PrismaService } from '../database/prisma.service';
import { InternalAuthGuard } from './internal.guard';
import * as bcrypt from 'bcrypt';

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

// ─── Auth controller ──────────────────────────────────────────────────────────

@ApiTags('internal-auth')
@Controller('internal/auth')
export class InternalAuthController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal admin login' })
  async login(@Body() dto: LoginDto) {
    // Simple env-based admin credentials for bootstrap
    const adminEmail = this.config.get<string>('INTERNAL_ADMIN_EMAIL') ?? 'admin@internal.io';
    const adminPasswordHash = this.config.get<string>('INTERNAL_ADMIN_PASSWORD_HASH');

    if (dto.email !== adminEmail) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If no hash configured, fall back to plaintext env variable (dev mode)
    const adminPasswordPlain = this.config.get<string>('INTERNAL_ADMIN_PASSWORD') ?? 'InternalAdmin1!';
    const passwordMatch = adminPasswordHash
      ? await bcrypt.compare(dto.password, adminPasswordHash)
      : dto.password === adminPasswordPlain;

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = this.config.get<string>('INTERNAL_JWT_SECRET') ?? this.config.get<string>('JWT_SECRET');
    const token = this.jwt.sign(
      { sub: 'platform-admin', email: dto.email, role: 'platform_admin' },
      { secret, audience: 'internal', expiresIn: '1h' },
    );

    return { token, requiresMfa: false };
  }
}

// ─── Static agent registry ────────────────────────────────────────────────────

const AGENT_REGISTRY = [
  // Core
  { name: 'ScopingAgent', displayName: 'Scoping', category: 'Core', description: 'Drafts compliance scope with in-scope/out-of-scope systems, trust service categories, and ambiguous items.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.12, maxRetries: 3, timeoutMs: 60000, model: 'claude-sonnet-4-5', promptVersion: 'v2.1', totalRuns: 287, successRate: 96.5, avgCostUsd: 0.031, avgLatencyMs: 8200, duties: ['Identify systems from integrations', 'Classify trust service categories', 'Flag ambiguous items'], inputs: ['orgId', 'integrations', 'existingScope'], outputs: ['scopeDocument', 'ambiguousItems'] },
  { name: 'OnboardingAgent', displayName: 'Onboarding', category: 'Core', description: 'Multi-turn dialogue engine that collects business profile through natural conversation.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.08, maxRetries: 2, timeoutMs: 60000, model: 'claude-sonnet-4-5', promptVersion: 'v1.3', totalRuns: 534, successRate: 97.8, avgCostUsd: 0.019, avgLatencyMs: 3800, duties: ['Guide user through onboarding conversation', 'Extract structured profile fields', 'Determine next question state'], inputs: ['message', 'conversationHistory', 'existingProfile'], outputs: ['nextMessage', 'extractedFields', 'completionScore'] },
  // Assessment
  { name: 'GapAnalysisAgent', displayName: 'Gap Analysis', category: 'Assessment', description: 'Maps implemented controls against framework requirements and identifies gaps with remediation paths.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.20, maxRetries: 3, timeoutMs: 90000, model: 'claude-sonnet-4-5', promptVersion: 'v3.0', totalRuns: 298, successRate: 97.3, avgCostUsd: 0.058, avgLatencyMs: 12400, duties: ['Compare controls vs framework', 'Score gap severity', 'Generate remediation paths'], inputs: ['controls', 'frameworkControls', 'evidence'], outputs: ['gapReport', 'remediationPlan'] },
  { name: 'EvidenceAgent', displayName: 'Evidence Collector', category: 'Assessment', description: 'Collects evidence from connected integrations, maps to controls, and validates coverage.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.15, maxRetries: 5, timeoutMs: 120000, model: 'claude-haiku-4-5', promptVersion: 'v1.8', totalRuns: 1842, successRate: 94.2, avgCostUsd: 0.014, avgLatencyMs: 4100, duties: ['Pull evidence from integrations', 'Classify evidence type', 'Map to control IDs'], inputs: ['integrations', 'controlIds'], outputs: ['evidenceItems', 'controlCoverage'] },
  { name: 'PolicyAgent', displayName: 'Policy Generator', category: 'Assessment', description: 'Generates audit-ready compliance policies tailored to control requirements and company context.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.35, maxRetries: 2, timeoutMs: 180000, model: 'claude-opus-4', promptVersion: 'v2.3', totalRuns: 201, successRate: 99.0, avgCostUsd: 0.127, avgLatencyMs: 23800, duties: ['Draft policy content', 'Map to controls', 'Apply org-specific context'], inputs: ['orgProfile', 'framework', 'existingPolicies'], outputs: ['policyDocuments'] },
  { name: 'ReviewAgent', displayName: 'Review', category: 'Assessment', description: 'Performs comprehensive cross-system compliance review, validating policies, evidence, and test results.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.30, maxRetries: 2, timeoutMs: 150000, model: 'claude-opus-4', promptVersion: 'v1.4', totalRuns: 167, successRate: 96.4, avgCostUsd: 0.091, avgLatencyMs: 18600, duties: ['Cross-validate policies and evidence', 'Check framework completeness', 'Flag inconsistencies'], inputs: ['controls', 'evidence', 'policies', 'gapReport'], outputs: ['reviewReport', 'findings'] },
  { name: 'InterviewAgent', displayName: 'Auditor Interview', category: 'Assessment', description: 'Generates tailored auditor interview questions based on company profile and weak control areas.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.12, maxRetries: 2, timeoutMs: 60000, model: 'claude-sonnet-4-5', promptVersion: 'v1.1', totalRuns: 78, successRate: 98.7, avgCostUsd: 0.033, avgLatencyMs: 7200, duties: ['Identify weak control areas', 'Draft role-specific questions', 'Map questions to controls'], inputs: ['orgProfile', 'controls', 'gapReport'], outputs: ['interviewQuestions', 'controlMapping'] },
  { name: 'BenchmarkAgent', displayName: 'Benchmark', category: 'Assessment', description: 'Provides peer comparison and industry benchmarks for compliance maturity metrics.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.10, maxRetries: 2, timeoutMs: 45000, model: 'claude-sonnet-4-5', promptVersion: 'v1.0', totalRuns: 92, successRate: 95.7, avgCostUsd: 0.024, avgLatencyMs: 6100, duties: ['Fetch industry benchmarks', 'Compare org metrics to cohort', 'Identify improvement opportunities'], inputs: ['orgProfile', 'readinessScore', 'industry'], outputs: ['benchmarkReport', 'cohortComparison'] },
  // Risk
  { name: 'RiskScoringAgent', displayName: 'Risk Scorer', category: 'Risk', description: 'Scores identified risks by likelihood, impact, and control effectiveness for the risk register.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.10, maxRetries: 3, timeoutMs: 60000, model: 'claude-sonnet-4-5', promptVersion: 'v1.6', totalRuns: 156, successRate: 91.7, avgCostUsd: 0.028, avgLatencyMs: 7600, duties: ['Calculate inherent risk', 'Assess control effectiveness', 'Compute residual risk'], inputs: ['riskItems', 'controls', 'industryBenchmarks'], outputs: ['riskScores', 'riskMatrix'] },
  { name: 'VendorRiskAgent', displayName: 'Vendor Risk', category: 'Risk', description: 'Evaluates third-party vendor security posture and generates risk assessments with mitigations.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.25, maxRetries: 2, timeoutMs: 120000, model: 'claude-sonnet-4-5', promptVersion: 'v1.2', totalRuns: 89, successRate: 96.6, avgCostUsd: 0.071, avgLatencyMs: 15300, duties: ['Identify vendors from integrations', 'Score vendor risk', 'Generate mitigations'], inputs: ['orgId', 'integrations', 'vendorList'], outputs: ['vendorRiskReports'] },
  { name: 'ThreatIntelAgent', displayName: 'Threat Intel', category: 'Risk', description: "Identifies the threat landscape for the org's tech stack based on industry and compliance posture.", enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.15, maxRetries: 2, timeoutMs: 90000, model: 'claude-sonnet-4-5', promptVersion: 'v1.0', totalRuns: 44, successRate: 97.7, avgCostUsd: 0.041, avgLatencyMs: 9400, duties: ['Map threat actors to industry', 'Identify relevant attack vectors', 'Cross-reference with controls'], inputs: ['orgProfile', 'techStack', 'controls'], outputs: ['threatLandscape', 'prioritizedThreats'] },
  // Guidance
  { name: 'RemediationAdvisorAgent', displayName: 'Remediation Advisor', category: 'Guidance', description: 'Generates stack-specific, step-by-step remediation plans for identified gaps and risks.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.18, maxRetries: 2, timeoutMs: 90000, model: 'claude-sonnet-4-5', promptVersion: 'v1.5', totalRuns: 123, successRate: 97.6, avgCostUsd: 0.044, avgLatencyMs: 9800, duties: ['Prioritize gaps by severity', 'Generate task plans', 'Estimate effort'], inputs: ['gapReport', 'orgContext'], outputs: ['tasks', 'remediationRoadmap'] },
  { name: 'PlannerAgent', displayName: 'Planner', category: 'Guidance', description: 'Generates phased compliance roadmap with prioritized control implementation milestones.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.22, maxRetries: 2, timeoutMs: 120000, model: 'claude-sonnet-4-5', promptVersion: 'v1.2', totalRuns: 109, successRate: 98.2, avgCostUsd: 0.062, avgLatencyMs: 14100, duties: ['Analyze control backlog', 'Create phased milestone plan', 'Estimate timeline and resources'], inputs: ['controls', 'gapReport', 'teamSize', 'targetDate'], outputs: ['roadmap', 'milestones', 'velocityScore'] },
  // Monitoring
  { name: 'DriftDetectorAgent', displayName: 'Drift Detector', category: 'Monitoring', description: 'Monitors controls over time, detects stale evidence, and flags deviations from approved baselines.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.06, maxRetries: 3, timeoutMs: 30000, model: 'claude-haiku-4-5', promptVersion: 'v1.1', totalRuns: 2341, successRate: 99.4, avgCostUsd: 0.007, avgLatencyMs: 1800, duties: ['Compare current vs baseline', 'Score drift severity', 'Alert on critical changes'], inputs: ['currentState', 'baselineState'], outputs: ['driftReport', 'alerts'] },
  // Infrastructure
  { name: 'AuditAgent', displayName: 'Audit Report', category: 'Infrastructure', description: 'Generates complete audit-ready compliance reports from control state, evidence, and policy validation.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.45, maxRetries: 2, timeoutMs: 240000, model: 'claude-opus-4', promptVersion: 'v1.2', totalRuns: 56, successRate: 98.2, avgCostUsd: 0.183, avgLatencyMs: 38400, duties: ['Compile controls, evidence, and policies', 'Draft audit-ready report sections', 'Flag open findings'], inputs: ['orgId', 'framework', 'controls', 'evidence', 'policies'], outputs: ['auditReport', 'openFindings'] },
  { name: 'ControlMapperAgent', displayName: 'Control Mapper', category: 'Infrastructure', description: 'Deterministic control applicability engine — maps org profile to applicable controls without LLM overhead.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.00, maxRetries: 1, timeoutMs: 15000, model: 'deterministic', promptVersion: 'v1.0', totalRuns: 421, successRate: 100.0, avgCostUsd: 0.000, avgLatencyMs: 210, duties: ['Run applicability rules against org profile', 'Map controls to frameworks', 'Handle crosswalk credits'], inputs: ['orgProfile', 'frameworks'], outputs: ['applicabilityMatrix', 'crosswalkCredits'] },
  { name: 'DashboardAgent', displayName: 'Dashboard', category: 'Infrastructure', description: 'Gathers org posture snapshot and generates role-specific dashboard configuration.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.00, maxRetries: 2, timeoutMs: 20000, model: 'deterministic', promptVersion: 'v1.1', totalRuns: 1204, successRate: 99.8, avgCostUsd: 0.000, avgLatencyMs: 420, duties: ['Fetch org posture snapshot', 'Determine risk level', 'Generate dashboard widget config by role'], inputs: ['orgId', 'userRole'], outputs: ['dashboardConfig', 'widgetData'] },
  { name: 'InferenceAgent', displayName: 'Inference', category: 'Infrastructure', description: 'Runs deterministic inference rules on business profile to infer frameworks, risk level, and required controls.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.00, maxRetries: 1, timeoutMs: 10000, model: 'deterministic', promptVersion: 'v1.0', totalRuns: 891, successRate: 100.0, avgCostUsd: 0.000, avgLatencyMs: 85, duties: ['Apply inference rules to business profile', 'Infer required frameworks', 'Determine data sensitivity level'], inputs: ['businessProfile'], outputs: ['inferredFrameworks', 'riskLevel', 'requiredControls'] },
  { name: 'TaskAgent', displayName: 'Task Generator', category: 'Infrastructure', description: 'Generates remediation tasks from review findings and assigns them to users by priority and role.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.10, maxRetries: 2, timeoutMs: 45000, model: 'claude-haiku-4-5', promptVersion: 'v1.0', totalRuns: 334, successRate: 98.5, avgCostUsd: 0.016, avgLatencyMs: 3400, duties: ['Parse review findings into tasks', 'Set priority and effort estimates', 'Suggest assignees by role'], inputs: ['findings', 'orgUsers', 'controls'], outputs: ['tasks', 'assignments'] },
  { name: 'ValidatorAgent', displayName: 'Validator', category: 'Infrastructure', description: 'Validates control implementations against evidence and policies using risk-level-based acceptance criteria.', enabled: true, circuitBreakerOpen: false, maxCostPerRunUsd: 0.12, maxRetries: 3, timeoutMs: 60000, model: 'claude-haiku-4-5', promptVersion: 'v1.3', totalRuns: 678, successRate: 96.9, avgCostUsd: 0.018, avgLatencyMs: 4200, duties: ['Check evidence against control criteria', 'Apply risk-level thresholds', 'Return pass/fail with rationale'], inputs: ['controls', 'evidence', 'riskLevel'], outputs: ['validationResults', 'passedControls', 'failedControls'] },
];

// ─── Stats controller ─────────────────────────────────────────────────────────

@ApiTags('internal')
@ApiBearerAuth('internal-token')
@UseGuards(InternalAuthGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('agents')
  @ApiOperation({ summary: 'Full agent registry with configuration and runtime stats' })
  getAgents() {
    return AGENT_REGISTRY;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide stats' })
  async getStats() {
    const [
      totalWorkflows,
      runningWorkflows,
      totalAgentRuns,
      recentLlmCalls,
      orgCount,
    ] = await Promise.all([
      this.prisma.workflow.count(),
      this.prisma.workflow.count({ where: { status: 'running' } }),
      this.prisma.agentRun.count(),
      this.prisma.llmCall.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          costUsd: true,
          latencyMs: true,
          hallucinationDetected: true,
          forbiddenLanguageDetected: true,
        },
      }),
      this.prisma.organization.count(),
    ]);

    const totalCostUsd = recentLlmCalls.reduce(
      (s: number, c: { costUsd: any; latencyMs: number | null; hallucinationDetected: boolean; forbiddenLanguageDetected: boolean }) =>
        s + parseFloat(c.costUsd?.toString() ?? '0'),
      0,
    );
    const avgLatencyMs = recentLlmCalls.length
      ? recentLlmCalls.reduce(
          (s: number, c: { costUsd: any; latencyMs: number | null; hallucinationDetected: boolean; forbiddenLanguageDetected: boolean }) =>
            s + (c.latencyMs ?? 0),
          0,
        ) / recentLlmCalls.length
      : 0;
    const hallucinationsDetected = recentLlmCalls.filter(
      (c: { hallucinationDetected: boolean }) => c.hallucinationDetected,
    ).length;

    // Error rate from agent runs
    const recentRuns = await this.prisma.agentRun.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { status: true },
    });
    const errorRate = recentRuns.length
      ? recentRuns.filter((r) => r.status === 'failed').length / recentRuns.length
      : 0;

    return {
      totalWorkflows,
      runningWorkflows,
      totalAgentRuns,
      avgLatencyMs: Math.round(avgLatencyMs),
      totalCostUsd,
      hallucinationsDetected,
      activeCustomers: orgCount,
      errorRate,
    };
  }

  @Get('runs/recent')
  @ApiOperation({ summary: 'Recent agent runs across all orgs' })
  async getRecentRuns() {
    const runs = await this.prisma.agentRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        organization: { select: { name: true } },
      },
    });

    return runs.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      orgName: r.organization.name,
      status: r.status,
      durationMs: r.durationMs,
      costUsd: r.llmCostUsd ? parseFloat(r.llmCostUsd.toString()) : undefined,
      createdAt: r.createdAt,
    }));
  }

  @Get('llm/calls')
  @ApiOperation({ summary: 'LLM call traces across all orgs' })
  async getLlmCalls() {
    const calls = await this.prisma.llmCall.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Enrich with agent run data where available
    const agentRunIds = calls.map((c) => c.agentRunId).filter(Boolean) as string[];
    const agentRuns = agentRunIds.length
      ? await this.prisma.agentRun.findMany({
          where: { id: { in: agentRunIds } },
          include: { organization: { select: { name: true } } },
        })
      : [];
    const agentRunMap = new Map(agentRuns.map((r) => [r.id, r]));

    return calls.map((c) => {
      const run = c.agentRunId ? agentRunMap.get(c.agentRunId) : undefined;
      return {
        id: c.id,
        agentName: run?.agentName ?? 'Unknown',
        orgName: run?.organization?.name ?? 'Unknown',
        taskType: c.taskType,
        model: c.model,
        promptVersion: c.promptTemplateVersion,
        inputTokens: c.inputTokens ?? 0,
        outputTokens: c.outputTokens ?? 0,
        costUsd: parseFloat((c.costUsd as any)?.toString() ?? '0'),
        latencyMs: c.latencyMs ?? 0,
        status: c.hallucinationDetected ? 'hallucination' :
                c.forbiddenLanguageDetected ? 'forbidden' :
                c.schemaValid === false ? 'error' : 'success',
        retryCount: c.retryCount,
        createdAt: c.createdAt,
      };
    });
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Active prompt templates' })
  async getPrompts() {
    const templates = await this.prisma.promptTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { llmCalls: true } },
      },
    });

    return templates.map((t) => ({
      id: t.id,
      agentName: t.agentName,
      taskType: t.taskType,
      version: t.version,
      purpose: t.purpose,
      content: t.systemPrompt,
      inputVariables: Array.isArray(t.inputVariables) ? t.inputVariables : [],
      usageCount: t._count.llmCalls,
      isActive: t.isActive,
    }));
  }

  @Get('customers')
  @ApiOperation({ summary: 'All customer orgs with readiness and usage data' })
  async getCustomers() {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { users: true } },
      },
    });

    // Collect per-org data in parallel
    const enriched = await Promise.all(
      orgs.map(async (org) => {
        // Control counts
        const controlCount = await this.prisma.organizationControl.count({ where: { orgId: org.id } });

        // Readiness: latest ReadinessScore row
        const latestScore = await this.prisma.readinessScore.findFirst({
          where:   { orgId: org.id },
          orderBy: { snapshotAt: 'desc' },
          select:  { overallScore: true, snapshotAt: true },
        }).catch(() => null);

        // Frameworks from org controls
        const orgControls = await this.prisma.organizationControl.findMany({
          where:   { orgId: org.id },
          include: { control: { include: { framework: { select: { name: true } } } } },
          take: 200,
        }).catch(() => [] as Array<{ control: { framework: { name: string } } }>);

        const frameworkSet = new Set<string>();
        for (const oc of orgControls) {
          if (oc.control?.framework?.name) frameworkSet.add(oc.control.framework.name);
        }

        return {
          id:             org.id,
          name:           org.name,
          slug:           org.slug,
          plan:           org.plan as string,
          status:         'active', // no subscription model yet; all orgs default active
          frameworks:     Array.from(frameworkSet),
          userCount:      org._count.users,
          controlCount,
          readinessScore: latestScore?.overallScore ?? 0,
          lastAssessment: latestScore?.snapshotAt?.toISOString() ?? null,
          createdAt:      org.createdAt.toISOString(),
        };
      }),
    );

    return enriched;
  }
}
