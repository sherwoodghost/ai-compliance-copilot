'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import Cookies from 'js-cookie';
import {
  FileText, ChevronRight, Play, Clock, CheckCircle,
  Copy, Check, Hash, Edit3, Save, X, Sparkles, Activity,
  DollarSign, Terminal, BookOpen,
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
  userPromptTemplate: string | null;
  inputVariables: string[];
  lastUsedAt?: string | null;
  usageCount: number;
  avgCostUsd: number;
  isActive: boolean;
};

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  ScopingAgent:          { label: 'Core',           color: 'bg-violet-900/50 text-violet-300 border-violet-800' },
  OnboardingAgent:       { label: 'Core',           color: 'bg-violet-900/50 text-violet-300 border-violet-800' },
  GapAnalysisAgent:      { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  EvidenceAgent:         { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  PolicyAgent:           { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  ReviewAgent:           { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  InterviewAgent:        { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  BenchmarkAgent:        { label: 'Assessment',     color: 'bg-blue-900/50 text-blue-300 border-blue-800' },
  RiskScoringAgent:      { label: 'Risk',           color: 'bg-rose-900/50 text-rose-300 border-rose-800' },
  VendorRiskAgent:       { label: 'Risk',           color: 'bg-rose-900/50 text-rose-300 border-rose-800' },
  ThreatIntelAgent:      { label: 'Risk',           color: 'bg-rose-900/50 text-rose-300 border-rose-800' },
  RemediationAdvisorAgent:{ label: 'Guidance',      color: 'bg-amber-900/50 text-amber-300 border-amber-800' },
  PlannerAgent:          { label: 'Guidance',       color: 'bg-amber-900/50 text-amber-300 border-amber-800' },
  DriftDetectorAgent:    { label: 'Monitoring',     color: 'bg-cyan-900/50 text-cyan-300 border-cyan-800' },
  AuditAgent:            { label: 'Monitoring',     color: 'bg-cyan-900/50 text-cyan-300 border-cyan-800' },
  ControlMapperAgent:    { label: 'Infrastructure', color: 'bg-gray-800 text-gray-400 border-gray-700' },
  DashboardAgent:        { label: 'Infrastructure', color: 'bg-gray-800 text-gray-400 border-gray-700' },
  InferenceAgent:        { label: 'Infrastructure', color: 'bg-gray-800 text-gray-400 border-gray-700' },
  ValidatorAgent:        { label: 'Infrastructure', color: 'bg-gray-800 text-gray-400 border-gray-700' },
  TaskAgent:             { label: 'Orchestration',  color: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
  ReviewerAgent:         { label: 'Orchestration',  color: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
};

function categoryFor(agent: string) {
  return CATEGORY_MAP[agent] ?? { label: 'Other', color: 'bg-gray-800 text-gray-400 border-gray-700' };
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({ prompt }: { prompt: PromptTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'system' | 'user'>('system');
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(prompt.content);
  const [copied, setCopied] = useState(false);

  const activeContent = tab === 'system' ? content : (prompt.userPromptTemplate ?? '');

  function copy() {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const cat = categoryFor(prompt.agentName);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-800/30 transition-colors"
      >
        <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-semibold text-white">{prompt.agentName}</p>
            <span className={cn('text-xs px-1.5 py-0.5 rounded border', cat.color)}>
              {cat.label}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/50 text-indigo-400 border border-indigo-800">
              {prompt.version}
            </span>
            {prompt.isActive && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-900 flex items-center gap-1">
                <CheckCircle className="w-2.5 h-2.5" /> Active
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{prompt.purpose}</p>
        </div>
        <div className="hidden sm:flex items-center gap-5 shrink-0 text-right">
          <div>
            <p className="text-xs text-gray-600 flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> Uses</p>
            <p className="text-sm font-semibold text-gray-300">{(Number(prompt.usageCount) || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600 flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" /> Avg cost</p>
            <p className="text-sm font-semibold text-amber-400">${(Number(prompt.avgCostUsd) || 0).toFixed(3)}</p>
          </div>
          {prompt.lastUsedAt && (
            <div>
              <p className="text-xs text-gray-600 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Last used</p>
              <p className="text-xs text-gray-400">{timeAgo(prompt.lastUsedAt)}</p>
            </div>
          )}
          {!prompt.lastUsedAt && (
            <div>
              <p className="text-xs text-gray-600">Last used</p>
              <p className="text-xs text-gray-600">Never</p>
            </div>
          )}
        </div>
        <ChevronRight className={cn('w-3.5 h-3.5 text-gray-600 shrink-0 transition-transform', expanded && 'rotate-90')} />
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 space-y-4">
          {/* Variables */}
          {prompt.inputVariables.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Hash className="w-3 h-3" /> Input Variables
              </p>
              <div className="flex flex-wrap gap-1.5">
                {prompt.inputVariables.map((v) => (
                  <span key={v} className="text-xs font-mono bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-purple-400">
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-800 pb-1">
            <button
              onClick={() => setTab('system')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors',
                tab === 'system'
                  ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-800 border-b-transparent'
                  : 'text-gray-500 hover:text-gray-400',
              )}
            >
              <Terminal className="w-3 h-3" /> System Prompt
            </button>
            {prompt.userPromptTemplate && (
              <button
                onClick={() => setTab('user')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors',
                  tab === 'user'
                    ? 'bg-emerald-900/30 text-emerald-300 border border-emerald-900 border-b-transparent'
                    : 'text-gray-500 hover:text-gray-400',
                )}
              >
                <BookOpen className="w-3 h-3" /> User Template
              </button>
            )}
          </div>

          {/* Prompt content */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {tab === 'system' ? 'Behavioral Instructions' : 'User Message Template'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={copy}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                {tab === 'system' && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Draft
                  </button>
                )}
                {tab === 'system' && editing && (
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

            {tab === 'system' && editing ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3
                           text-xs text-gray-200 font-mono focus:outline-none focus:ring-2
                           focus:ring-indigo-500 resize-none"
              />
            ) : (
              <pre className="bg-gray-800/60 border border-gray-800 rounded-lg px-4 py-3
                              text-xs text-gray-300 font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                {tab === 'system' ? content : (prompt.userPromptTemplate ?? '')}
              </pre>
            )}
          </div>

          {editing && (
            <div className="bg-amber-900/20 border border-amber-900 rounded-lg px-3 py-2 flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                Editing creates a local draft only. To deploy a new version, push changes to the seed file and re-run <code className="bg-gray-800 px-1 rounded">npx prisma db seed</code>.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Core', 'Assessment', 'Risk', 'Guidance', 'Monitoring', 'Infrastructure', 'Orchestration'];

export default function PromptLabPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const { data: prompts = [], isLoading } = useQuery<PromptTemplate[]>({
    queryKey: ['internal-prompts'],
    queryFn: () => internalApi.get('/internal/prompts').then((r) => r.data),
  });

  const filtered = prompts.filter((p) => {
    const matchSearch = !search.trim()
      || p.agentName.toLowerCase().includes(search.toLowerCase())
      || p.purpose.toLowerCase().includes(search.toLowerCase())
      || p.taskType.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'All'
      || categoryFor(p.agentName).label === activeCategory;
    return matchSearch && matchCat;
  });

  const totalUsage = prompts.reduce((s, p) => s + (Number(p.usageCount) || 0), 0);
  const totalCost = prompts.reduce((s, p) => s + (Number(p.avgCostUsd) || 0) * (Number(p.usageCount) || 0), 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-white">Prompt Lab</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {prompts.length} active templates · {totalUsage.toLocaleString()} total calls · ${totalCost.toFixed(2)} total spend
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

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const count = cat === 'All'
            ? prompts.length
            : prompts.filter((p) => categoryFor(p.agentName).label === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors',
                activeCategory === cat
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700',
              )}
            >
              {cat} <span className="opacity-60 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <PromptCard key={p.id} prompt={p} />
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-8 h-8 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No prompts match your search.</p>
        </div>
      )}
    </div>
  );
}
