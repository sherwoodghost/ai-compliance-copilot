'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import {
  ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle, FileText,
  ClipboardList, AlertTriangle, Shield, User, Calendar,
  ChevronDown, ChevronRight, Sparkles, Upload, Plus, Link as LinkIcon,
  ArrowLeftRight, Edit3, Save, X, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ControlDetail = {
  controlId: string;
  status: string;
  score: number | null;
  notes: string | null;
  dueDate: string | null;
  lastReviewedAt: string | null;
  assignee?: { id: string; fullName: string; email: string } | null;
  control: {
    id: string;
    code: string;
    title: string;
    description: string;
    category: string;
    guidance?: string;
    weight: number;
    framework: { id: string; name: string; type: string };
  };
  evidence: Array<{
    id: string;
    title: string;
    type: string;
    source: string;
    isValid: boolean;
    collectedAt: string;
    expiresAt?: string;
    storageUrl?: string;
    metadata?: {
      aiConfidence?: number;
      aiSummary?: string;
      aiFlags?: string[];
      fileName?: string;
    };
  }>;
  policies: Array<{
    id: string;
    title: string;
    status: string;
    version: number;
    updatedAt: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
    assignee?: { id: string; fullName: string } | null;
  }>;
  riskItems: Array<{
    id: string;
    title: string;
    severity: string;
    status: string;
    riskScore: number;
  }>;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  implemented:    { label: 'Implemented',    cls: 'bg-green-100 text-green-800 border-green-200',  icon: CheckCircle },
  in_progress:    { label: 'In Progress',    cls: 'bg-blue-100 text-blue-800 border-blue-200',    icon: Clock },
  not_started:    { label: 'Not Started',    cls: 'bg-gray-100 text-gray-600 border-gray-200',    icon: XCircle },
  failed:         { label: 'Failed',         cls: 'bg-red-100 text-red-800 border-red-200',       icon: XCircle },
  not_applicable: { label: 'N/A',            cls: 'bg-gray-50 text-gray-500 border-gray-200',     icon: AlertCircle },
};

const PRIORITY_CFG: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-gray-100 text-gray-500',
};

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title, count, icon: Icon, defaultOpen = true, children,
}: {
  title: string; count?: number; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-900 flex-1 text-left">{title}</span>
        {count != null && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{count}</span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100">{children}</div>}
    </div>
  );
}

// ─── Inline status editor ─────────────────────────────────────────────────────

