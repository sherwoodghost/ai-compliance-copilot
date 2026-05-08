'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { controlsApi } from '@/lib/api/controls';
import {
  AlertTriangle, CheckCircle, Clock, XCircle, Plus, X,
  Shield, ChevronDown, Filter, Search, FileText, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExceptionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

type ControlException = {
  id: string;
  controlId: string;
  title: string;
  justification: string;
  compensatingControl?: string;
  status: ExceptionStatus;
  expiresAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  control: { id: string; code: string; title: string; category: string };
  riskOwner?: { id: string; fullName: string; email: string };
  reviewer?: { id: string; fullName: string; email: string };
};

type ExceptionStats = { total: number; pending: number; approved: number; expired: number };

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ExceptionStatus, {
  label: string; icon: React.ElementType; cls: string; dot: string;
}> = {
  pending:  { label: 'Pending',  icon: Clock,         cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  approved: { label: 'Approved', icon: CheckCircle,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', icon: XCircle,       cls: 'bg-red-50 text-red-700 border-red-200',          dot: 'bg-red-500' },
  expired:  { label: 'Expired',  icon: AlertTriangle, cls: 'bg-gray-100 text-gray-600 border-gray-300',       dot: 'bg-gray-400' },
};

// ─── New Exception Form ───────────────────────────────────────────────────────

function NewExceptionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    controlId: '',
    title: '',
    justification: '',
    compensatingControl: '',
    expiresAt: '',
  });
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Fetch org controls to pick from
  const { data: controls = [] } = useQuery({
    queryKey: ['controls-list'],
    queryFn: () => controlsApi.list(),
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => controlsApi.createException(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exceptions'] });
      onClose();
    },
  });

  async function draftWithAi() {
    if (!form.controlId) return;
    setAiDrafting(true);
    setAiError(null);
    try {
      const draft = await controlsApi.aiDraftException(form.controlId);
      // Calculate expiry date from suggestedExpiryMonths
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + (draft.suggestedExpiryMonths ?? 6));
      const expiresAt = expiry.toISOString().split('T')[0];
      setForm((f) => ({
        ...f,
        title: draft.title || f.title,
        justification: draft.justification || f.justification,
        compensatingControl: draft.compensatingControl || f.compensatingControl,
        expiresAt: f.expiresAt || expiresAt,
      }));
    } catch {
      setAiError('AI draft failed — please fill in manually.');
    } finally {
      setAiDrafting(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Request Control Exception</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Control</label>
            <select
              required
              value={form.controlId}
              onChange={(e) => setForm((f) => ({ ...f, controlId: e.target.value }))}
              className="input w-full"
            >
              <option value="">Select a control…</option>
              {(controls as any[]).map((c: any) => (
                <option key={c.controlId ?? c.id} value={c.controlId ?? c.id}>
                  {c.control?.code ?? c.code} — {c.control?.title ?? c.title}
                </option>
              ))}
            </select>
          </div>

          {/* AI Draft button */}
          {form.controlId && (
            <div>
              <button
                type="button"
                onClick={draftWithAi}
                disabled={aiDrafting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
              >
                {aiDrafting
                  ? <><span className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Drafting with AI…</>
                  : <><Sparkles className="w-3.5 h-3.5" />AI Draft Justification & Compensating Control</>
                }
              </button>
              {aiError && <p className="text-xs text-red-500 mt-1">{aiError}</p>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exception Title</label>
            <input
              required
              className="input w-full"
              placeholder="Short descriptive title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Justification</label>
            <textarea
              required
              rows={3}
              className="input w-full resize-none"
              placeholder="Explain why full implementation is not feasible…"
              value={form.justification}
              onChange={(e) => setForm((f) => ({ ...f, justification: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Compensating Control <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              className="input w-full resize-none"
              placeholder="Describe any alternative controls that reduce risk…"
              value={form.compensatingControl}
              onChange={(e) => setForm((f) => ({ ...f, compensatingControl: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              className="input w-full"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-600">Failed to submit exception. Please try again.</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Exception Card ───────────────────────────────────────────────────────────

function ExceptionCard({ exception }: { exception: ControlException }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[exception.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  const approveMutation = useMutation({
    mutationFn: () => controlsApi.updateException(exception.id, { status: 'approved' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exceptions'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: () => controlsApi.updateException(exception.id, { status: 'rejected', rejectionReason: 'Rejected by reviewer' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exceptions'] }),
  });

  const isExpired = exception.expiresAt && new Date(exception.expiresAt) < new Date();

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className={cn('mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0', cfg.cls.split(' ').slice(0,2).join(' '))}>
          <StatusIcon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-mono font-semibold text-indigo-600">{exception.control.code}</span>
            <span className="text-sm font-semibold text-gray-900">{exception.title}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', cfg.cls)}>
              {cfg.label}
            </span>
            {isExpired && exception.status === 'approved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-medium">
                Expired
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{exception.control.title}</p>
        </div>
        <div className="hidden sm:flex items-center gap-4 shrink-0 text-right text-xs">
          {exception.expiresAt && (
            <div>
              <p className="text-gray-400">Expires</p>
              <p className="text-gray-600">{new Date(exception.expiresAt).toLocaleDateString()}</p>
            </div>
          )}
          {exception.riskOwner && (
            <div>
              <p className="text-gray-400">Owner</p>
              <p className="text-gray-600">{exception.riskOwner.fullName}</p>
            </div>
          )}
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 shrink-0 transition-transform mt-1', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/50">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Justification</p>
            <p className="text-sm text-gray-700">{exception.justification}</p>
          </div>

          {exception.compensatingControl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Compensating Control</p>
              <p className="text-sm text-gray-700">{exception.compensatingControl}</p>
            </div>
          )}

          {exception.rejectionReason && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-600 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-700">{exception.rejectionReason}</p>
            </div>
          )}

          {exception.status === 'pending' && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="btn-primary text-xs py-1.5 px-4"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
              </button>
              <button
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
                className="btn-secondary text-xs py-1.5 px-4 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [showNew, setShowNew] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: exceptions = [], isLoading } = useQuery<ControlException[]>({
    queryKey: ['exceptions'],
    queryFn: () => controlsApi.listExceptions() as unknown as Promise<ControlException[]>,
  });

  const { data: stats } = useQuery<ExceptionStats>({
    queryKey: ['exception-stats'],
    queryFn: () => controlsApi.getExceptionStats(),
  });

  const filtered = exceptions.filter((e) => {
    const matchStatus = statusFilter === 'all' || e.status === statusFilter;
    const matchSearch = !search.trim() ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.control.code.toLowerCase().includes(search.toLowerCase()) ||
      e.control.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Exception Register
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Formally managed control exceptions with justifications and compensating controls
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Request Exception
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-700' },
            { label: 'Pending Review', value: stats.pending, color: 'text-amber-600' },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-600' },
            { label: 'Expired', value: stats.expired, color: 'text-red-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search exceptions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 w-full text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Exception list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-sm text-gray-400">Loading exceptions…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {search || statusFilter !== 'all'
                ? 'No exceptions match your filters.'
                : 'No exceptions yet. Request one when a control cannot be fully implemented.'}
            </p>
          </div>
        ) : (
          filtered.map((e) => <ExceptionCard key={e.id} exception={e} />)
        )}
      </div>

      {showNew && <NewExceptionModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
