'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  BarChart3, Plus, Pencil, Trash2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TierAssessment {
  id: string;
  assessmentName: string;
  assessmentDate: string;
  assessedBy: string;
  csfFunction: 'GV' | 'ID' | 'PR' | 'DE' | 'RS' | 'RC';
  domain: string;
  // Tier scoring dimensions
  riskManagementProcess: 1 | 2 | 3 | 4;
  integratedRiskManagement: 1 | 2 | 3 | 4;
  externalParticipation: 1 | 2 | 3 | 4;
  overallTier: 1 | 2 | 3 | 4;
  targetTier: 1 | 2 | 3 | 4;
  justification: string;
  improvementActions: string;
  evidenceReferences: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TIER_LABELS = ['', 'Partial', 'Risk Informed', 'Repeatable', 'Adaptive'];
const TIER_DESC = [
  '',
  'Ad hoc, reactive, limited awareness of cybersecurity risk',
  'Risk practices approved by management, awareness of cybersecurity risk',
  'Formally approved risk practices, org-wide approach to cybersecurity',
  'Adaptive approach, continuously improving based on lessons learned',
];
const TIER_COLORS = [
  '',
  'bg-red-100 text-red-700 border-red-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
];

const FUNCTION_META: Record<string, { label: string; color: string }> = {
  GV: { label: 'Govern',   color: 'text-purple-700' },
  ID: { label: 'Identify', color: 'text-blue-700' },
  PR: { label: 'Protect',  color: 'text-green-700' },
  DE: { label: 'Detect',   color: 'text-amber-700' },
  RS: { label: 'Respond',  color: 'text-red-700' },
  RC: { label: 'Recover',  color: 'text-sky-700' },
};

