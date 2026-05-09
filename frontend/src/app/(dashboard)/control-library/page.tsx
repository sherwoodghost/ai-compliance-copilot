'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { controlsApi } from '@/lib/api/controls';
import { apiClient } from '@/lib/api/client';
import {
  Library, Search, Shield, CheckCircle, AlertCircle,
  ChevronDown, ChevronRight, Sparkles, X, Clock,
  Zap, AlertTriangle, Wrench, Lightbulb, BookOpen,
  Building2, Bot, UserCheck, UserCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Control = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  weight: number;
  framework: { name: string; type: string };
  libraryMeta?: { domain?: { name: string; code: string } };
  evidenceRequirements: Array<{ evidenceType: string; description: string; isMandatory: boolean }>;
  policyRequirements: Array<{ policyName: string; description: string }>;
};

type ExplainResult = {
  code: string;
  title: string;
  plainEnglish: string;
  whyItMatters: string;
  implementationSteps: string[];
  typicalEvidence: string[];
  commonMistakes: string[];
  timeToImplement: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relatedTools: string[];
};

const DIFFICULTY_CFG = {
  easy:   { label: 'Easy',   cls: 'bg-green-100 text-green-700' },
  medium: { label: 'Medium', cls: 'bg-amber-100 text-amber-700' },
  hard:   { label: 'Hard',   cls: 'bg-red-100 text-red-700' },
};

type AiApplicability = {
  controlId: string;
  control: { code: string };
  companySpecificNotes?: string | null;
  implementationContext?: string | null;
  aiPriority?: string | null;
  aiConfidence?: number | null;
  requiresHumanReview?: boolean | null;
  overriddenBy?: string | null;
  assignedTo?: string | null;
  assignee?: { id: string; fullName: string; email: string } | null;
};

type Member = { id: string; fullName: string; email: string };

const AI_PRIORITY_CFG: Record<string, { cls: string; label: string }> = {
  critical: { cls: 'bg-red-100 text-red-700',    label: 'Critical for you' },
  high:     { cls: 'bg-orange-100 text-orange-700', label: 'High priority' },
  medium:   { cls: 'bg-amber-100 text-amber-700',  label: 'Medium priority' },
  low:      { cls: 'bg-gray-100 text-gray-500',   label: 'Lower priority' },
};

