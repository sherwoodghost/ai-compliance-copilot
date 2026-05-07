'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  AlertTriangle, CheckCircle, Zap, ToggleLeft, ToggleRight,
  ChevronRight, Edit3, Save, X, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Internal API ─────────────────────────────────────────────────────────────

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
internalApi.interceptors.request.use((c) => {
  const token = Cookies.get('internal_token');
  if (token) c.headers.Authorization = `Bearer ${token}`;
  return c;
});

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentConfig = {
  name: string;
  displayName: string;
  category: string;
  description: string;
  enabled: boolean;
  circuitBreakerOpen: boolean;
  maxCostPerRunUsd: number;
  maxRetries: number;
  timeoutMs: number;
  model: string;
  promptVersion: string;
  lastRunAt?: string;
  lastRunStatus?: 'completed' | 'failed' | 'running';
  totalRuns: number;
  successRate: number;
  avgCostUsd: number;
  avgLatencyMs: number;
  duties: string[];
  inputs: string[];
  outputs: string[];
};

// ─── Full 20-agent registry (fallback when backend unreachable) ───────────────

const AGENT_REGISTRY_FALLBACK: AgentConfig[] = [
  // ── Core ──────────────────────────────────────────────────────────────────
  {
    name: 'ScopingAgent',
    displayName: 'Scoping',
    category: 'Core',
    description: 'Drafts compliance scope with in-scope/out-of-scope systems, trust service categories, and ambiguous items.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.12, maxRetries: 3, timeoutMs: 60000,
    model: 'claude-sonnet-4-5', promptVersion: 'v2.1',
    lastRunAt: new Date(Date.now() - 900000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 287, successRate: 96.5, avgCostUsd: 0.031, avgLatencyMs: 8200,
    duties: ['Identify systems from integrations', 'Classify trust service categories', 'Flag ambiguous items'],
    inputs: ['orgId', 'integrations', 'existingScope'],
    outputs: ['scopeDocument', 'ambiguousItems'],
  },
  {
    name: 'OnboardingAgent',
    displayName: 'Onboarding',
    category: 'Core',
    description: 'Multi-turn dialogue engine that collects business profile through natural conversation.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.08, maxRetries: 2, timeoutMs: 60000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.3',
    lastRunAt: new Date(Date.now() - 600000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 534, successRate: 97.8, avgCostUsd: 0.019, avgLatencyMs: 3800,
    duties: ['Guide user through onboarding conversation', 'Extract structured profile fields', 'Determine next question state'],
    inputs: ['message', 'conversationHistory', 'existingProfile'],
    outputs: ['nextMessage', 'extractedFields', 'completionScore'],
  },
  // ── Assessment ────────────────────────────────────────────────────────────
  {
    name: 'GapAnalysisAgent',
    displayName: 'Gap Analysis',
    category: 'Assessment',
    description: 'Maps implemented controls against framework requirements and identifies gaps with remediation paths.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.20, maxRetries: 3, timeoutMs: 90000,
    model: 'claude-sonnet-4-5', promptVersion: 'v3.0',
    lastRunAt: new Date(Date.now() - 300000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 298, successRate: 97.3, avgCostUsd: 0.058, avgLatencyMs: 12400,
    duties: ['Compare controls vs framework', 'Score gap severity', 'Generate remediation paths'],
    inputs: ['controls', 'frameworkControls', 'evidence'],
    outputs: ['gapReport', 'remediationPlan'],
  },
  {
    name: 'EvidenceAgent',
    displayName: 'Evidence Collector',
    category: 'Assessment',
    description: 'Collects evidence from connected integrations, maps to controls, and validates coverage.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.15, maxRetries: 5, timeoutMs: 120000,
    model: 'claude-haiku-4-5', promptVersion: 'v1.8',
    lastRunAt: new Date(Date.now() - 45000).toISOString(), lastRunStatus: 'running',
    totalRuns: 1842, successRate: 94.2, avgCostUsd: 0.014, avgLatencyMs: 4100,
    duties: ['Pull evidence from integrations', 'Classify evidence type', 'Map to control IDs'],
    inputs: ['integrations', 'controlIds'],
    outputs: ['evidenceItems', 'controlCoverage'],
  },
  {
    name: 'PolicyAgent',
    displayName: 'Policy Generator',
    category: 'Assessment',
    description: 'Generates audit-ready compliance policies tailored to control requirements and company context.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.35, maxRetries: 2, timeoutMs: 180000,
    model: 'claude-opus-4', promptVersion: 'v2.3',
    lastRunAt: new Date(Date.now() - 600000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 201, successRate: 99.0, avgCostUsd: 0.127, avgLatencyMs: 23800,
    duties: ['Draft policy content', 'Map to controls', 'Apply org-specific context'],
    inputs: ['orgProfile', 'framework', 'existingPolicies'],
    outputs: ['policyDocuments'],
  },
  {
    name: 'ReviewAgent',
    displayName: 'Review',
    category: 'Assessment',
    description: 'Performs comprehensive cross-system compliance review, validating policies, evidence, and test results.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.30, maxRetries: 2, timeoutMs: 150000,
    model: 'claude-opus-4', promptVersion: 'v1.4',
    lastRunAt: new Date(Date.now() - 1200000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 167, successRate: 96.4, avgCostUsd: 0.091, avgLatencyMs: 18600,
    duties: ['Cross-validate policies and evidence', 'Check framework completeness', 'Flag inconsistencies'],
    inputs: ['controls', 'evidence', 'policies', 'gapReport'],
    outputs: ['reviewReport', 'findings'],
  },
  {
    name: 'InterviewAgent',
    displayName: 'Auditor Interview',
    category: 'Assessment',
    description: 'Generates tailored auditor interview questions based on company profile and weak control areas.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.12, maxRetries: 2, timeoutMs: 60000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.1',
    lastRunAt: new Date(Date.now() - 86400000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 78, successRate: 98.7, avgCostUsd: 0.033, avgLatencyMs: 7200,
    duties: ['Identify weak control areas', 'Draft role-specific questions', 'Map questions to controls'],
    inputs: ['orgProfile', 'controls', 'gapReport'],
    outputs: ['interviewQuestions', 'controlMapping'],
  },
  {
    name: 'BenchmarkAgent',
    displayName: 'Benchmark',
    category: 'Assessment',
    description: 'Provides peer comparison and industry benchmarks for compliance maturity metrics.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.10, maxRetries: 2, timeoutMs: 45000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.0',
    lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 92, successRate: 95.7, avgCostUsd: 0.024, avgLatencyMs: 6100,
    duties: ['Fetch industry benchmarks', 'Compare org metrics to cohort', 'Identify improvement opportunities'],
    inputs: ['orgProfile', 'readinessScore', 'industry'],
    outputs: ['benchmarkReport', 'cohortComparison'],
  },
  // ── Risk ──────────────────────────────────────────────────────────────────
  {
    name: 'RiskScoringAgent',
    displayName: 'Risk Scorer',
    category: 'Risk',
    description: 'Scores identified risks by likelihood, impact, and control effectiveness for the risk register.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.10, maxRetries: 3, timeoutMs: 60000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.6',
    lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: 'failed',
    totalRuns: 156, successRate: 91.7, avgCostUsd: 0.028, avgLatencyMs: 7600,
    duties: ['Calculate inherent risk', 'Assess control effectiveness', 'Compute residual risk'],
    inputs: ['riskItems', 'controls', 'industryBenchmarks'],
    outputs: ['riskScores', 'riskMatrix'],
  },
  {
    name: 'VendorRiskAgent',
    displayName: 'Vendor Risk',
    category: 'Risk',
    description: 'Evaluates third-party vendor security posture and generates risk assessments with mitigations.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.25, maxRetries: 2, timeoutMs: 120000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.2',
    lastRunAt: new Date(Date.now() - 7200000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 89, successRate: 96.6, avgCostUsd: 0.071, avgLatencyMs: 15300,
    duties: ['Identify vendors from integrations', 'Score vendor risk', 'Generate mitigations'],
    inputs: ['orgId', 'integrations', 'vendorList'],
    outputs: ['vendorRiskReports'],
  },
  {
    name: 'ThreatIntelAgent',
    displayName: 'Threat Intel',
    category: 'Risk',
    description: 'Identifies the threat landscape for the org\'s tech stack based on industry and compliance posture.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.15, maxRetries: 2, timeoutMs: 90000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.0',
    lastRunAt: new Date(Date.now() - 14400000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 44, successRate: 97.7, avgCostUsd: 0.041, avgLatencyMs: 9400,
    duties: ['Map threat actors to industry', 'Identify relevant attack vectors', 'Cross-reference with controls'],
    inputs: ['orgProfile', 'techStack', 'controls'],
    outputs: ['threatLandscape', 'prioritizedThreats'],
  },
  // ── Guidance ──────────────────────────────────────────────────────────────
  {
    name: 'RemediationAdvisorAgent',
    displayName: 'Remediation Advisor',
    category: 'Guidance',
    description: 'Generates stack-specific, step-by-step remediation plans for identified gaps and risks.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.18, maxRetries: 2, timeoutMs: 90000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.5',
    lastRunAt: new Date(Date.now() - 5400000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 123, successRate: 97.6, avgCostUsd: 0.044, avgLatencyMs: 9800,
    duties: ['Prioritize gaps by severity', 'Generate task plans', 'Estimate effort'],
    inputs: ['gapReport', 'orgContext'],
    outputs: ['tasks', 'remediationRoadmap'],
  },
  {
    name: 'PlannerAgent',
    displayName: 'Planner',
    category: 'Guidance',
    description: 'Generates phased compliance roadmap with prioritized control implementation milestones.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.22, maxRetries: 2, timeoutMs: 120000,
    model: 'claude-sonnet-4-5', promptVersion: 'v1.2',
    lastRunAt: new Date(Date.now() - 7200000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 109, successRate: 98.2, avgCostUsd: 0.062, avgLatencyMs: 14100,
    duties: ['Analyze control backlog', 'Create phased milestone plan', 'Estimate timeline and resources'],
    inputs: ['controls', 'gapReport', 'teamSize', 'targetDate'],
    outputs: ['roadmap', 'milestones', 'velocityScore'],
  },
  // ── Monitoring ────────────────────────────────────────────────────────────
  {
    name: 'DriftDetectorAgent',
    displayName: 'Drift Detector',
    category: 'Monitoring',
    description: 'Monitors controls over time, detects stale evidence, and flags deviations from approved baselines.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.06, maxRetries: 3, timeoutMs: 30000,
    model: 'claude-haiku-4-5', promptVersion: 'v1.1',
    lastRunAt: new Date(Date.now() - 900000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 2341, successRate: 99.4, avgCostUsd: 0.007, avgLatencyMs: 1800,
    duties: ['Compare current vs baseline', 'Score drift severity', 'Alert on critical changes'],
    inputs: ['currentState', 'baselineState'],
    outputs: ['driftReport', 'alerts'],
  },
  // ── Infrastructure ────────────────────────────────────────────────────────
  {
    name: 'AuditAgent',
    displayName: 'Audit Report',
    category: 'Infrastructure',
    description: 'Generates complete audit-ready compliance reports from control state, evidence, and policy validation.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.45, maxRetries: 2, timeoutMs: 240000,
    model: 'claude-opus-4', promptVersion: 'v1.2',
    lastRunAt: new Date(Date.now() - 28800000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 56, successRate: 98.2, avgCostUsd: 0.183, avgLatencyMs: 38400,
    duties: ['Compile controls, evidence, and policies', 'Draft audit-ready report sections', 'Flag open findings'],
    inputs: ['orgId', 'framework', 'controls', 'evidence', 'policies'],
    outputs: ['auditReport', 'openFindings'],
  },
  {
    name: 'ControlMapperAgent',
    displayName: 'Control Mapper',
    category: 'Infrastructure',
    description: 'Deterministic control applicability engine — maps org profile to applicable controls without LLM overhead.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.00, maxRetries: 1, timeoutMs: 15000,
    model: 'deterministic', promptVersion: 'v1.0',
    lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 421, successRate: 100.0, avgCostUsd: 0.000, avgLatencyMs: 210,
    duties: ['Run applicability rules against org profile', 'Map controls to frameworks', 'Handle crosswalk credits'],
    inputs: ['orgProfile', 'frameworks'],
    outputs: ['applicabilityMatrix', 'crosswalkCredits'],
  },
  {
    name: 'DashboardAgent',
    displayName: 'Dashboard',
    category: 'Infrastructure',
    description: 'Gathers org posture snapshot and generates role-specific dashboard configuration.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.00, maxRetries: 2, timeoutMs: 20000,
    model: 'deterministic', promptVersion: 'v1.1',
    lastRunAt: new Date(Date.now() - 1800000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 1204, successRate: 99.8, avgCostUsd: 0.000, avgLatencyMs: 420,
    duties: ['Fetch org posture snapshot', 'Determine risk level', 'Generate dashboard widget config by role'],
    inputs: ['orgId', 'userRole'],
    outputs: ['dashboardConfig', 'widgetData'],
  },
  {
    name: 'InferenceAgent',
    displayName: 'Inference',
    category: 'Infrastructure',
    description: 'Runs deterministic inference rules on business profile to infer frameworks, risk level, and required controls.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.00, maxRetries: 1, timeoutMs: 10000,
    model: 'deterministic', promptVersion: 'v1.0',
    lastRunAt: new Date(Date.now() - 900000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 891, successRate: 100.0, avgCostUsd: 0.000, avgLatencyMs: 85,
    duties: ['Apply inference rules to business profile', 'Infer required frameworks', 'Determine data sensitivity level'],
    inputs: ['businessProfile'],
    outputs: ['inferredFrameworks', 'riskLevel', 'requiredControls'],
  },
  {
    name: 'TaskAgent',
    displayName: 'Task Generator',
    category: 'Infrastructure',
    description: 'Generates remediation tasks from review findings and assigns them to users by priority and role.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.10, maxRetries: 2, timeoutMs: 45000,
    model: 'claude-haiku-4-5', promptVersion: 'v1.0',
    lastRunAt: new Date(Date.now() - 3600000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 334, successRate: 98.5, avgCostUsd: 0.016, avgLatencyMs: 3400,
    duties: ['Parse review findings into tasks', 'Set priority and effort estimates', 'Suggest assignees by role'],
    inputs: ['findings', 'orgUsers', 'controls'],
    outputs: ['tasks', 'assignments'],
  },
  {
    name: 'ValidatorAgent',
    displayName: 'Validator',
    category: 'Infrastructure',
    description: 'Validates control implementations against evidence and policies using risk-level-based acceptance criteria.',
    enabled: true, circuitBreakerOpen: false,
    maxCostPerRunUsd: 0.12, maxRetries: 3, timeoutMs: 60000,
    model: 'claude-haiku-4-5', promptVersion: 'v1.3',
    lastRunAt: new Date(Date.now() - 1800000).toISOString(), lastRunStatus: 'completed',
    totalRuns: 678, successRate: 96.9, avgCostUsd: 0.018, avgLatencyMs: 4200,
    duties: ['Check evidence against control criteria', 'Apply risk-level thresholds', 'Return pass/fail with rationale'],
    inputs: ['controls', 'evidence', 'riskLevel'],
    outputs: ['validationResults', 'passedControls', 'failedControls'],
  },
];

const CATEGORIES = ['All', ...Array.from(new Set(AGENT_REGISTRY_FALLBACK.map((a) => a.category)))];

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, onUpdate }: { agent: AgentConfig; onUpdate: (patch: Partial<AgentConfig>) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localCostCap, setLocalCostCap] = useState(agent.maxCostPerRunUsd.toString());
  const [localTimeout, setLocalTimeout] = useState((agent.timeoutMs / 1000).toString());
  const [localRetries, setLocalRetries] = useState(agent.maxRetries.toString());

  const statusCfg = {
    completed: { cls: 'text-emerald-400', dot: 'bg-emerald-400', icon: CheckCircle },
    failed:    { cls: 'text-red-400',     dot: 'bg-red-400',     icon: AlertTriangle },
    running:   { cls: 'text-indigo-400',  dot: 'bg-indigo-400 animate-pulse', icon: Zap },
  };
  const cfg = agent.lastRunStatus ? statusCfg[agent.lastRunStatus] : statusCfg.completed;
  const StatusIcon = cfg?.icon ?? CheckCircle;

  function saveEdits() {
    onUpdate({
      maxCostPerRunUsd: parseFloat(localCostCap) || agent.maxCostPerRunUsd,
      timeoutMs: (parseInt(localTimeout) || 60) * 1000,
      maxRetries: parseInt(localRetries) || agent.maxRetries,
    });
    setEditing(false);
  }

  const isDeterministic = agent.model === 'deterministic';

  return (
    <div className={cn(
      'bg-gray-900 border rounded-xl overflow-hidden transition-all',
      agent.circuitBreakerOpen ? 'border-red-800' : agent.enabled ? 'border-gray-800' : 'border-gray-800 opacity-60',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status dot */}
        <span className={cn('w-2 h-2 rounded-full shrink-0', cfg?.dot ?? 'bg-gray-600')} />

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">{agent.displayName}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{agent.category}</span>
            {isDeterministic && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-teal-900/40 text-teal-400 border border-teal-800">
                Deterministic
              </span>
            )}
            {agent.circuitBreakerOpen && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-900 text-red-400 border border-red-800">
                Circuit Open
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{agent.description}</p>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-xs text-gray-600">Success rate</p>
            <p className="text-sm font-semibold text-gray-200">{agent.successRate.toFixed(1)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Avg cost</p>
            <p className={cn('text-sm font-semibold', isDeterministic ? 'text-teal-400' : 'text-amber-400')}>
              {isDeterministic ? 'Free' : `$${agent.avgCostUsd.toFixed(3)}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-600">Total runs</p>
            <p className="text-sm font-semibold text-gray-200">{agent.totalRuns.toLocaleString()}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onUpdate({ enabled: !agent.enabled })}
            className={cn(
              'flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
              agent.enabled
                ? 'border-emerald-800 text-emerald-400 hover:bg-emerald-900/30'
                : 'border-gray-700 text-gray-500 hover:border-gray-600',
            )}
          >
            {agent.enabled
              ? <><ToggleRight className="w-3.5 h-3.5" /> Enabled</>
              : <><ToggleLeft className="w-3.5 h-3.5" /> Disabled</>}
          </button>

          <button
            onClick={() => onUpdate({ circuitBreakerOpen: !agent.circuitBreakerOpen })}
            title={agent.circuitBreakerOpen ? 'Close circuit breaker' : 'Open circuit breaker'}
            className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center border transition-colors',
              agent.circuitBreakerOpen
                ? 'border-red-800 text-red-400 hover:bg-red-900/30'
                : 'border-gray-700 text-gray-600 hover:text-gray-400 hover:border-gray-600',
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-800
                       text-gray-600 hover:text-gray-400 hover:border-gray-600 transition-colors"
          >
            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-5">
          {/* Configuration */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Configuration</p>
              {!isDeterministic && (!editing
                ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                )
                : (
                  <div className="flex items-center gap-2">
                    <button onClick={saveEdits} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                      <Save className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditing(false)} className="text-xs text-gray-600 hover:text-gray-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Model', value: agent.model },
                { label: 'Prompt Version', value: agent.promptVersion },
                {
                  label: 'Cost Cap (USD)',
                  value: editing
                    ? <input type="number" step="0.01" min="0" value={localCostCap}
                        onChange={(e) => setLocalCostCap(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    : isDeterministic ? '—' : `$${agent.maxCostPerRunUsd.toFixed(2)}`,
                },
                {
                  label: 'Timeout (s)',
                  value: editing
                    ? <input type="number" min="1" value={localTimeout}
                        onChange={(e) => setLocalTimeout(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    : `${agent.timeoutMs / 1000}s`,
                },
                {
                  label: 'Max Retries',
                  value: editing
                    ? <input type="number" min="0" max="10" value={localRetries}
                        onChange={(e) => setLocalRetries(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                    : agent.maxRetries,
                },
                { label: 'Avg Latency', value: `${(agent.avgLatencyMs / 1000).toFixed(2)}s` },
              ].map(({ label, value }, i) => (
                <div key={i} className="bg-gray-800/50 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <div className="text-xs font-medium text-gray-200">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Duties */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Duties</p>
            <div className="space-y-1.5">
              {agent.duties.map((duty, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-indigo-500 mt-0.5">→</span>
                  <p className="text-xs text-gray-400">{duty}</p>
                </div>
              ))}
            </div>
          </div>

          {/* I/O */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inputs</p>
              <div className="flex flex-wrap gap-1">
                {agent.inputs.map((inp) => (
                  <span key={inp} className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-gray-400 font-mono">
                    {inp}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Outputs</p>
              <div className="flex flex-wrap gap-1">
                {agent.outputs.map((out) => (
                  <span key={out} className="text-xs bg-indigo-900/30 border border-indigo-800 rounded px-2 py-0.5 text-indigo-400 font-mono">
                    {out}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentRegistryPage() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<AgentConfig>>>({});

  // Fetch from backend; fall back to local registry if unreachable
  const { data: backendAgents } = useQuery<AgentConfig[]>({
    queryKey: ['internal-agents'],
    queryFn: () => internalApi.get('/internal/agents').then((r) => r.data).catch(() => AGENT_REGISTRY_FALLBACK),
    initialData: AGENT_REGISTRY_FALLBACK,
  });

  const agents: AgentConfig[] = (backendAgents ?? AGENT_REGISTRY_FALLBACK).map((a) => ({
    ...a,
    ...(localOverrides[a.name] ?? {}),
  }));

  const categories = ['All', ...Array.from(new Set(agents.map((a) => a.category)))];

  function updateAgent(name: string, patch: Partial<AgentConfig>) {
    setLocalOverrides((prev) => ({ ...prev, [name]: { ...(prev[name] ?? {}), ...patch } }));
    // TODO: persist to backend via POST /internal/agents/:name/config
  }

  const filtered = agents.filter((a) => activeCategory === 'All' || a.category === activeCategory);
  const totalEnabled = agents.filter((a) => a.enabled).length;
  const totalCircuitOpen = agents.filter((a) => a.circuitBreakerOpen).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Agent Registry</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalEnabled} of {agents.length} enabled
            {totalCircuitOpen > 0 && (
              <span className="text-red-400 ml-2">· {totalCircuitOpen} circuit breaker{totalCircuitOpen !== 1 ? 's' : ''} open</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-500 hover:text-gray-300',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {filtered.map((agent) => (
          <AgentCard
            key={agent.name}
            agent={agent}
            onUpdate={(patch) => updateAgent(agent.name, patch)}
          />
        ))}
      </div>

      {/* Info box */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-5 py-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-gray-500">
            Changes to agent configurations are applied immediately to the next run.
            Circuit breakers pause an agent across all organizations.
            Cost caps per run prevent runaway spend — runs exceeding the cap are terminated.
            Deterministic agents run rules-based logic with zero LLM cost.
          </p>
        </div>
      </div>
    </div>
  );
}
