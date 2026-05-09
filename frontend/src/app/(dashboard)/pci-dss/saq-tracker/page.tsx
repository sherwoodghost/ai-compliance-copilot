'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  FileText, Plus, Pencil, Trash2, X, CheckCircle2, Clock,
  AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SaqRecord {
  id: string;
  saqType: 'SAQ-A' | 'SAQ-A-EP' | 'SAQ-B' | 'SAQ-B-IP' | 'SAQ-C' | 'SAQ-C-VT' | 'SAQ-D-Merchant' | 'SAQ-D-ServiceProvider' | 'ROC';
  merchantLevel: '1' | '2' | '3' | '4';
  assessmentYear: number;
  assessmentDate: string;
  completedDate: string;
  qsaName: string;
  qsaCompany: string;
  asvCompany: string;
  scanDate: string;
  scanResult: 'pass' | 'fail' | 'pending';
  status: 'not_started' | 'in_progress' | 'completed' | 'submitted';
  findingsCount: number;
  compensatingControlsCount: number;
  attestationDate: string;
  submittedToAcquirer: boolean;
  acquirerName: string;
  notes: string;
}

const SAQ_DESCRIPTIONS: Record<string, string> = {
  'SAQ-A':               'Card-not-present merchants, fully outsourced',
  'SAQ-A-EP':            'E-commerce, partially outsourced',
  'SAQ-B':               'Imprint machines or standalone dial-out terminals',
  'SAQ-B-IP':            'Standalone IP-connected terminals',
  'SAQ-C':               'Payment apps connected to internet',
  'SAQ-C-VT':            'Virtual payment terminals only',
  'SAQ-D-Merchant':      'All other merchants',
  'SAQ-D-ServiceProvider': 'Service providers eligible for SAQ',
  'ROC':                 'Report on Compliance (Level 1 merchants / QSA required)',
};

