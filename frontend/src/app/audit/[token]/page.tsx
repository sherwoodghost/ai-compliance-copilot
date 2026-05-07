'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  Shield, CheckCircle, AlertTriangle, FileText, FolderOpen,
  MessageSquare, Send, Clock, ChevronDown, ChevronRight,
  ExternalLink, Building2, Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const portalApi = axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL });

function withToken(token: string) {
  return { headers: { 'x-auditor-token': token } };
}

// ─── Types ────────────────────────────────────────────────────────────────────

type RfiStatus = 'open' | 'in_review' | 'resolved' | 'closed';

type AuditorRfi = {
  id: string;
  question: string;
  status: RfiStatus;
  response?: string;
  priority: string;
  createdAt: string;
  control?: { code: string; title: string };
};

type PortalData = {
  session: {
    id: string;
    auditorName: string;
    auditorFirm?: string;
    expiresAt: string;
    organization: { name: string; slug: string };
  };
  controls: any[];
  evidence: any[];
  policies: any[];
  rfis: AuditorRfi[];
};

// ─── RFI Form ─────────────────────────────────────────────────────────────────

function RfiForm({ token }: { token: string }) {
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState('medium');

  const mutation = useMutation({
    mutationFn: () =>
      portalApi.post('/auditor-portal/portal/rfi', { question, priority }, withToken(token)),
    onSuccess: () => {
      setQuestion('');
      qc.invalidateQueries({ queryKey: ['portal-data', token] });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    mutation.mutate();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question about a specific control, evidence item, or policy…"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
      />
      <div className="flex items-center gap-3">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>
        <button
          type="submit"
          disabled={!question.trim() || mutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit RFI
        </button>
      </div>
    </form>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const CONTROL_STATUS: Record<string, { label: string; color: string }> = {
  implemented:  { label: 'Implemented',  color: 'bg-emerald-100 text-emerald-700' },
  in_progress:  { label: 'In Progress',  color: 'bg-blue-100 text-blue-700' },
  not_started:  { label: 'Not Started',  color: 'bg-gray-100 text-gray-600' },
  not_applicable: { label: 'N/A',        color: 'bg-gray-50 text-gray-400' },
};

const RFI_STATUS: Record<RfiStatus, { label: string; color: string }> = {
  open:      { label: 'Open',      color: 'bg-amber-100 text-amber-700' },
  in_review: { label: 'In Review', color: 'bg-blue-100 text-blue-700' },
  resolved:  { label: 'Resolved',  color: 'bg-emerald-100 text-emerald-700' },
  closed:    { label: 'Closed',    color: 'bg-gray-100 text-gray-500' },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AuditorPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [activeTab, setActiveTab] = useState<'controls' | 'evidence' | 'policies' | 'rfis'>('controls');
  const [expandedControl, setExpandedControl] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<PortalData>({
    queryKey: ['portal-data', token],
    queryFn: () => portalApi.get('/auditor-portal/portal', withToken(token)).then((r) => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading portal…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500">
            This auditor token is invalid, expired, or has been revoked. Please contact the organization for a new link.
          </p>
        </div>
      </div>
    );
  }

  const implementedPct = data.controls.length > 0
    ? Math.round(data.controls.filter((c) => c.status === 'implemented').length / data.controls.length * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{data.session.organization.name}</p>
              <p className="text-xs text-gray-500">Compliance Portal · Auditor View</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">{data.session.auditorName}</p>
            {data.session.auditorFirm && (
              <p className="text-xs text-gray-400">{data.session.auditorFirm}</p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Controls', value: data.controls.length, sub: `${implementedPct}% implemented`, icon: CheckCircle, color: 'text-emerald-600' },
            { label: 'Evidence Items', value: data.evidence.length, sub: 'valid & collected', icon: FolderOpen, color: 'text-blue-600' },
            { label: 'Policies', value: data.policies.length, sub: 'approved', icon: FileText, color: 'text-indigo-600' },
            { label: 'Open RFIs', value: data.rfis.filter((r) => r.status === 'open').length, sub: 'awaiting response', icon: MessageSquare, color: 'text-amber-600' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{label}</p>
                <Icon className={cn('w-4 h-4', color)} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex border-b border-gray-100">
            {(['controls', 'evidence', 'policies', 'rfis'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium transition-colors capitalize',
                  activeTab === tab
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-500 hover:text-gray-700',
                )}
              >
                {tab} {tab === 'rfis' && data.rfis.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                    {data.rfis.filter((r) => r.status === 'open').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Controls Tab */}
            {activeTab === 'controls' && (
              <div className="space-y-1.5">
                {data.controls.map((oc: any) => {
                  const c = oc.control;
                  const statusCfg = CONTROL_STATUS[oc.status] ?? CONTROL_STATUS.not_started;
                  const isOpen = expandedControl === oc.id;

                  return (
                    <div key={oc.id} className="border border-gray-100 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedControl(isOpen ? null : oc.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-xs font-mono font-semibold text-indigo-600 w-14 shrink-0">{c.code}</span>
                        <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">{c.title}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', statusCfg.color)}>
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-gray-400 shrink-0">{oc.evidence?.length ?? 0} evidence</span>
                        <ChevronRight className={cn('w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-2">
                          <p className="text-xs text-gray-600">{c.description}</p>
                          {oc.evidence?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evidence</p>
                              <div className="space-y-1">
                                {oc.evidence.map((ev: any) => (
                                  <div key={ev.id} className="flex items-center gap-2 text-xs bg-white border border-gray-100 rounded-lg px-3 py-2">
                                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                                    <span className="flex-1 truncate">{ev.title}</span>
                                    <span className="text-gray-400 shrink-0 capitalize">{ev.type?.replace('_', ' ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {oc.notes && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                              <p className="text-xs text-gray-600">{oc.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Evidence Tab */}
            {activeTab === 'evidence' && (
              <div className="space-y-1.5">
                {data.evidence.map((ev: any) => (
                  <div key={ev.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                    <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{ev.title}</p>
                      {ev.control && (
                        <p className="text-xs text-gray-400">{ev.control.code} — {ev.control.title}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 capitalize">{ev.type?.replace('_', ' ')}</span>
                    {ev.expiresAt && (
                      <span className={cn(
                        'text-xs shrink-0',
                        new Date(ev.expiresAt) < new Date() ? 'text-red-500' : 'text-gray-400',
                      )}>
                        {new Date(ev.expiresAt) < new Date() ? '⚠ Expired' : `Exp. ${new Date(ev.expiresAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Policies Tab */}
            {activeTab === 'policies' && (
              <div className="space-y-1.5">
                {data.policies.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.title}</p>
                      <p className="text-xs text-gray-400">v{p.version} · Approved {p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : '—'}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium shrink-0">
                      Approved
                    </span>
                  </div>
                ))}
                {data.policies.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No approved policies yet.</p>
                )}
              </div>
            )}

            {/* RFIs Tab */}
            {activeTab === 'rfis' && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Submit a Request for Information</p>
                  <RfiForm token={token} />
                </div>

                {data.rfis.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-2">Your RFIs</p>
                    <div className="space-y-2">
                      {data.rfis.map((rfi) => {
                        const statusCfg = RFI_STATUS[rfi.status] ?? RFI_STATUS.open;
                        return (
                          <div key={rfi.id} className="border border-gray-100 rounded-xl p-4 space-y-2">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  {rfi.control && (
                                    <span className="text-xs font-mono font-semibold text-indigo-600">{rfi.control.code}</span>
                                  )}
                                  <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', statusCfg.color)}>
                                    {statusCfg.label}
                                  </span>
                                  <span className={cn(
                                    'text-xs px-1.5 py-0.5 rounded-full',
                                    rfi.priority === 'high' ? 'bg-red-50 text-red-600' :
                                    rfi.priority === 'medium' ? 'bg-amber-50 text-amber-600' :
                                    'bg-gray-50 text-gray-500',
                                  )}>
                                    {rfi.priority}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-800">{rfi.question}</p>
                              </div>
                              <p className="text-xs text-gray-400 shrink-0">{new Date(rfi.createdAt).toLocaleDateString()}</p>
                            </div>
                            {rfi.response && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                <p className="text-xs font-semibold text-emerald-700 mb-1">Response</p>
                                <p className="text-sm text-emerald-800">{rfi.response}</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Access expires {new Date(data.session.expiresAt).toLocaleDateString()} · Read-only view
        </p>
      </main>
    </div>
  );
}
