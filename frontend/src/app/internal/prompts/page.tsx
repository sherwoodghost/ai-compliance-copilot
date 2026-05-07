'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  FileText, ChevronRight, ChevronDown, Play, Clock, CheckCircle,
  Copy, Check, Hash, Edit3, Save, X, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const internalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });
internalApi.interceptors.request.use((c) => {
  const t = Cookies.get('internal_token');
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PromptTemplate = {
  id: string;
  agentName: string;
  taskType: string;
  version: string;
  purpose: string;
  content: string;
  inputVariables: string[];
  lastUsedAt?: string;
  usageCount: number;
  avgCostUsd: number;
  isActive: boolean;
};

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_PROMPTS: PromptTemplate[] = [
  {
    id: 'p1', agentName: 'GapAnalysisAgent', taskType: 'gap_analysis',
    version: 'v3.0', purpose: 'Identify control gaps against framework requirements',
    content: `You are a compliance expert analyzing control gaps for a {{frameworkType}} audit.

Given the following controls and their implementation status:
{{controls}}

And the framework requirements:
{{frameworkRequirements}}

Identify gaps and provide:
1. Gap severity (critical/high/medium/low)
2. Affected controls
3. Recommended remediation steps
4. Estimated implementation effort

Return as structured JSON matching the GapReport schema.`,
    inputVariables: ['frameworkType', 'controls', 'frameworkRequirements'],
    lastUsedAt: new Date(Date.now() - 300000).toISOString(),
    usageCount: 298, avgCostUsd: 0.058, isActive: true,
  },
  {
    id: 'p2', agentName: 'PolicyAgent', taskType: 'policy_generation',
    version: 'v2.3', purpose: 'Generate compliance policy documents',
    content: `You are a compliance policy writer creating {{policyType}} policy for {{orgName}}.

Organization context:
- Industry: {{industry}}
- Framework: {{framework}}
- Existing policies: {{existingPolicies}}

Generate a comprehensive policy that:
1. Meets {{framework}} requirements
2. Is practical for a {{orgSize}} organization
3. Uses clear, actionable language
4. Maps to specific control requirements

Return as Markdown with proper headings and sections.`,
    inputVariables: ['policyType', 'orgName', 'industry', 'framework', 'existingPolicies', 'orgSize'],
    lastUsedAt: new Date(Date.now() - 600000).toISOString(),
    usageCount: 201, avgCostUsd: 0.127, isActive: true,
  },
  {
    id: 'p3', agentName: 'RiskScoringAgent', taskType: 'risk_assessment',
    version: 'v1.6', purpose: 'Score and categorize identified risks',
    content: `You are a risk analyst scoring {{riskCount}} identified risks for {{orgName}}.

Risk items:
{{riskItems}}

Current controls:
{{controls}}

For each risk, calculate:
- Likelihood (1-5): Based on threat landscape and control gaps
- Impact (1-5): Based on data sensitivity and business criticality
- Inherent Risk Score: Likelihood × Impact
- Control Effectiveness (0-1): How well existing controls mitigate
- Residual Risk Score: Inherent × (1 - Control Effectiveness)

Return structured JSON matching the RiskMatrix schema.`,
    inputVariables: ['riskCount', 'orgName', 'riskItems', 'controls'],
    lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
    usageCount: 156, avgCostUsd: 0.028, isActive: true,
  },
  {
    id: 'p4', agentName: 'ScopingAgent', taskType: 'scope_definition',
    version: 'v2.1', purpose: 'Define system scope for compliance audit',
    content: `You are a compliance scoping expert defining the audit boundary for {{frameworkType}}.

Connected systems and integrations:
{{integrations}}

For SOC 2 scoping, determine:
1. Systems in scope (with business justification)
2. Systems out of scope (with exclusion rationale)
3. Applicable Trust Service Categories
4. Data types in scope
5. Ambiguous items requiring human review

Be conservative — when uncertain, include in scope and flag as ambiguous.

Return as structured JSON matching the ScopeDocument schema.`,
    inputVariables: ['frameworkType', 'integrations'],
    lastUsedAt: new Date(Date.now() - 900000).toISOString(),
    usageCount: 287, avgCostUsd: 0.031, isActive: true,
  },
];

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({ prompt }: { prompt: PromptTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(prompt.content);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-white">{prompt.agentName}</p>
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-800">
              {prompt.version}
            </span>
            {prompt.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-900">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{prompt.purpose}</p>
        </div>
        <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
          <div>
            <p className="text-xs text-gray-600">Uses</p>
            <p className="text-sm font-semibold text-gray-300">{(prompt.usageCount ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Avg cost</p>
            <p className="text-sm font-semibold text-amber-400">${(prompt.avgCostUsd ?? 0).toFixed(3)}</p>
          </div>
          {prompt.lastUsedAt && (
            <div>
              <p className="text-xs text-gray-600">Last used</p>
              <p className="text-xs text-gray-400">{timeAgo(prompt.lastUsedAt)}</p>
            </div>
          )}
        </div>
        <ChevronRight className={cn('w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform', expanded && 'rotate-90')} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          {/* Variables */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Input Variables</p>
            <div className="flex flex-wrap gap-1.5">
              {prompt.inputVariables.map((v) => (
                <span key={v} className="text-xs font-mono bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-purple-400">
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>

          {/* Prompt content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prompt Template</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={copy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {!editing
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
                      <button
                        onClick={() => setEditing(false)}
                        className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        <Save className="w-3 h-3" /> Save Draft
                      </button>
                      <button
                        onClick={() => { setContent(prompt.content); setEditing(false); }}
                        className="text-xs text-gray-600 hover:text-gray-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
              </div>
            </div>

            {editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                           text-xs text-gray-200 font-mono focus:outline-none focus:ring-2
                           focus:ring-indigo-500 resize-none"
              />
            ) : (
              <pre className="bg-gray-800/60 border border-gray-800 rounded-lg px-4 py-3
                              text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto">
                {content}
              </pre>
            )}
          </div>

          {editing && (
            <div className="bg-amber-900/20 border border-amber-900 rounded-lg px-3 py-2 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Editing a prompt template creates a new draft version. Deploy via the version manager after testing.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PromptLabPage() {
  const [search, setSearch] = useState('');

  const { data: prompts = [] } = useQuery<PromptTemplate[]>({
    queryKey: ['internal-prompts'],
    queryFn: () => internalApi.get('/internal/prompts').then((r) => r.data),
  });

  const all = prompts;
  const filtered = search.trim()
    ? all.filter((p) => p.agentName.toLowerCase().includes(search.toLowerCase()) || p.purpose.toLowerCase().includes(search.toLowerCase()))
    : all;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white">Prompt Lab</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {all.length} active templates · Version-controlled prompt registry
          </p>
        </div>
        <input
          type="text"
          placeholder="Search prompts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-900 border border-gray-800 rounded-lg px-3.5 py-2 text-sm text-gray-200
                     placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
        />
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <PromptCard key={p.id} prompt={p} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-600">No prompts match your search.</p>
        </div>
      )}
    </div>
  );
}
