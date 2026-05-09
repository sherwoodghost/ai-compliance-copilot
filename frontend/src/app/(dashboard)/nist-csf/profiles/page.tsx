'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Shield, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CsfProfile {
  id: string;
  profileName: string;
  profileType: 'current' | 'target' | 'baseline';
  csfFunction: 'GV' | 'ID' | 'PR' | 'DE' | 'RS' | 'RC';
  categoryId: string;
  categoryTitle: string;
  currentTier: 1 | 2 | 3 | 4;
  targetTier: 1 | 2 | 3 | 4;
  priority: 'critical' | 'high' | 'medium' | 'low';
  implementationStatus: 'not_started' | 'partial' | 'largely_implemented' | 'fully_implemented';
  rationale: string;
  gaps: string;
  owner: string;
  targetDate: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const FUNCTION_META: Record<string, { label: string; color: string; bg: string }> = {
  GV: { label: 'Govern',   color: 'text-purple-700', bg: 'bg-purple-100' },
  ID: { label: 'Identify', color: 'text-blue-700',   bg: 'bg-blue-100' },
  PR: { label: 'Protect',  color: 'text-green-700',  bg: 'bg-green-100' },
  DE: { label: 'Detect',   color: 'text-amber-700',  bg: 'bg-amber-100' },
  RS: { label: 'Respond',  color: 'text-red-700',    bg: 'bg-red-100' },
  RC: { label: 'Recover',  color: 'text-sky-700',    bg: 'bg-sky-100' },
};

function statusLabel(s: CsfProfile['implementationStatus']) {
  const m: Record<string, string> = {
    not_started:          'Not Started',
    partial:              'Partial',
    largely_implemented:  'Largely Implemented',
    fully_implemented:    'Fully Implemented',
  };
  return m[s] ?? s;
}

function statusColor(s: CsfProfile['implementationStatus']) {
  return s === 'fully_implemented' ? 'bg-green-100 text-green-700'
    : s === 'largely_implemented'  ? 'bg-blue-100 text-blue-700'
    : s === 'partial'              ? 'bg-amber-100 text-amber-700'
    : 'bg-slate-100 text-slate-600';
}

function tierGap(current: number, target: number) {
  const g = target - current;
  if (g === 0) return null;
  return g > 0 ? { label: `+${g} tier${g > 1 ? 's' : ''}`, color: 'text-amber-600' }
               : { label: `${g} tier${Math.abs(g) > 1 ? 's' : ''}`, color: 'text-slate-500' };
}

