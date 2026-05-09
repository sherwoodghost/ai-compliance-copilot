'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  FileText, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
  ShieldCheck, Clock, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AtoPackage {
  id: string;
  systemName: string;
  systemAbbreviation: string;
  impactLevel: 'low' | 'moderate' | 'high';
  authorizationType: 'agency' | 'jab' | 'dod';
  authorizationStatus: 'pre_auth' | 'in_process' | 'authorized' | 'provisional' | 'revoked' | 'expired';
  packageId: string;
  leveragedCso?: string;
  authorizedDate?: string;
  expirationDate?: string;
  continuousMonitoringPlan: boolean;
  poamCount: number;
  openFindings: number;
  criticalFindings: number;
  lastAssessmentDate?: string;
  assessingOrganization: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function statusColor(s: AtoPackage['authorizationStatus']) {
  const m: Record<string, string> = {
    authorized:  'bg-green-100 text-green-700',
    provisional: 'bg-amber-100 text-amber-700',
    in_process:  'bg-blue-100 text-blue-700',
    pre_auth:    'bg-slate-100 text-slate-700',
    revoked:     'bg-red-100 text-red-700',
    expired:     'bg-red-100 text-red-700',
  };
  return m[s] ?? 'bg-slate-100 text-slate-700';
}

function statusLabel(s: AtoPackage['authorizationStatus']) {
  const m: Record<string, string> = {
    authorized:  'Authorized',
    provisional: 'Provisional ATO',
    in_process:  'In Process',
    pre_auth:    'Pre-Authorization',
    revoked:     'Revoked',
    expired:     'Expired',
  };
  return m[s] ?? s;
}

function impactColor(level: AtoPackage['impactLevel']) {
  return level === 'high' ? 'bg-red-100 text-red-700'
    : level === 'moderate' ? 'bg-amber-100 text-amber-700'
    : 'bg-green-100 text-green-700';
}

const EMPTY: Partial<AtoPackage> = {
  systemName: '', systemAbbreviation: '', impactLevel: 'moderate',
  authorizationType: 'agency', authorizationStatus: 'pre_auth',
  packageId: '', leveragedCso: '', authorizedDate: '', expirationDate: '',
  continuousMonitoringPlan: false, poamCount: 0, openFindings: 0, criticalFindings: 0,
  lastAssessmentDate: '', assessingOrganization: '', notes: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function AtoTrackerPage() {
  const qc = useQueryClient();
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null);
  const [form, setForm]       = useState<Partial<AtoPackage>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: packages = [], isLoading } = useQuery<AtoPackage[]>({
    queryKey: ['fedramp-ato'],
    queryFn: () => apiClient.get('/fedramp/ato').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (pkg: Partial<AtoPackage>) =>
      pkg.id
        ? apiClient.put(`/fedramp/ato/${pkg.id}`, pkg).then(r => r.data)
        : apiClient.post('/fedramp/ato', pkg).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fedramp-ato'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fedramp/ato/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fedramp-ato'] }),
  });

  // Stats
  const authorized   = packages.filter(p => p.authorizationStatus === 'authorized').length;
  const expiringSoon = packages.filter(p => p.expirationDate && daysUntil(p.expirationDate) <= 90 && p.authorizationStatus === 'authorized').length;
  const totalFindings = packages.reduce((s, p) => s + p.openFindings, 0);
  const criticalTotal = packages.reduce((s, p) => s + p.criticalFindings, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ATO Package Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            FedRAMP NIST SP 800-37 — Authorization to Operate management &amp; lifecycle tracking
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add ATO Package
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Systems', value: packages.length, color: 'text-sky-600' },
          { label: 'Authorized', value: authorized, color: 'text-green-600' },
          { label: 'Expiring ≤ 90d', value: expiringSoon, color: 'text-amber-600' },
          { label: 'Critical Findings', value: criticalTotal, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Expiry alert */}
      {expiringSoon > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{expiringSoon} ATO{expiringSoon > 1 ? 's' : ''}</strong> expire within 90 days — initiate re-authorization process.</span>
        </div>
      )}

      {/* Critical findings alert */}
      {criticalTotal > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{criticalTotal} critical finding{criticalTotal > 1 ? 's' : ''}</strong> across {totalFindings} total open findings require immediate remediation.</span>
        </div>
      )}

      {/* Package List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800 text-sm">ATO Packages ({packages.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No ATO packages yet — add one to get started.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {packages.map(pkg => {
              const isOpen = expanded === pkg.id;
              const days = pkg.expirationDate ? daysUntil(pkg.expirationDate) : null;
              return (
                <div key={pkg.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : pkg.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-900">{pkg.systemName}</span>
                        {pkg.systemAbbreviation && (
                          <span className="text-xs text-slate-500">({pkg.systemAbbreviation})</span>
                        )}
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(pkg.authorizationStatus))}>
                          {statusLabel(pkg.authorizationStatus)}
                        </span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', impactColor(pkg.impactLevel))}>
                          {pkg.impactLevel.toUpperCase()}
                        </span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {pkg.authorizationType.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        {pkg.packageId && <span>Pkg: {pkg.packageId}</span>}
                        {pkg.expirationDate && (
                          <span className={cn(days !== null && days <= 90 ? 'text-amber-600 font-medium' : '')}>
                            Expires: {pkg.expirationDate}
                            {days !== null && days <= 90 && ` (${days}d)`}
                          </span>
                        )}
                        {pkg.openFindings > 0 && (
                          <span className={pkg.criticalFindings > 0 ? 'text-red-600 font-medium' : ''}>
                            {pkg.openFindings} open finding{pkg.openFindings > 1 ? 's' : ''}
                            {pkg.criticalFindings > 0 && ` (${pkg.criticalFindings} critical)`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(pkg); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-sky-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(pkg.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {pkg.leveragedCso && (
                        <div><span className="text-slate-500">Leveraged CSO:</span> <span className="font-medium">{pkg.leveragedCso}</span></div>
                      )}
                      <div><span className="text-slate-500">Authorized:</span> <span className="font-medium">{pkg.authorizedDate || '—'}</span></div>
                      <div><span className="text-slate-500">ConMon Plan:</span> <span className={pkg.continuousMonitoringPlan ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{pkg.continuousMonitoringPlan ? 'Yes' : 'No'}</span></div>
                      <div><span className="text-slate-500">Last Assessment:</span> <span className="font-medium">{pkg.lastAssessmentDate || '—'}</span></div>
                      <div><span className="text-slate-500">Assessing Org:</span> <span className="font-medium">{pkg.assessingOrganization || '—'}</span></div>
                      <div><span className="text-slate-500">POA&M Items:</span> <span className="font-medium">{pkg.poamCount}</span></div>
                      {pkg.notes && (
                        <div className="col-span-full"><span className="text-slate-500">Notes:</span> <span>{pkg.notes}</span></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add ATO Package' : 'Edit ATO Package'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              {/* System Name */}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">System Name *</label>
                <input value={form.systemName ?? ''} onChange={e => setForm((f: any) => ({ ...f, systemName: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Cloud Email Service" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Abbreviation</label>
                <input value={form.systemAbbreviation ?? ''} onChange={e => setForm((f: any) => ({ ...f, systemAbbreviation: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="CES" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">FedRAMP Package ID</label>
                <input value={form.packageId ?? ''} onChange={e => setForm((f: any) => ({ ...f, packageId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="FR-2024-XXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Impact Level</label>
                <select value={form.impactLevel ?? 'moderate'} onChange={e => setForm((f: any) => ({ ...f, impactLevel: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Authorization Type</label>
                <select value={form.authorizationType ?? 'agency'} onChange={e => setForm((f: any) => ({ ...f, authorizationType: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="agency">Agency ATO</option>
                  <option value="jab">JAB Authorization</option>
                  <option value="dod">DoD ATO</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Authorization Status</label>
                <select value={form.authorizationStatus ?? 'pre_auth'} onChange={e => setForm((f: any) => ({ ...f, authorizationStatus: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="pre_auth">Pre-Authorization</option>
                  <option value="in_process">In Process</option>
                  <option value="authorized">Authorized</option>
                  <option value="provisional">Provisional ATO</option>
                  <option value="revoked">Revoked</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Authorized Date</label>
                <input type="date" value={form.authorizedDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, authorizedDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Expiration Date</label>
                <input type="date" value={form.expirationDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, expirationDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Leveraged CSO</label>
                <input value={form.leveragedCso ?? ''} onChange={e => setForm((f: any) => ({ ...f, leveragedCso: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="AWS GovCloud" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Assessing Organization (3PAO)</label>
                <input value={form.assessingOrganization ?? ''} onChange={e => setForm((f: any) => ({ ...f, assessingOrganization: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Coalfire" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Assessment Date</label>
                <input type="date" value={form.lastAssessmentDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, lastAssessmentDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Open Findings</label>
                <input type="number" min="0" value={form.openFindings ?? 0} onChange={e => setForm((f: any) => ({ ...f, openFindings: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Critical Findings</label>
                <input type="number" min="0" value={form.criticalFindings ?? 0} onChange={e => setForm((f: any) => ({ ...f, criticalFindings: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">POA&M Items</label>
                <input type="number" min="0" value={form.poamCount ?? 0} onChange={e => setForm((f: any) => ({ ...f, poamCount: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <input type="checkbox" id="conmon" checked={!!form.continuousMonitoringPlan} onChange={e => setForm((f: any) => ({ ...f, continuousMonitoringPlan: e.target.checked }))}
                  className="rounded border-slate-300" />
                <label htmlFor="conmon" className="text-sm text-slate-700">Continuous Monitoring Plan in place</label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button onClick={() => save.mutate(form)} disabled={save.isPending}
                className="px-5 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