function StatusEditor({ controlId, current, onSaved }: { controlId: string; current: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(current);
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: () => api.patch(`/controls/${controlId}`, { status }).then((r: any) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['control-detail', controlId] }); setEditing(false); onSaved(); },
  });

  if (!editing) {
    const cfg = STATUS_CFG[current] ?? STATUS_CFG.not_started;
    const Icon = cfg.icon;
    return (
      <button
        onClick={() => setEditing(true)}
        className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border font-medium hover:opacity-80 transition-opacity', cfg.cls)}
      >
        <Icon className="w-3 h-3" />
        {cfg.label}
        <Edit3 className="w-2.5 h-2.5 ml-0.5 opacity-60" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
        autoFocus
      >
        {Object.entries(STATUS_CFG).map(([val, { label }]) => (
          <option key={val} value={val}>{label}</option>
        ))}
      </select>
      <button onClick={() => save.mutate()} disabled={save.isPending} className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors">
        <Save className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Evidence card ────────────────────────────────────────────────────────────

function EvidenceItem({ item }: { item: ControlDetail['evidence'][0] }) {
  const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();
  const expiringSoon = item.expiresAt && !isExpired &&
    new Date(item.expiresAt) < new Date(Date.now() + 30 * 86400_000);
  const confidence = item.metadata?.aiConfidence;

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border',
      !item.isValid ? 'border-amber-200 bg-amber-50' :
      isExpired ? 'border-red-200 bg-red-50' :
      expiringSoon ? 'border-amber-200 bg-amber-50' :
      'border-gray-100 bg-gray-50',
    )}>
      <div className="shrink-0 mt-0.5">
        {!item.isValid ? <Upload className="w-3.5 h-3.5 text-amber-500" /> :
         isExpired ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
         <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{item.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400 capitalize">{item.type?.replace(/_/g, ' ')}</span>
          {item.source && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">
              <LinkIcon className="w-2.5 h-2.5" />
              {item.source === 'manual_upload' ? 'upload' : item.source.replace(/_/g, ' ')}
            </span>
          )}
          {item.metadata?.fileName && (
            <span className="text-xs text-blue-600">{item.metadata.fileName}</span>
          )}
        </div>
        {confidence != null && (
          <div className={cn(
            'flex items-center gap-1 text-xs mt-1.5 px-1.5 py-0.5 rounded w-fit',
            confidence >= 80 ? 'bg-green-100 text-green-700' :
            confidence >= 50 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700',
          )}>
            <Sparkles className="w-2.5 h-2.5" />
            {confidence >= 80 ? 'High' : confidence >= 50 ? 'Medium' : 'Low'} confidence ({confidence}%)
          </div>
        )}
        {(item.metadata?.aiFlags?.length ?? 0) > 0 && (
          <ul className="mt-1 space-y-0.5">
            {item.metadata!.aiFlags!.map((f, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                <span className="shrink-0">•</span>{f}
              </li>
            ))}
          </ul>
        )}
        {isExpired && <p className="text-xs text-red-600 mt-0.5 font-medium">Expired {new Date(item.expiresAt!).toLocaleDateString()}</p>}
        {expiringSoon && <p className="text-xs text-amber-600 mt-0.5">Expires {new Date(item.expiresAt!).toLocaleDateString()}</p>}
      </div>
      {item.storageUrl && (
        <a href={item.storageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-brand-600 hover:text-brand-700">
          <FileText className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ImplementationGuide = {
  guide: string;
  steps: string[];
  toolSpecific: string[];
  estimatedEffort: string;
  controlCode: string;
  controlTitle: string;
};

export default function ControlDetailPage() {
  const { controlId } = useParams<{ controlId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [aiGuide, setAiGuide] = useState<ImplementationGuide | null>(null);
  const [guideLoading, setGuideLoading] = useState(false);

  const { data, isLoading, isError } = useQuery<ControlDetail>({
    queryKey: ['control-detail', controlId],
    queryFn: () => api.get(`/controls/${controlId}`).then((r: any) => r.data),
    enabled: !!controlId,
  });

  async function fetchImplementationGuide() {
    if (!controlId || guideLoading) return;
    setGuideLoading(true);
    try {
      const res = await api.post(`/controls/${controlId}/implementation-guide`, {});
      setAiGuide((res as any).data);
    } catch {
      setAiGuide({ guide: 'Failed to generate guide — please try again.', steps: [], toolSpecific: [], estimatedEffort: 'Unknown', controlCode: '', controlTitle: '' });
    } finally {
      setGuideLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-64" />
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-48 bg-gray-100 rounded" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-12 text-center">
          <AlertTriangle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Control not found or access denied.</p>
          <Link href="/controls" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Controls
          </Link>
        </div>
      </div>
    );
  }

  const { control, evidence, policies, tasks, riskItems } = data;
  const isCrosswalkCredit = typeof data.notes === 'string' && data.notes.toLowerCase().includes('crosswalk');
  const validEvidence = evidence.filter((e) => e.isValid);
  const expiredEvidence = evidence.filter((e) => e.isValid && e.expiresAt && new Date(e.expiresAt) < new Date());
  const aiIssues = evidence.filter((e) => (e.metadata?.aiFlags?.length ?? 0) > 0 || (e.metadata?.aiConfidence != null && e.metadata.aiConfidence < 50));

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Back nav */}
      <Link href="/controls" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        All Controls
      </Link>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                {control.code}
              </span>
              <span className="text-xs text-gray-400">{control.framework.name}</span>
              <span className="text-xs bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded">
                {control.category}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{control.title}</h1>
          </div>
          <StatusEditor
            controlId={controlId}
            current={data.status}
            onSaved={() => qc.invalidateQueries({ queryKey: ['controls'] })}
          />
        </div>

        {isCrosswalkCredit && (
          <div className="flex items-center gap-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 w-fit mb-3">
            <ArrowLeftRight className="w-3 h-3" />
            Auto-credited via framework crosswalk
          </div>
        )}

        <p className="text-sm text-gray-600 leading-relaxed mb-4">{control.description}</p>

        {control.guidance && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
              <Shield className="w-3 h-3" /> Implementation Guidance
            </p>
            <p className="text-xs text-blue-700 leading-relaxed">{control.guidance}</p>
          </div>
        )}

        {/* AI Implementation Guide */}
        {!aiGuide ? (
          <button
            onClick={fetchImplementationGuide}
            disabled={guideLoading}
            className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-2 mb-4 transition-colors disabled:opacity-60"
          >
            <Sparkles className={cn('w-3.5 h-3.5', guideLoading && 'animate-pulse')} />
            {guideLoading ? 'Generating tailored implementation guide…' : 'Get AI implementation guide for your stack'}
          </button>
        ) : (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-indigo-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                AI Implementation Guide
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  ~{aiGuide.estimatedEffort}
                </span>
                <button
                  onClick={() => { setAiGuide(null); fetchImplementationGuide(); }}
                  className="text-indigo-400 hover:text-indigo-600 transition-colors"
                  title="Regenerate"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed">{aiGuide.guide}</p>
            {aiGuide.steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-indigo-700 mb-1.5">Implementation steps</p>
                <ol className="space-y-1.5">
                  {aiGuide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-indigo-800">
                      <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[10px]">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {aiGuide.toolSpecific.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-indigo-700 mb-1.5">Tool-specific tips</p>
                <ul className="space-y-1">
                  {aiGuide.toolSpecific.map((tip, i) => (
                    <li key={i} className="text-xs text-indigo-800 flex items-start gap-1.5">
                      <span className="text-indigo-400 shrink-0 mt-0.5">→</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
          {data.assignee && (
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              <span className="text-gray-600 font-medium">{data.assignee.fullName}</span>
            </span>
          )}
          {data.dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Due {new Date(data.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
          {data.score != null && (
            <span>Score: <span className="text-gray-700 font-semibold">{data.score}%</span></span>
          )}
          {data.lastReviewedAt && (
            <span>Last reviewed: {new Date(data.lastReviewedAt).toLocaleDateString()}</span>
          )}
          {data.notes && !isCrosswalkCredit && (
            <span className="text-gray-500 italic truncate max-w-xs">{data.notes}</span>
          )}
        </div>
      </div>

      {/* Quick summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Evidence', value: validEvidence.length, sub: expiredEvidence.length > 0 ? `${expiredEvidence.length} expired` : 'all valid', color: expiredEvidence.length > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'AI Issues', value: aiIssues.length, sub: 'in evidence', color: aiIssues.length > 0 ? 'text-amber-600' : 'text-green-600' },
          { label: 'Open Tasks', value: tasks.filter(t => t.status !== 'done').length, sub: `${tasks.length} total`, color: tasks.filter(t => t.status !== 'done').length > 0 ? 'text-orange-600' : 'text-gray-500' },
          { label: 'Open Risks', value: riskItems.filter(r => r.status === 'open').length, sub: 'linked risks', color: riskItems.filter(r => r.status === 'open').length > 0 ? 'text-red-600' : 'text-gray-500' },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={cn('text-2xl font-bold mt-0.5', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Evidence */}
      <Section title="Evidence" count={evidence.length} icon={FileText}>
        {evidence.length === 0 ? (
          <div className="py-8 text-center">
            <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No evidence collected yet.</p>
            <Link href="/evidence" className="btn-primary mt-3 inline-flex items-center gap-2 text-xs">
              <Upload className="w-3.5 h-3.5" /> Upload Evidence
            </Link>
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {evidence.map((e) => <EvidenceItem key={e.id} item={e} />)}
            <div className="pt-2">
              <Link href={`/evidence`} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Upload more evidence for this control
              </Link>
            </div>
          </div>
        )}
      </Section>

      {/* Policies */}
      <Section title="Policies" count={policies.length} icon={Shield} defaultOpen={policies.length > 0}>
        {policies.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">No policies linked.</p>
            <Link href="/policies" className="text-xs text-brand-600 hover:text-brand-700 mt-2 inline-flex items-center gap-1 font-medium">
              <Plus className="w-3.5 h-3.5" /> Create or link a policy
            </Link>
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {policies.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-800 truncate">{p.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-400">v{p.version}</span>
                  <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', p.status === 'approved' ? 'bg-green-100 text-green-700' : p.status === 'draft' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700')}>
                    {p.status}
                  </span>
                  <Link href="/policies" className="text-brand-600 hover:text-brand-700">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Tasks */}
      <Section title="Tasks" count={tasks.length} icon={ClipboardList} defaultOpen={tasks.length > 0}>
        {tasks.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-400">No open tasks for this control.</p>
          </div>
        ) : (
          <div className="space-y-2 pt-4">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', t.priority === 'critical' ? 'bg-red-500' : t.priority === 'high' ? 'bg-orange-400' : t.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300')} />
                <span className="text-xs font-medium text-gray-800 flex-1 truncate">{t.title}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', PRIORITY_CFG[t.priority] ?? 'bg-gray-100 text-gray-500')}>{t.priority}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', t.status === 'done' ? 'bg-green-100 text-green-700' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : t.status === 'blocked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500')}>
                  {t.status.replace('_', ' ')}
                </span>
                {t.dueDate && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
                {t.assignee && (
                  <span className="text-xs text-gray-400 truncate max-w-[80px] shrink-0">{t.assignee.fullName.split(' ')[0]}</span>
                )}
              </div>
            ))}
            <div className="pt-1">
              <Link href="/tasks" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium">
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" /> Manage in Tasks
              </Link>
            </div>
          </div>
        )}
      </Section>

      {/* Risk Items */}
      {riskItems.length > 0 && (
        <Section title="Linked Risks" count={riskItems.length} icon={AlertTriangle} defaultOpen>
          <div className="space-y-2 pt-4">
            {riskItems.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-red-100 bg-red-50">
                <AlertTriangle className={cn('w-3.5 h-3.5 shrink-0', r.severity === 'critical' ? 'text-red-600' : r.severity === 'high' ? 'text-orange-500' : 'text-amber-500')} />
                <span className="text-xs font-medium text-gray-800 flex-1 truncate">{r.title}</span>
                <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', r.severity === 'critical' ? 'bg-red-100 text-red-700' : r.severity === 'high' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700')}>
                  {r.severity}
                </span>
                <span className="text-xs text-gray-500 font-mono">Score: {r.riskScore}</span>
              </div>
            ))}
            <div className="pt-1">
              <Link href="/risks" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium">
                <ArrowLeft className="w-3.5 h-3.5 rotate-180" /> Manage in Risk Register
              </Link>
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