const EMPTY: Partial<CsfProfile> = {
  profileName: '', profileType: 'current', csfFunction: 'GV',
  categoryId: '', categoryTitle: '', currentTier: 1, targetTier: 2,
  priority: 'medium', implementationStatus: 'not_started',
  rationale: '', gaps: '', owner: '', targetDate: '', notes: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function CsfProfilesPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState<'create' | 'edit' | null>(null);
  const [form, setForm]         = useState<Partial<CsfProfile>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterFn, setFilterFn] = useState('');

  const { data: profiles = [], isLoading } = useQuery<CsfProfile[]>({
    queryKey: ['nist-csf-profiles'],
    queryFn: () => apiClient.get('/nist-csf/profiles').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (p: Partial<CsfProfile>) =>
      p.id ? apiClient.put(`/nist-csf/profiles/${p.id}`, p).then(r => r.data)
           : apiClient.post('/nist-csf/profiles', p).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['nist-csf-profiles'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/nist-csf/profiles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nist-csf-profiles'] }),
  });

  const fullyImpl  = profiles.filter(p => p.implementationStatus === 'fully_implemented').length;
  const withGaps   = profiles.filter(p => p.targetTier > p.currentTier).length;
  const avgTierGap = profiles.length
    ? (profiles.reduce((s, p) => s + Math.max(0, p.targetTier - p.currentTier), 0) / profiles.length).toFixed(1)
    : '0';

  const filtered = filterFn ? profiles.filter(p => p.csfFunction === filterFn) : profiles;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CSF Profile Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            NIST CSF 2.0 — Map current and target cybersecurity posture across all six functions
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Profile Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Profile Entries',    value: profiles.length, color: 'text-orange-600' },
          { label: 'Fully Implemented',  value: fullyImpl,        color: 'text-green-600' },
          { label: 'With Tier Gaps',     value: withGaps,         color: 'text-amber-600' },
          { label: 'Avg Tier Gap',       value: avgTierGap,       color: 'text-slate-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Function Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setFilterFn('')}
          className={cn('text-xs px-3 py-1.5 rounded-full border', filterFn === '' ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-200 text-slate-600')}>
          All ({profiles.length})
        </button>
        {Object.entries(FUNCTION_META).map(([fn, meta]) => (
          <button key={fn} onClick={() => setFilterFn(fn)}
            className={cn('text-xs px-3 py-1.5 rounded-full border',
              filterFn === fn ? 'bg-orange-600 text-white border-orange-600' : 'border-slate-200 text-slate-600')}>
            {fn} – {meta.label} ({profiles.filter(p => p.csfFunction === fn).length})
          </button>
        ))}
      </div>

      {/* Profiles List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-orange-600" />
          <span className="font-semibold text-slate-800 text-sm">Profile Entries ({filtered.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No profile entries yet — document current and target state for each CSF category.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(profile => {
              const isOpen = expanded === profile.id;
              const meta = FUNCTION_META[profile.csfFunction];
              const gap  = tierGap(profile.currentTier, profile.targetTier);
              return (
                <div key={profile.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : profile.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-mono font-medium', meta.bg, meta.color)}>
                          {profile.csfFunction}
                        </span>
                        {profile.categoryId && (
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{profile.categoryId}</span>
                        )}
                        <span className="font-medium text-sm text-slate-900">{profile.categoryTitle || profile.profileName}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(profile.implementationStatus))}>
                          {statusLabel(profile.implementationStatus)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>Tier {profile.currentTier} → {profile.targetTier}</span>
                        {gap && <span className={gap.color}>{gap.label} gap</span>}
                        {profile.owner && <span>{profile.owner}</span>}
                        {profile.targetDate && <span>Due: {profile.targetDate}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(profile); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-orange-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(profile.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 space-y-2 text-sm">
                      {profile.rationale && (
                        <div><span className="text-slate-500">Rationale: </span><span>{profile.rationale}</span></div>
                      )}
                      {profile.gaps && (
                        <div><span className="text-slate-500">Gaps: </span><span>{profile.gaps}</span></div>
                      )}
                      {profile.notes && (
                        <div><span className="text-slate-500">Notes: </span><span>{profile.notes}</span></div>
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
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add Profile Entry' : 'Edit Profile Entry'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Profile Name *</label>
                <input value={form.profileName ?? ''} onChange={e => setForm((f: any) => ({ ...f, profileName: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Q1 2026 Assessment" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Profile Type</label>
                <select value={form.profileType ?? 'current'} onChange={e => setForm((f: any) => ({ ...f, profileType: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="current">Current State</option>
                  <option value="target">Target State</option>
                  <option value="baseline">Baseline</option>
                </select>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Category ID</label>
                <input value={form.categoryId ?? ''} onChange={e => setForm((f: any) => ({ ...f, categoryId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="ID.AM-1" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Category Title *</label>
                <input value={form.categoryTitle ?? ''} onChange={e => setForm((f: any) => ({ ...f, categoryTitle: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Asset Management" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Tier</label>
                <select value={form.currentTier ?? 1} onChange={e => setForm((f: any) => ({ ...f, currentTier: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value={1}>Tier 1 – Partial</option>
                  <option value={2}>Tier 2 – Risk Informed</option>
                  <option value={3}>Tier 3 – Repeatable</option>
                  <option value={4}>Tier 4 – Adaptive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Tier</label>
                <select value={form.targetTier ?? 2} onChange={e => setForm((f: any) => ({ ...f, targetTier: +e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value={1}>Tier 1 – Partial</option>
                  <option value={2}>Tier 2 – Risk Informed</option>
                  <option value={3}>Tier 3 – Repeatable</option>
                  <option value={4}>Tier 4 – Adaptive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Implementation Status</label>
                <select value={form.implementationStatus ?? 'not_started'} onChange={e => setForm((f: any) => ({ ...f, implementationStatus: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="not_started">Not Started</option>
                  <option value="partial">Partial</option>
                  <option value="largely_implemented">Largely Implemented</option>
                  <option value="fully_implemented">Fully Implemented</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
                <select value={form.priority ?? 'medium'} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
                <input value={form.owner ?? ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="CISO" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Target Date</label>
                <input type="date" value={form.targetDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, targetDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Rationale</label>
                <textarea rows={2} value={form.rationale ?? ''} onChange={e => setForm((f: any) => ({ ...f, rationale: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Gaps / Deficiencies</label>
                <textarea rows={2} value={form.gaps ?? ''} onChange={e => setForm((f: any) => ({ ...f, gaps: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
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