const EMPTY: Partial<TierAssessment> = {
  assessmentName: '', assessmentDate: '', assessedBy: '', csfFunction: 'GV',
  domain: '', riskManagementProcess: 1, integratedRiskManagement: 1,
  externalParticipation: 1, overallTier: 1, targetTier: 2,
  justification: '', improvementActions: '', evidenceReferences: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function TierAssessmentPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm]   = useState<Partial<TierAssessment>>(EMPTY);

  const { data: assessments = [], isLoading } = useQuery<TierAssessment[]>({
    queryKey: ['nist-csf-tiers'],
    queryFn: () => apiClient.get('/nist-csf/tier-assessment').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (a: Partial<TierAssessment>) =>
      a.id ? apiClient.put(`/nist-csf/tier-assessment/${a.id}`, a).then(r => r.data)
           : apiClient.post('/nist-csf/tier-assessment', a).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nist-csf-tiers'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/nist-csf/tier-assessment/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nist-csf-tiers'] }),
  });

  // Aggregate current tier by function
  const tierByFn = (fn: string) => {
    const items = assessments.filter(a => a.csfFunction === fn);
    if (!items.length) return null;
    return Math.round(items.reduce((s, a) => s + a.overallTier, 0) / items.length);
  };

  const avgTier = assessments.length
    ? (assessments.reduce((s, a) => s + a.overallTier, 0) / assessments.length).toFixed(1)
    : '—';

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tier Self-Assessment</h1>
          <p className="text-sm text-slate-500 mt-1">
            NIST CSF 2.0 — Evaluate cybersecurity maturity across Tiers 1–4 for each function
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Assessment
        </button>
      </div>

      {/* Tier Reference */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 text-sm mb-3">Implementation Tier Reference</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(t => (
            <div key={t} className={cn('border rounded-lg p-3', TIER_COLORS[t])}>
              <p className="font-bold text-sm">Tier {t} — {TIER_LABELS[t]}</p>
              <p className="text-xs mt-1 opacity-80">{TIER_DESC[t]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary by Function */}
      {assessments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 text-sm mb-3">Current Tier by Function (avg)</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(FUNCTION_META).map(([fn, meta]) => {
              const t = tierByFn(fn);
              return (
                <div key={fn} className="text-center">
                  <p className={cn('text-sm font-semibold', meta.color)}>{fn}</p>
                  <p className="text-xs text-slate-500">{meta.label}</p>
                  {t !== null ? (
                    <div className={cn('mt-1 px-2 py-1 rounded text-xs font-bold border', TIER_COLORS[t])}>
                      Tier {t}
                    </div>
                  ) : (
                    <div className="mt-1 px-2 py-1 rounded text-xs border border-slate-200 text-slate-400">—</div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">Overall average: <strong>Tier {avgTier}</strong></p>
        </div>
      )}

      {/* Assessments Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-slate-800 text-sm">Tier Assessments ({assessments.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : assessments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No tier assessments yet — complete a self-assessment for each CSF function.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs text-slate-500 text-left">
                  <th className="px-4 py-2">Function / Domain</th>
                  <th className="px-4 py-2">Assessment</th>
                  <th className="px-4 py-2">RMP Tier</th>
                  <th className="px-4 py-2">IRM Tier</th>
                  <th className="px-4 py-2">Ext. Participation</th>
                  <th className="px-4 py-2">Overall</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessments.map(a => {
                  const meta = FUNCTION_META[a.csfFunction];
                  return (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', meta?.color)}>{a.csfFunction}</span>
                        {a.domain && <span className="text-slate-500 text-xs ml-1">/ {a.domain}</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{a.assessmentName}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIER_COLORS[a.riskManagementProcess])}>T{a.riskManagementProcess}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIER_COLORS[a.integratedRiskManagement])}>T{a.integratedRiskManagement}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', TIER_COLORS[a.externalParticipation])}>T{a.externalParticipation}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs px-2 py-0.5 rounded border font-bold', TIER_COLORS[a.overallTier])}>Tier {a.overallTier}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">→ T{a.targetTier}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{a.assessmentDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setForm(a); setModal('edit'); }} className="p-1 text-slate-400 hover:text-orange-600">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => remove.mutate(a.id)} className="p-1 text-slate-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add Tier Assessment' : 'Edit Tier Assessment'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Name *</label>
                <input value={form.assessmentName ?? ''} onChange={e => setForm((f: any) => ({ ...f, assessmentName: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Q1 2026 Risk Management" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CSF Function *</label>
                <select value={form.csfFunction ?? 'GV'} onChange={e => setForm((f: any) => ({ ...f, csfFunction: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(FUNCTION_META).map(([fn, m]) => (
                    <option key={fn} value={fn}>{fn} – {m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Domain / Area</label>
                <input value={form.domain ?? ''} onChange={e => setForm((f: any) => ({ ...f, domain: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Asset Management" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Date</label>
                <input type="date" value={form.assessmentDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, assessmentDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assessed By</label>
                <input value={form.assessedBy ?? ''} onChange={e => setForm((f: any) => ({ ...f, assessedBy: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Security Team" />
              </div>

              {/* Tier Dimensions */}
              <div className="col-span-2 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-700 mb-3">Tier Scoring Dimensions</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { field: 'riskManagementProcess',    label: 'Risk Management Process' },
                    { field: 'integratedRiskManagement',  label: 'Integrated Risk Management' },
                    { field: 'externalParticipation',     label: 'External Participation' },
                    { field: 'overallTier',               label: 'Overall Tier' },
                  ].map(({ field, label }) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                      <select value={(form as any)[field] ?? 1} onChange={e => setForm((f: any) => ({ ...f, [field]: +e.target.value }))}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                        {[1, 2, 3, 4].map(t => <option key={t} value={t}>Tier {t} — {TIER_LABELS[t]}</option>)}
                      </select>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Target Tier</label>
                    <select value={form.targetTier ?? 2} onChange={e => setForm((f: any) => ({ ...f, targetTier: +e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                      {[1, 2, 3, 4].map(t => <option key={t} value={t}>Tier {t} — {TIER_LABELS[t]}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Justification</label>
                <textarea rows={2} value={form.justification ?? ''} onChange={e => setForm((f: any) => ({ ...f, justification: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Improvement Actions</label>
                <textarea rows={2} value={form.improvementActions ?? ''} onChange={e => setForm((f: any) => ({ ...f, improvementActions: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Evidence References</label>
                <textarea rows={1} value={form.evidenceReferences ?? ''} onChange={e => setForm((f: any) => ({ ...f, evidenceReferences: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending}
                className="px-5 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
