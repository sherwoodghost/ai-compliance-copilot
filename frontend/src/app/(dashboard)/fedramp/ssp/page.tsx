'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Server, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, CheckCircle, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SspSection {
  id: string;
  sectionNumber: string;
  sectionTitle: string;
  nistFamily: string;
  completionStatus: 'not_started' | 'in_progress' | 'complete' | 'not_applicable';
  lastUpdated: string;
  updatedBy: string;
  reviewRequired: boolean;
  content: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: SspSection['completionStatus']) {
  const m: Record<string, string> = {
    complete:       'bg-green-100 text-green-700',
    in_progress:    'bg-blue-100 text-blue-700',
    not_started:    'bg-slate-100 text-slate-600',
    not_applicable: 'bg-slate-100 text-slate-400',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
}

function statusLabel(s: SspSection['completionStatus']) {
  const m: Record<string, string> = {
    complete:       'Complete',
    in_progress:    'In Progress',
    not_started:    'Not Started',
    not_applicable: 'N/A',
  };
  return m[s] ?? s;
}

const NIST_FAMILIES = [
  'AC - Access Control', 'AT - Awareness & Training', 'AU - Audit & Accountability',
  'CA - Assessment, Authorization & Monitoring', 'CM - Configuration Management',
  'CP - Contingency Planning', 'IA - Identification & Authentication',
  'IR - Incident Response', 'MA - Maintenance', 'MP - Media Protection',
  'PE - Physical & Environmental', 'PL - Planning', 'PS - Personnel Security',
  'RA - Risk Assessment', 'SA - System & Services Acquisition',
  'SC - System & Communications Protection', 'SI - System & Information Integrity',
  'General',
];

const EMPTY: Partial<SspSection> = {
  sectionNumber: '', sectionTitle: '', nistFamily: 'General',
  completionStatus: 'not_started', lastUpdated: '', updatedBy: '',
  reviewRequired: false, content: '', notes: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function SspPage() {
  const qc = useQueryClient();
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null);
  const [form, setForm]       = useState<Partial<SspSection>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterFamily, setFilterFamily] = useState('');

  const { data: sections = [], isLoading } = useQuery<SspSection[]>({
    queryKey: ['fedramp-ssp'],
    queryFn: () => apiClient.get('/fedramp/ssp').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (s: Partial<SspSection>) =>
      s.id ? apiClient.put(`/fedramp/ssp/${s.id}`, s).then(r => r.data)
           : apiClient.post('/fedramp/ssp', s).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fedramp-ssp'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fedramp/ssp/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fedramp-ssp'] }),
  });

  const complete   = sections.filter(s => s.completionStatus === 'complete').length;
  const inProgress = sections.filter(s => s.completionStatus === 'in_progress').length;
  const pct        = sections.length ? Math.round((complete / sections.length) * 100) : 0;
  const needsReview = sections.filter(s => s.reviewRequired && s.completionStatus !== 'not_applicable').length;

  const filtered = filterFamily
    ? sections.filter(s => s.nistFamily.startsWith(filterFamily))
    : sections;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">System Security Plan (SSP)</h1>
          <p className="text-sm text-slate-500 mt-1">
            FedRAMP NIST SP 800-18 — Document and track all SSP control implementation statements
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Section
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sections',  value: sections.length,    color: 'text-sky-600' },
          { label: 'Complete',        value: complete,            color: 'text-green-600' },
          { label: 'In Progress',     value: inProgress,          color: 'text-blue-600' },
          { label: 'Needs Review',    value: needsReview,         color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      {sections.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">SSP Completion</span>
            <span className="text-sm font-bold text-sky-700">{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3">
            <div className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">Filter by NIST Family:</label>
        <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Families</option>
          {NIST_FAMILIES.map(f => <option key={f} value={f.split(' - ')[0]}>{f}</option>)}
        </select>
        <span className="text-xs text-slate-500">{filtered.length} section{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Sections List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Server className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800 text-sm">SSP Sections</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No sections yet — add SSP sections to track completion.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(sec => {
              const isOpen = expanded === sec.id;
              return (
                <div key={sec.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : sec.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded">{sec.sectionNumber}</span>
                        <span className="font-medium text-sm text-slate-900">{sec.sectionTitle}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(sec.completionStatus))}>
                          {statusLabel(sec.completionStatus)}
                        </span>
                        {sec.reviewRequired && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Review Required</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{sec.nistFamily}</span>
                        {sec.lastUpdated && <span>Updated: {sec.lastUpdated}</span>}
                        {sec.updatedBy && <span>By: {sec.updatedBy}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(sec); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-sky-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(sec.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 space-y-2 text-sm">
                      {sec.content && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Implementation Statement</p>
                          <p className="text-slate-700 whitespace-pre-wrap">{sec.content}</p>
                        </div>
                      )}
                      {sec.notes && (
                        <div>
                          <p className="text-xs font-medium text-slate-500 mb-1">Notes</p>
                          <p className="text-slate-600">{sec.notes}</p>
                        </div>
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
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add SSP Section' : 'Edit SSP Section'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Section Number *</label>
                <input value={form.sectionNumber ?? ''} onChange={e => setForm((f: any) => ({ ...f, sectionNumber: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="13.1.1" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Section Title *</label>
                <input value={form.sectionTitle ?? ''} onChange={e => setForm((f: any) => ({ ...f, sectionTitle: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Access Enforcement" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">NIST Control Family</label>
                <select value={form.nistFamily ?? 'General'} onChange={e => setForm((f: any) => ({ ...f, nistFamily: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {NIST_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Completion Status</label>
                <select value={form.completionStatus ?? 'not_started'} onChange={e => setForm((f: any) => ({ ...f, completionStatus: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="not_applicable">Not Applicable</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Updated</label>
                <input type="date" value={form.lastUpdated ?? ''} onChange={e => setForm((f: any) => ({ ...f, lastUpdated: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Updated By</label>
                <input value={form.updatedBy ?? ''} onChange={e => setForm((f: any) => ({ ...f, updatedBy: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="John Smith" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="review" checked={!!form.reviewRequired} onChange={e => setForm((f: any) => ({ ...f, reviewRequired: e.target.checked }))}
                  className="rounded border-slate-300" />
                <label htmlFor="review" className="text-sm text-slate-700">Review required before next assessment</label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Implementation Statement</label>
                <textarea rows={4} value={form.content ?? ''} onChange={e => setForm((f: any) => ({ ...f, content: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none"
                  placeholder="Describe how this control is implemented in the system…" />
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
