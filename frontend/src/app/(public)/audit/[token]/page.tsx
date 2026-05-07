'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Shield, CheckCircle, XCircle, Clock, AlertCircle, FileText,
  MessageSquare, ChevronDown, ChevronRight, Send, ExternalLink,
  Building2, Calendar, Lock, AlertTriangle, CheckSquare,
} from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL ?? '';

type PortalData = {
  session: {
    id: string;
    auditorName: string;
    auditorFirm?: string;
    expiresAt: string;
    organization: { id: string; name: string; slug: string };
  };
  controls: Array<{
    id: string;
    status: string;
    score: number;
    notes?: string;
    control: {
      id: string;
      code: string;
      title: string;
      category: string;
      description?: string;
      evidence: Array<{ id: string; title: string; type: string; isValid: boolean; collectedAt: string; expiresAt?: string }>;
    };
  }>;
  evidence: Array<{
    id: string;
    title: string;
    type: string;
    collectedAt: string;
    expiresAt?: string;
    control?: { id: string; code: string; title: string };
  }>;
  policies: Array<{ id: string; title: string; version: string; approvedAt?: string }>;
  rfis: Array<{
    id: string;
    question: string;
    status: string;
    priority: string;
    response?: string;
    createdAt: string;
    respondedAt?: string;
    control?: { id: string; code: string; title: string };
    responder?: { id: string; fullName: string };
  }>;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  implemented:     { label: 'Implemented', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  in_progress:     { label: 'In Progress', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  partial:         { label: 'Partial',     color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  not_implemented: { label: 'Not Implemented', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  not_applicable:  { label: 'N/A',         color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
  not_started:     { label: 'Not Started', color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
};

export default function AuditorPortalPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'controls' | 'evidence' | 'rfis'>('overview');

  // RFI form state
  const [rfiQuestion, setRfiQuestion] = useState('');
  const [rfiPriority, setRfiPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [rfiControlId, setRfiControlId] = useState('');
  const [submittingRfi, setSubmittingRfi] = useState(false);
  const [rfiSuccess, setRfiSuccess] = useState(false);

  // Controls expansion
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/auditor-portal/portal`, {
      headers: { 'x-auditor-token': token, 'Content-Type': 'application/json' },
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.message ?? `Error ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function submitRfi() {
    if (!rfiQuestion.trim()) return;
    setSubmittingRfi(true);
    try {
      const r = await fetch(`${API}/auditor-portal/portal/rfi`, {
        method: 'POST',
        headers: { 'x-auditor-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: rfiQuestion, priority: rfiPriority, controlId: rfiControlId || undefined }),
      });
      if (!r.ok) throw new Error('Failed to submit');
      const newRfi = await r.json();
      setData((prev) => prev ? { ...prev, rfis: [newRfi, ...prev.rfis] } : prev);
      setRfiQuestion('');
      setRfiControlId('');
      setRfiSuccess(true);
      setTimeout(() => setRfiSuccess(false), 3000);
    } catch {
      // silently fail, keep form
    } finally {
      setSubmittingRfi(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading audit portal…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 max-w-md text-center shadow-sm">
          <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500 mb-2">{error ?? 'Invalid or expired auditor link.'}</p>
          <p className="text-xs text-gray-400">Contact the organization to request a new access link.</p>
        </div>
      </div>
    );
  }

  const { session, controls, evidence, policies, rfis } = data;
  const org = session.organization;

  // Compute stats
  const implementedCount = controls.filter(c => c.status === 'implemented').length;
  const inProgressCount = controls.filter(c => ['in_progress', 'partial'].includes(c.status)).length;
  const gapCount = controls.filter(c => c.status === 'not_implemented').length;
  const overallScore = controls.length > 0 ? Math.round((implementedCount / controls.length) * 100) : 0;
  const openRfis = rfis.filter(r => r.status !== 'resolved').length;
  const expiringEvidence = evidence.filter(e => e.expiresAt && new Date(e.expiresAt) < new Date(Date.now() + 30 * 86400000)).length;

  // Group controls by category
  const byCategory = controls.reduce<Record<string, typeof controls>>((acc, c) => {
    const cat = c.control.category ?? 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  const TAB_BTN = (id: typeof activeTab, label: string, count?: number) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        activeTab === id
          ? 'bg-indigo-600 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
      }`}
    >
      {label}{count !== undefined && <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-indigo-500' : 'bg-gray-200 text-gray-600'}`}>{count}</span>}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{org.name}</p>
              <p className="text-xs text-gray-500">Compliance Audit Portal</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="text-sm font-medium text-gray-800">{session.auditorName}{session.auditorFirm ? ` · ${session.auditorFirm}` : ''}</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Expiry warning */}
        {new Date(session.expiresAt) < new Date(Date.now() + 7 * 86400000) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">Your access link expires on {new Date(session.expiresAt).toLocaleDateString()}. Contact the organization to renew.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {TAB_BTN('overview', 'Overview')}
          {TAB_BTN('controls', 'Controls', controls.length)}
          {TAB_BTN('evidence', 'Evidence', evidence.length)}
          {TAB_BTN('rfis', 'RFIs', rfis.length)}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Score cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Overall Score', value: `${overallScore}%`, color: overallScore >= 80 ? 'text-green-600' : overallScore >= 60 ? 'text-amber-600' : 'text-red-600', sub: 'Compliance posture' },
                { label: 'Implemented', value: implementedCount, color: 'text-green-600', sub: `of ${controls.length} controls` },
                { label: 'In Progress', value: inProgressCount, color: 'text-amber-600', sub: 'controls' },
                { label: 'Open RFIs', value: openRfis, color: openRfis > 0 ? 'text-indigo-600' : 'text-gray-400', sub: 'awaiting response' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Control Implementation Progress</p>
                <p className="text-sm font-bold text-indigo-600">{overallScore}%</p>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-1000"
                  style={{ width: `${overallScore}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> {implementedCount} implemented</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {inProgressCount} in progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {gapCount} gaps</span>
              </div>
            </div>

            {/* Policies */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">Approved Policies ({policies.length})</p>
              {policies.length === 0 ? (
                <p className="text-sm text-gray-400">No approved policies yet.</p>
              ) : (
                <div className="space-y-2">
                  {policies.map(p => (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{p.title}</span>
                        <span className="text-xs text-gray-400 font-mono">{p.version}</span>
                      </div>
                      {p.approvedAt && (
                        <span className="text-xs text-gray-400">Approved {new Date(p.approvedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notices */}
            {(expiringEvidence > 0 || gapCount > 0) && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Attention Items</p>
                {gapCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                    <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    <p className="text-sm text-red-700">{gapCount} control{gapCount > 1 ? 's' : ''} not yet implemented</p>
                  </div>
                )}
                {expiringEvidence > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-sm text-amber-700">{expiringEvidence} evidence item{expiringEvidence > 1 ? 's' : ''} expiring within 30 days</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Controls ── */}
        {activeTab === 'controls' && (
          <div className="space-y-3">
            {Object.entries(byCategory).map(([category, catControls]) => {
              const expanded = expandedCategories.has(category);
              const catImpl = catControls.filter(c => c.status === 'implemented').length;
              return (
                <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <span className="text-sm font-semibold text-gray-900">{category}</span>
                      <span className="text-xs text-gray-400">{catImpl}/{catControls.length}</span>
                    </div>
                    <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${catControls.length ? (catImpl / catControls.length) * 100 : 0}%` }}
                      />
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-gray-100">
                      {catControls.map(c => {
                        const cfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.not_started;
                        return (
                          <div key={c.id} className="px-5 py-3 border-b border-gray-50 last:border-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-mono text-gray-400">{c.control.code}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} font-medium`}>
                                    {cfg.label}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900">{c.control.title}</p>
                                {c.control.description && (
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{c.control.description}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-gray-400">{c.control.evidence?.length ?? 0} evidence</p>
                                {c.score > 0 && <p className="text-xs font-semibold text-indigo-600">{c.score}%</p>}
                              </div>
                            </div>
                            {c.control.evidence?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {c.control.evidence.slice(0, 3).map(ev => (
                                  <span key={ev.id} className="text-xs bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-gray-600">{ev.title}</span>
                                ))}
                                {c.control.evidence.length > 3 && (
                                  <span className="text-xs text-gray-400">+{c.control.evidence.length - 3} more</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Evidence ── */}
        {activeTab === 'evidence' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Evidence</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Control</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Collected</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expires</th>
                </tr>
              </thead>
              <tbody>
                {evidence.map(ev => {
                  const isExpiring = ev.expiresAt && new Date(ev.expiresAt) < new Date(Date.now() + 30 * 86400000);
                  const isExpired = ev.expiresAt && new Date(ev.expiresAt) < new Date();
                  return (
                    <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-sm font-medium text-gray-900">{ev.title}</td>
                      <td className="px-5 py-3 text-xs font-mono text-gray-500">{ev.type}</td>
                      <td className="px-5 py-3 text-xs text-gray-500 font-mono">{ev.control?.code ?? '—'}</td>
                      <td className="px-5 py-3 text-xs text-gray-500">{new Date(ev.collectedAt).toLocaleDateString()}</td>
                      <td className="px-5 py-3 text-xs">
                        {ev.expiresAt ? (
                          <span className={`font-medium ${isExpired ? 'text-red-600' : isExpiring ? 'text-amber-600' : 'text-gray-500'}`}>
                            {new Date(ev.expiresAt).toLocaleDateString()}
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
                {evidence.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-gray-400">No evidence items available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── RFIs ── */}
        {activeTab === 'rfis' && (
          <div className="space-y-5">
            {/* Submit new RFI */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-semibold text-gray-900 mb-4">Submit a Request for Information</p>
              {rfiSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> RFI submitted successfully. The organization has been notified.
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Question *</label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Please provide documentation for…"
                    value={rfiQuestion}
                    onChange={e => setRfiQuestion(e.target.value)}
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Related Control (optional)</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={rfiControlId}
                      onChange={e => setRfiControlId(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {controls.map(c => (
                        <option key={c.control.id} value={c.control.id}>{c.control.code}: {c.control.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                    <select
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={rfiPriority}
                      onChange={e => setRfiPriority(e.target.value as 'low' | 'medium' | 'high')}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={submitRfi}
                  disabled={submittingRfi || !rfiQuestion.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {submittingRfi ? 'Submitting…' : 'Submit RFI'}
                </button>
              </div>
            </div>

            {/* RFI list */}
            <div className="space-y-3">
              {rfis.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
                  <MessageSquare className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No RFIs submitted yet.</p>
                </div>
              )}
              {rfis.map(rfi => {
                const priorityColor: Record<string, string> = { high: 'text-red-600 bg-red-50 border-red-200', medium: 'text-amber-600 bg-amber-50 border-amber-200', low: 'text-green-600 bg-green-50 border-green-200' };
                const statusColor: Record<string, string> = { open: 'text-indigo-600 bg-indigo-50 border-indigo-200', resolved: 'text-green-600 bg-green-50 border-green-200', pending: 'text-amber-600 bg-amber-50 border-amber-200' };
                return (
                  <div key={rfi.id} className="bg-white rounded-xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor[rfi.status] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                          {rfi.status === 'resolved' ? '✓ Resolved' : rfi.status === 'open' ? 'Open' : 'Pending'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityColor[rfi.priority] ?? ''}`}>
                          {rfi.priority} priority
                        </span>
                        {rfi.control && (
                          <span className="text-xs text-gray-500 font-mono">{rfi.control.code}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{new Date(rfi.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-900 mb-3">{rfi.question}</p>
                    {rfi.response && (
                      <div className="bg-green-50 border border-green-100 rounded-lg p-3">
                        <p className="text-xs text-green-700 font-semibold mb-1">Response{rfi.responder ? ` from ${rfi.responder.fullName}` : ''} · {rfi.respondedAt ? new Date(rfi.respondedAt).toLocaleDateString() : ''}</p>
                        <p className="text-sm text-gray-700">{rfi.response}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-16 py-6">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-gray-400">Powered by <span className="font-semibold text-indigo-600">AI Compliance Copilot</span></p>
          <p className="text-xs text-gray-400">Access expires {new Date(session.expiresAt).toLocaleDateString()}</p>
        </div>
      </footer>
    </div>
  );
}