function ExplainPanel({ result, onClose }: { result: ExplainResult; onClose: () => void }) {
  const diff = DIFFICULTY_CFG[result.difficulty] ?? DIFFICULTY_CFG.medium;
  return (
    <div className="border border-purple-200 rounded-xl bg-purple-50 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <span className="text-sm font-semibold text-purple-900">AI Explanation — [{result.code}] {result.title}</span>
        </div>
        <button onClick={onClose} className="text-purple-400 hover:text-purple-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meta chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded', diff.cls)}>
          {diff.label} difficulty
        </span>
        {result.timeToImplement && (
          <span className="flex items-center gap-1 text-xs text-gray-600 bg-white border border-gray-200 px-2 py-0.5 rounded">
            <Clock className="w-3 h-3" /> {result.timeToImplement}
          </span>
        )}
      </div>

      {/* Plain English */}
      {result.plainEnglish && (
        <div className="bg-white rounded-lg p-3 border border-purple-100">
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">What this means</p>
          <p className="text-sm text-gray-800">{result.plainEnglish}</p>
        </div>
      )}

      {/* Why it matters */}
      {result.whyItMatters && (
        <div className="bg-white rounded-lg p-3 border border-purple-100">
          <div className="flex items-center gap-1.5 mb-1">
            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Why auditors care</p>
          </div>
          <p className="text-sm text-gray-700">{result.whyItMatters}</p>
        </div>
      )}

      {/* 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Implementation steps */}
        {result.implementationSteps.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="w-3.5 h-3.5 text-green-500" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">How to implement</p>
            </div>
            <ol className="space-y-1.5">
              {result.implementationSteps.map((step, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-700">
                  <span className="font-bold text-green-600 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Typical evidence */}
        {result.typicalEvidence.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3.5 h-3.5 text-blue-500" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Typical evidence</p>
            </div>
            <ul className="space-y-1.5">
              {result.typicalEvidence.map((ev, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-700">
                  <CheckCircle className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                  <span>{ev}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Common mistakes */}
        {result.commonMistakes.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Common mistakes</p>
            </div>
            <ul className="space-y-1.5">
              {result.commonMistakes.map((m, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-700">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  <span>{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Related tools */}
      {result.relatedTools.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Wrench className="w-3.5 h-3.5 text-gray-500" />
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tools that help</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.relatedTools.map((tool, i) => (
              <span key={i} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded">
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ControlRow({ control, expanded, onToggle, aiData, members, onAssignOwner }: {
  control: Control;
  expanded: boolean;
  onToggle: () => void;
  aiData?: AiApplicability;
  members?: Member[];
  onAssignOwner?: (controlId: string, ownerId: string | null) => void;
}) {
  const [explaining, setExplaining] = useState(false);
  const [explainResult, setExplainResult] = useState<ExplainResult | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);

  async function handleExplain(e: React.MouseEvent) {
    e.stopPropagation();
    if (explainResult) { setExplainResult(null); return; }
    setExplaining(true);
    try {
      const res = await controlsApi.aiExplainControl(control.code);
      setExplainResult(res as unknown as ExplainResult);
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Row header — use div to avoid button-in-button HTML violation */}
      <div className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
        {/* Toggle area — covers everything except the AI Explain button */}
        <button
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
          <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded shrink-0">
            {control.code}
          </span>
          <span className="text-sm font-medium text-gray-900 flex-1 truncate">{control.title}</span>
          <span className="text-xs text-gray-400 shrink-0 mr-2">{control.framework.type}</span>
        </button>
        {/* AI Explain button — sibling, not nested inside the toggle button */}
        <button
          onClick={handleExplain}
          disabled={explaining}
          className={cn(
            'flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors shrink-0',
            explainResult
              ? 'bg-purple-600 text-white border-purple-600'
              : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
          )}
        >
          {explaining ? (
            <span className="animate-spin w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {explaining ? 'Explaining…' : explainResult ? 'Hide' : 'Explain'}
        </button>
      </div>

      {(expanded || explainResult) && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          {/* AI explain panel — shown regardless of expand state */}
          {explainResult && (
            <ExplainPanel result={explainResult} onClose={() => setExplainResult(null)} />
          )}

          {expanded && (
            <>
              <p className="text-sm text-gray-700">{control.description}</p>

              {/* "How this applies to you" panel — shown when AI enrichment data is available */}
              {aiData?.companySpecificNotes && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">How this applies to your company</p>
                    </div>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium shrink-0',
                      aiData.overriddenBy
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-blue-100 text-blue-600 border border-blue-200',
                    )}>
                      {aiData.overriddenBy
                        ? <><UserCheck className="w-3 h-3" /> Human-Reviewed</>
                        : <><Bot className="w-3 h-3" /> AI-Assessed</>}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{aiData.companySpecificNotes}</p>

                  {aiData.implementationContext && (
                    <div className="mt-2 pt-2 border-t border-blue-100">
                      <p className="text-xs font-medium text-blue-600 mb-0.5">Implementation for your stack:</p>
                      <p className="text-xs text-gray-600">{aiData.implementationContext}</p>
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    {aiData.aiPriority && AI_PRIORITY_CFG[aiData.aiPriority] && (
                      <span className={cn('text-xs px-2 py-0.5 rounded font-medium', AI_PRIORITY_CFG[aiData.aiPriority].cls)}>
                        {AI_PRIORITY_CFG[aiData.aiPriority].label}
                      </span>
                    )}
                    {typeof aiData.aiConfidence === 'number' && (
                      <span className="text-xs text-gray-400">AI Confidence: {aiData.aiConfidence}%</span>
                    )}
                    {aiData.requiresHumanReview && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="w-3 h-3" /> Needs your review
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Inline owner assignment */}
              {onAssignOwner && (
                <div className="relative">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Control Owner</p>
                  <button
                    onClick={() => setOwnerOpen((v) => !v)}
                    className="flex items-center gap-2 text-sm bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:border-brand-300 transition-colors min-w-[180px]"
                  >
                    <UserCircle2 className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className={cn('flex-1 text-left truncate', aiData?.assignee ? 'text-gray-900' : 'text-gray-400')}>
                      {aiData?.assignee?.fullName ?? 'Unassigned'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  </button>

                  {ownerOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden">
                      <div className="py-1 max-h-52 overflow-y-auto">
                        <button
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-gray-500"
                          onClick={() => { onAssignOwner(control.id, null); setOwnerOpen(false); }}
                        >
                          <UserCircle2 className="w-4 h-4 shrink-0" />
                          Unassigned
                        </button>
                        {(members ?? []).map((m) => (
                          <button
                            key={m.id}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50',
                              aiData?.assignedTo === m.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700',
                            )}
                            onClick={() => { onAssignOwner(control.id, m.id); setOwnerOpen(false); }}
                          >
                            <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-brand-600">{m.fullName?.[0] ?? '?'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block truncate">{m.fullName}</span>
                            </div>
                            {aiData?.assignedTo === m.id && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {control.evidenceRequirements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evidence Required</p>
                  <div className="space-y-1">
                    {control.evidenceRequirements.map((er, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        {er.isMandatory
                          ? <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                          : <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />}
                        <span><span className="font-medium">{er.evidenceType}</span>: {er.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {control.policyRequirements.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Policies Required</p>
                  <div className="space-y-1">
                    {control.policyRequirements.map((pr, i) => (
                      <div key={i} className="text-xs text-gray-600">
                        <span className="font-medium">{pr.policyName}</span>
                        {pr.description && <span className="text-gray-400"> — {pr.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ControlLibraryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState<'all' | 'SOC2' | 'ISO27001'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: controls = [], isLoading } = useQuery<Control[]>({
    queryKey: ['control-library'],
    queryFn: () => controlsApi.getLibrary() as unknown as Promise<Control[]>,
  });

  // AI enrichment: company-specific applicability notes + owner data
  const { data: applicabilityMatrix } = useQuery<AiApplicability[]>({
    queryKey: ['applicability-matrix'],
    queryFn: () => apiClient.get<AiApplicability[]>('/controls/library/applicability').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  // Team members for owner assignment dropdown
  const { data: membersData } = useQuery({
    queryKey: ['org-members-brief'],
    queryFn: () => apiClient.get<{ id: string; fullName: string; email: string }[]>('/organizations/me/members').then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });
  const members: Member[] = (membersData as any[] ?? []).map((m: any) => ({
    id: m.id,
    fullName: m.fullName ?? m.full_name ?? m.name ?? 'Unknown',
    email: m.email ?? '',
  }));

  const assignOwnerMutation = useMutation({
    mutationFn: ({ controlId, ownerId }: { controlId: string; ownerId: string | null }) =>
      apiClient.patch(`/controls/library/applicability/${controlId}/owner`, { ownerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applicability-matrix'] }),
  });

  const aiLookup = new Map<string, AiApplicability>(
    (applicabilityMatrix ?? []).map((a) => [a.control.code, a]),
  );
  // Build controlId → AiApplicability map for owner assignment (keyed by controlId)
  const aiByControlId = new Map<string, AiApplicability>(
    (applicabilityMatrix ?? []).map((a) => [a.controlId, a]),
  );

  const filtered = controls.filter((c) => {
    const matchesFramework = filterFramework === 'all' || c.framework.type === filterFramework;
    const matchesSearch = !search ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchesFramework && matchesSearch;
  });

  const soc2Count = controls.filter((c) => c.framework.type === 'SOC2').length;
  const isoCount = controls.filter((c) => c.framework.type === 'ISO27001').length;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
            <Library className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Control Library</h1>
            <p className="text-sm text-gray-500">Canonical source of truth — {controls.length} controls</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">SOC 2: {soc2Count}</span>
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">ISO 27001: {isoCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg">
            <Lightbulb className="w-3.5 h-3.5" />
            <span>Click <strong>Explain</strong> on any control for AI guidance</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search by code, title, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'SOC2', 'ISO27001'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFramework(f)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                filterFramework === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-gray-500">{filtered.length} of {controls.length} controls match "{search}"</p>
      )}

      {/* Control list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((control) => (
            <ControlRow
              key={control.id}
              control={control}
              expanded={expanded.has(control.id)}
              onToggle={() => toggleExpanded(control.id)}
              aiData={aiLookup.get(control.code)}
              members={members}
              onAssignOwner={(controlId, ownerId) => assignOwnerMutation.mutate({ controlId, ownerId })}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Library className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No controls found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