const STATUS_CFG: Record<string, { label: string; cls: string; icon: any }> = {
  not_started: { label: 'Not Started', cls: 'bg-gray-100 text-gray-500',    icon: Clock },
  in_progress: { label: 'In Progress', cls: 'bg-amber-100 text-amber-700',  icon: Clock },
  completed:   { label: 'Completed',   cls: 'bg-blue-100 text-blue-700',    icon: CheckCircle2 },
  submitted:   { label: 'Submitted',   cls: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
};

const EMPTY: Partial<SaqRecord> = {
  saqType: 'SAQ-D-Merchant', merchantLevel: '4',
  assessmentYear: new Date().getFullYear(),
  assessmentDate: '', completedDate: '',
  qsaName: '', qsaCompany: '', asvCompany: '',
  scanDate: '', scanResult: 'pending',
  status: 'not_started', findingsCount: 0,
  compensatingControlsCount: 0, attestationDate: '',
  submittedToAcquirer: false, acquirerName: '', notes: '',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PciSaqTrackerPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SaqRecord | null>(null);
  const [form, setForm] = useState<Partial<SaqRecord>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: saqs = [], isLoading } = useQuery<SaqRecord[]>({
    queryKey: ['pci-saq'],
    queryFn: async () => {
      const { data } = await apiClient.get('/pci-dss/saq');
      return data?.data ?? data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Partial<SaqRecord>) => {
      if (editing) await apiClient.put(`/pci-dss/saq/${editing.id}`, p);
      else await apiClient.post('/pci-dss/saq', p);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pci-saq'] }); closeForm(); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/pci-dss/saq/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pci-saq'] }),
  });

  function openNew() { setForm(EMPTY); setEditing(null); setShowForm(true); }
  function openEdit(s: SaqRecord) { setForm(s); setEditing(s); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(EMPTY); }

  const completed   = saqs.filter(s => s.status === 'submitted' || s.status === 'completed').length;
  const openFindings = saqs.reduce((acc, s) => acc + (s.findingsCount ?? 0), 0);
  const totalCC     = saqs.reduce((acc, s) => acc + (s.compensatingControlsCount ?? 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SAQ / Assessment Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">PCI DSS Req. 12 — Self-Assessment Questionnaire and QSA engagements</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
          <Plus className="h-4 w-4" /> Add Assessment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Assessments',      value: saqs.length, cls: 'text-gray-700' },
          { label: 'Completed/Submitted',    value: completed,   cls: 'text-green-600' },
          { label: 'Open Findings',          value: openFindings, cls: 'text-red-600' },
          { label: 'Compensating Controls',  value: totalCC,     cls: 'text-amber-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={cn('text-3xl font-bold', cls)}>{isLoading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Assessment list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-900">Assessment History</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading…</div>
        ) : saqs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No assessments tracked yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {saqs.map((s) => {
              const { label, cls, icon: Icon } = STATUS_CFG[s.status] ?? STATUS_CFG['not_started'];
              const isOpen = expanded === s.id;
              return (
                <div key={s.id}>
                  <div
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : s.id)}
                  >
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded shrink-0">
                      {s.saqType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {s.assessmentYear} — {SAQ_DESCRIPTIONS[s.saqType] ?? s.saqType}
                      </p>
                      <p className="text-xs text-gray-400">
                        Level {s.merchantLevel} merchant
                        {s.qsaCompany ? ` · QSA: ${s.qsaCompany}` : ''}
                      </p>
                    </div>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0', cls)}>
                      <Icon className="h-3 w-3" />{label}
                    </span>
                    {s.findingsCount > 0 && (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">
                        {s.findingsCount} finding{s.findingsCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-1.5 text-gray-400 hover:text-gray-700 rounded"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); remove.mutate(s.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 className="h-3.5 w-3.5" /></button>
                      {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 grid grid-cols-3 gap-3 pt-3">
                      <div><span className="font-medium text-gray-700">Assessment Date:</span> {s.assessmentDate || '—'}</div>
                      <div><span className="font-medium text-gray-700">Completed:</span> {s.completedDate || '—'}</div>
                      <div><span className="font-medium text-gray-700">Attestation Date:</span> {s.attestationDate || '—'}</div>
                      <div><span className="font-medium text-gray-700">ASV Scan:</span> {s.scanResult} {s.scanDate ? `(${s.scanDate})` : ''}</div>
                      <div><span className="font-medium text-gray-700">Acquirer:</span> {s.acquirerName || '—'}</div>
                      <div><span className="font-medium text-gray-700">Submitted:</span> {s.submittedToAcquirer ? 'Yes' : 'No'}</div>
                      {s.compensatingControlsCount > 0 && (
                        <div className="col-span-3"><span className="font-medium text-gray-700">Compensating Controls:</span> {s.compensatingControlsCount}</div>
                      )}
                      {s.notes && <div className="col-span-3"><span className="font-medium text-gray-700">Notes:</span> {s.notes}</div>}
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">{editing ? 'Edit Assessment' : 'Add Assessment'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">SAQ / Assessment Type *</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.saqType ?? 'SAQ-D-Merchant'} onChange={e => setForm((f: any) => ({ ...f, saqType: e.target.value }))}>
                    {Object.entries(SAQ_DESCRIPTIONS).map(([k, v]) => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">{SAQ_DESCRIPTIONS[form.saqType ?? 'SAQ-D-Merchant']}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Merchant Level</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.merchantLevel ?? '4'} onChange={e => setForm((f: any) => ({ ...f, merchantLevel: e.target.value }))}>
                    <option value="1">Level 1 (&gt;6M txns/yr)</option>
                    <option value="2">Level 2 (1–6M txns/yr)</option>
                    <option value="3">Level 3 (20K–1M txns/yr)</option>
                    <option value="4">Level 4 (&lt;20K txns/yr)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Assessment Year</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.assessmentYear ?? new Date().getFullYear()} onChange={e => setForm((f: any) => ({ ...f, assessmentYear: parseInt(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Status</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.status ?? 'not_started'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="submitted">Submitted to Acquirer</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Assessment Start Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.assessmentDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, assessmentDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Completed Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.completedDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, completedDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">QSA Name</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.qsaName ?? ''} onChange={e => setForm((f: any) => ({ ...f, qsaName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">QSA Company</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.qsaCompany ?? ''} onChange={e => setForm((f: any) => ({ ...f, qsaCompany: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">ASV Company</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.asvCompany ?? ''} onChange={e => setForm((f: any) => ({ ...f, asvCompany: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">ASV Scan Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.scanDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, scanDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Scan Result</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.scanResult ?? 'pending'} onChange={e => setForm((f: any) => ({ ...f, scanResult: e.target.value }))}>
                    <option value="pass">Pass</option>
                    <option value="fail">Fail</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Open Findings</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.findingsCount ?? 0} onChange={e => setForm((f: any) => ({ ...f, findingsCount: parseInt(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Compensating Controls</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.compensatingControlsCount ?? 0} onChange={e => setForm((f: any) => ({ ...f, compensatingControlsCount: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Acquirer Name</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.acquirerName ?? ''} onChange={e => setForm((f: any) => ({ ...f, acquirerName: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" className="accent-amber-600"
                  checked={form.submittedToAcquirer ?? false} onChange={e => setForm((f: any) => ({ ...f, submittedToAcquirer: e.target.checked }))} />
                Submitted to acquirer / payment brand
              </label>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-1 block">Notes</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none" rows={2}
                  value={form.notes ?? ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={closeForm} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={() => save.mutate(form)}
                disabled={save.isPending}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
              >
                {save.isPending ? 'Saving…' : editing ? 'Update' : 'Add Assessment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
