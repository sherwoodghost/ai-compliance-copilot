'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import {
  Users, Plus, X, Copy, Check, ExternalLink, Shield,
  Clock, AlertTriangle, CheckCircle, XCircle, MessageSquare,
  Link, Trash2, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditorSession = {
  id: string;
  token: string;
  auditorName: string;
  auditorFirm?: string;
  auditorEmail?: string;
  expiresAt: string;
  isRevoked: boolean;
  lastAccessAt?: string;
  createdAt: string;
  creator: { fullName: string; email: string };
  _count: { rfis: number };
};

type AuditorRfi = {
  id: string;
  question: string;
  status: string;
  response?: string;
  priority: string;
  createdAt: string;
  control?: { code: string; title: string };
  auditorSession: { auditorName: string; auditorFirm?: string };
  responder?: { fullName: string };
};

// ─── New Session Modal ────────────────────────────────────────────────────────

function NewSessionModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    auditorName: '',
    auditorFirm: '',
    auditorEmail: '',
    expiresInDays: 30,
  });

  const mutation = useMutation({
    mutationFn: () => api.post('/auditor-portal/sessions', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor-sessions'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">Create Auditor Access</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auditor Name *</label>
            <input required className="input w-full" placeholder="e.g. Jane Smith" value={form.auditorName}
              onChange={(e) => setForm((f) => ({ ...f, auditorName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Audit Firm <span className="text-gray-400 font-normal">(optional)</span></label>
            <input className="input w-full" placeholder="e.g. Deloitte" value={form.auditorFirm}
              onChange={(e) => setForm((f) => ({ ...f, auditorFirm: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Auditor Email <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="email" className="input w-full" placeholder="auditor@firm.com" value={form.auditorEmail}
              onChange={(e) => setForm((f) => ({ ...f, auditorEmail: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Access Duration</label>
            <select className="input w-full" value={form.expiresInDays}
              onChange={(e) => setForm((f) => ({ ...f, expiresInDays: Number(e.target.value) }))}>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days (recommended)</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {mutation.isError && <p className="text-sm text-red-600">Failed to create session. Try again.</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create Access Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: AuditorSession }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const portalUrl = `${window.location.origin}/audit/${session.token}`;

  const isExpired = new Date(session.expiresAt) < new Date();
  const isActive = !session.isRevoked && !isExpired;

  function copyLink() {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const revoke = useMutation({
    mutationFn: () => api.patch(`/auditor-portal/sessions/${session.id}/revoke`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auditor-sessions'] }),
  });

  return (
    <div className={cn(
      'bg-white border rounded-xl p-5',
      isActive ? 'border-gray-200' : 'border-gray-100 opacity-60',
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold',
            isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500',
          )}>
            {session.auditorName[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-gray-900">{session.auditorName}</p>
              {session.auditorFirm && <span className="text-xs text-gray-400">{session.auditorFirm}</span>}
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full font-medium',
                session.isRevoked ? 'bg-red-50 text-red-600' :
                isExpired ? 'bg-gray-100 text-gray-500' :
                'bg-emerald-50 text-emerald-600',
              )}>
                {session.isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active'}
              </span>
            </div>
            {session.auditorEmail && <p className="text-xs text-gray-400 mt-0.5">{session.auditorEmail}</p>}
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Expires {new Date(session.expiresAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {session._count.rfis} RFI{session._count.rfis !== 1 ? 's' : ''}
              </span>
              {session.lastAccessAt && (
                <span>Last accessed {new Date(session.lastAccessAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isActive && (
            <>
              <button
                onClick={copyLink}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Open
              </a>
              <button
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                Revoke
              </button>
            </>
          )}
        </div>
      </div>

      {isActive && (
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
          <Link className="w-3 h-3 text-gray-400 shrink-0" />
          <p className="text-xs text-gray-400 font-mono truncate">{portalUrl}</p>
        </div>
      )}
    </div>
  );
}

// ─── RFI Row ──────────────────────────────────────────────────────────────────

const RFI_STATUS_CFG: Record<string, { label: string; color: string }> = {
  open:      { label: 'Open',      color: 'bg-amber-50 text-amber-700' },
  in_review: { label: 'In Review', color: 'bg-blue-50 text-blue-700' },
  resolved:  { label: 'Resolved',  color: 'bg-emerald-50 text-emerald-700' },
  closed:    { label: 'Closed',    color: 'bg-gray-50 text-gray-500' },
};

function RfiRow({ rfi }: { rfi: AuditorRfi }) {
  const qc = useQueryClient();
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');
  const cfg = RFI_STATUS_CFG[rfi.status] ?? RFI_STATUS_CFG.open;

  const respond = useMutation({
    mutationFn: () => api.post(`/auditor-portal/rfis/${rfi.id}/respond`, { response }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auditor-rfis'] });
      setResponding(false);
      setResponse('');
    },
  });

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-semibold text-gray-600">{rfi.auditorSession.auditorName}</span>
            {rfi.auditorSession.auditorFirm && <span className="text-xs text-gray-400">{rfi.auditorSession.auditorFirm}</span>}
            {rfi.control && (
              <span className="text-xs font-mono text-indigo-600">{rfi.control.code}</span>
            )}
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full',
              rfi.priority === 'high' ? 'bg-red-50 text-red-600' : rfi.priority === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500',
            )}>
              {rfi.priority}
            </span>
          </div>
          <p className="text-sm text-gray-800">{rfi.question}</p>
        </div>
        <p className="text-xs text-gray-400 shrink-0">{new Date(rfi.createdAt).toLocaleDateString()}</p>
      </div>

      {rfi.response && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-emerald-700 mb-0.5">Your response</p>
          <p className="text-sm text-emerald-800">{rfi.response}</p>
        </div>
      )}

      {rfi.status === 'open' && !responding && (
        <button
          onClick={() => setResponding(true)}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          <MessageSquare className="w-3 h-3" /> Respond
        </button>
      )}

      {responding && (
        <div className="space-y-2">
          <textarea
            rows={3}
            className="input w-full text-sm resize-none"
            placeholder="Write your response…"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => respond.mutate()} disabled={!response.trim() || respond.isPending}
              className="btn-primary text-xs py-1.5 px-4">
              {respond.isPending ? 'Sending…' : 'Send Response'}
            </button>
            <button onClick={() => setResponding(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditorPortalPage() {
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState<'sessions' | 'rfis'>('sessions');
  const [rfiStatusFilter, setRfiStatusFilter] = useState('all');

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<AuditorSession[]>({
    queryKey: ['auditor-sessions'],
    queryFn: () => api.get('/auditor-portal/sessions').then((r) => r.data),
  });

  const { data: rfis = [], isLoading: rfisLoading } = useQuery<AuditorRfi[]>({
    queryKey: ['auditor-rfis'],
    queryFn: () => api.get('/auditor-portal/rfis').then((r) => r.data),
  });

  const activeSessions = sessions.filter((s) => !s.isRevoked && new Date(s.expiresAt) >= new Date());
  const openRfis = rfis.filter((r) => r.status === 'open');
  const filteredRfis = rfiStatusFilter === 'all' ? rfis : rfis.filter((r) => r.status === rfiStatusFilter);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            Auditor Portal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Share secure, read-only access with your external auditors — no login required
          </p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary text-sm shrink-0">
          <Plus className="w-4 h-4 mr-1.5" /> New Access Link
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Sessions', value: activeSessions.length, color: 'text-emerald-600' },
          { label: 'Open RFIs', value: openRfis.length, color: openRfis.length > 0 ? 'text-amber-600' : 'text-gray-500' },
          { label: 'Total RFIs', value: rfis.length, color: 'text-gray-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['sessions', 'rfis'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors capitalize',
              tab === t
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'rfis' ? `RFIs${openRfis.length > 0 ? ` (${openRfis.length} open)` : ''}` : 'Sessions'}
          </button>
        ))}
      </div>

      {/* Sessions tab */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {sessionsLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading sessions…</p>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-xl">
              <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No auditor sessions yet</p>
              <p className="text-xs text-gray-400 mt-1">Create one to share a secure link with your auditor</p>
              <button onClick={() => setShowNew(true)} className="btn-primary text-sm mt-4">
                Create First Access Link
              </button>
            </div>
          ) : (
            sessions.map((s) => <SessionCard key={s.id} session={s} />)
          )}
        </div>
      )}

      {/* RFIs tab */}
      {tab === 'rfis' && (
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(['all', 'open', 'resolved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setRfiStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                  rfiStatusFilter === s ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {rfisLoading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading RFIs…</p>
          ) : filteredRfis.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No RFIs yet. Share an access link with your auditor to get started.</p>
            </div>
          ) : (
            filteredRfis.map((r) => <RfiRow key={r.id} rfi={r} />)
          )}
        </div>
      )}

      {showNew && <NewSessionModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
