'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  AlertTriangle, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
  ShieldCheck, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RiskAnalysis {
  id: string;
  title: string;
  scope: string;
  threatSource: string;
  vulnerability: string;
  currentControls: string;
  likelihood: 1 | 2 | 3 | 4 | 5;
  impact: 1 | 2 | 3 | 4 | 5;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  dataClassification: 'ePHI' | 'PHI' | 'de_identified' | 'other';
  safeguardCategory: 'administrative' | 'physical' | 'technical';
  recommendedSafeguards: string;
  residualRisk: 'accepted' | 'mitigated' | 'transferred' | 'avoided' | 'pending';
  status: 'open' | 'in_progress' | 'closed';
  reviewDate: string;
  reviewedBy: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LIKELIHOOD_LABELS = ['', 'Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const IMPACT_LABELS     = ['', 'Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

function riskScore(l: number, i: number) { return l * i; }
function riskColor(score: number) {
  if (score >= 20) return 'bg-red-100 text-red-700';
  if (score >= 12) return 'bg-orange-100 text-orange-700';
  if (score >= 6)  return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}
function riskLabel(score: number) {
  if (score >= 20) return 'Critical';
  if (score >= 12) return 'High';
  if (score >= 6)  return 'Medium';
  return 'Low';
}

const EMPTY: Partial<RiskAnalysis> = {
  title: '', scope: '', threatSource: '', vulnerability: '',
  currentControls: '', likelihood: 3, impact: 3,
  dataClassification: 'ePHI', safeguardCategory: 'administrative',
  recommendedSafeguards: '', residualRisk: 'pending',
  status: 'open', reviewDate: '', reviewedBy: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function HipaaRiskAnalysisPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RiskAnalysis | null>(null);
  const [form, setForm] = useState<Partial<RiskAnalysis>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: risks = [], isLoading } = useQuery<RiskAnalysis[]>({
    queryKey: ['hipaa-risk-analysis'],
    queryFn: async () => {
      const { data } = await apiClient.get('/hipaa/risk-analysis');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (payload: Partial<RiskAnalysis>) => {
      if (editing) {
        await apiClient.put(`/hipaa/risk-analysis/${editing.id}`, payload);
      } else {
        await apiClient.post('/hipaa/risk-analysis', payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['hipaa-risk-analysis'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hipaa/risk-analysis/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hipaa-risk-analysis'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(r: RiskAnalysis) { setForm(r); setEditing(r); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const score = riskScore(form.likelihood ?? 3, form.impact ?? 3);

  // Stats
  const critical = risks.filter(r => riskScore(r.likelihood, r.impact) >= 20).length;
  const high     = risks.filter(r => { const s = riskScore(r.likelihood, r.impact); return s >= 12 && s < 20; }).length;
  const open     = risks.filter(r => r.status === 'open').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">HIPAA Risk Analysis</h1>
          <p className="text-sm text-gray-500 mt-1">§164.308(a)(1) — Required security management process</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Risk
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Risks',  value: risks.length, cls: 'text-gray-700' },
          { label: 'Critical',     value: critical,     cls: 'text-red-600' },
          { label: 'High',         value: high,         cls: 'text-orange-600' },
          { label: 'Open',         value: open,         cls: 'text-rose-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Risk table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Risk Register</h2>
          <p className="text-xs text-gray-500 mt-0.5">All identified ePHI threat scenarios</p>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : risks.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No risk entries yet. Add your first risk analysis.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {risks.map((r) => {
              const s = riskScore(r.likelihood, r.impact);
              const isOpen = expanded === r.id;
              return (
                <div key={r.id}>
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                  >
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full shrink-0', riskColor(s))}>
                      {riskLabel(s)} ({s})
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                      <p className="text-xs text-gray-400 truncate">{r.threatSource}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0', {
                      'bg-rose-100 text-rose-700': r.status === 'open',
                      'bg-amber-100 text-amber-700': r.status === 'in_progress',
                      'bg-green-100 text-green-700': r.status === 'closed',
                    })}>{r.status.replace('_', ' ')}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); remove.mutate(r.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 grid grid-cols-2 gap-3 pt-3">
                      <div><span className="font-medium text-gray-700">Vulnerability:</span> {r.vulnerability}</div>
                      <div><span className="font-medium text-gray-700">Data Classification:</span> {r.dataClassification}</div>
                      <div><span className="font-medium text-gray-700">Safeguard Category:</span> {r.safeguardCategory}</div>
                      <div><span className="font-medium text-gray-700">Residual Risk:</span> {r.residualRisk}</div>
                      <div><span className="font-medium text-gray-700">Likelihood:</span> {LIKELIHOOD_LABELS[r.likelihood]}</div>
                      <div><span className="font-medium text-gray-700">Impact:</span> {IMPACT_LABELS[r.impact]}</div>
                      <div className="col-span-2"><span className="font-medium text-gray-700">Current Controls:</span> {r.currentControls}</div>
                      <div className="col-span-2"><span className="font-medium text-gray-700">Recommended Safeguards:</span> {r.recommendedSafeguards}</div>
                      {r.notes && <div className="col-span-2"><span className="font-medium text-gray-700">Notes:</span> {r.notes}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editing ? 'Edit Risk Entry' : 'Add Risk Entry'}
              </h2>
              <div className="flex items-center gap-2">
                {/* Live score preview */}
                <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full', riskColor(score))}>
                  Risk Score: {score} ({riskLabel(score)})
                </span>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Risk Title *</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  value={form.title ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Unauthorized access to ePHI in EHR system"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Threat Source</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.threatSource ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, threatSource: e.target.value }))}
                    placeholder="e.g. External attacker, Insider threat"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Data Classification</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.dataClassification ?? 'ePHI'}
                    onChange={e => setForm((f: any) => ({ ...f, dataClassification: e.target.value }))}
                  >
                    <option value="ePHI">ePHI</option>
                    <option value="PHI">PHI (paper)</option>
                    <option value="de_identified">De-identified</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Vulnerability</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  rows={2}
                  value={form.vulnerability ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, vulnerability: e.target.value }))}
                  placeholder="Describe the exploitable weakness"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Likelihood (1–5)</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.likelihood ?? 3}
                    onChange={e => setForm((f: any) => ({ ...f, likelihood: parseInt(e.target.value) }))}
                  >
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {LIKELIHOOD_LABELS[n]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Impact (1–5)</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.impact ?? 3}
                    onChange={e => setForm((f: any) => ({ ...f, impact: parseInt(e.target.value) }))}
                  >
                    {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {IMPACT_LABELS[n]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Current Controls</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  rows={2}
                  value={form.currentControls ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, currentControls: e.target.value }))}
                  placeholder="Existing safeguards addressing this risk"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Recommended Safeguards</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  rows={2}
                  value={form.recommendedSafeguards ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, recommendedSafeguards: e.target.value }))}
                  placeholder="Additional controls to reduce risk level"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Safeguard Category</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.safeguardCategory ?? 'administrative'}
                    onChange={e => setForm((f: any) => ({ ...f, safeguardCategory: e.target.value }))}
                  >
                    <option value="administrative">Administrative</option>
                    <option value="physical">Physical</option>
                    <option value="technical">Technical</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Residual Risk</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.residualRisk ?? 'pending'}
                    onChange={e => setForm((f: any) => ({ ...f, residualRisk: e.target.value }))}
                  >
                    <option value="pending">Pending</option>
                    <option value="mitigated">Mitigated</option>
                    <option value="accepted">Accepted</option>
                    <option value="transferred">Transferred</option>
                    <option value="avoided">Avoided</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.status ?? 'open'}
                    onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Review Date</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.reviewDate ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, reviewDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Reviewed By</label>
                  <input
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    value={form.reviewedBy ?? ''}
                    onChange={e => setForm((f: any) => ({ ...f, reviewedBy: e.target.value }))}
                    placeholder="Name / role"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending || !form.title}
                className="px-4 py-2 text-sm bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update Risk' : 'Add Risk'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
