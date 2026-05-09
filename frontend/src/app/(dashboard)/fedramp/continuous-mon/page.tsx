'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  Activity, Plus, Pencil, Trash2, X, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConMonItem {
  id: string;
  controlId: string;
  controlFamily: string;
  monitoringFrequency: 'continuous' | 'monthly' | 'quarterly' | 'annually' | 'event_driven';
  monitoringMethod: string;
  lastMonitoredDate: string;
  nextMonitoringDue: string;
  status: 'compliant' | 'non_compliant' | 'deviation' | 'not_monitored' | 'pending';
  findingSeverity?: 'critical' | 'high' | 'moderate' | 'low' | 'informational';
  findingDescription?: string;
  remediationStatus?: 'open' | 'in_remediation' | 'remediated' | 'accepted_risk';
  remediationDate?: string;
  automatedMonitoring: boolean;
  toolUsed?: string;
  evidenceLocation?: string;
  notes: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  if (!dateStr) return Infinity;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function statusColor(s: ConMonItem['status']) {
  const m: Record<string, string> = {
    compliant:     'bg-green-100 text-green-700',
    non_compliant: 'bg-red-100 text-red-700',
    deviation:     'bg-orange-100 text-orange-700',
    not_monitored: 'bg-slate-100 text-slate-600',
    pending:       'bg-blue-100 text-blue-700',
  };
  return m[s] ?? 'bg-slate-100 text-slate-600';
}

function severityColor(s?: ConMonItem['findingSeverity']) {
  if (!s) return '';
  const m: Record<string, string> = {
    critical:      'bg-red-100 text-red-700',
    high:          'bg-orange-100 text-orange-700',
    moderate:      'bg-amber-100 text-amber-700',
    low:           'bg-yellow-100 text-yellow-700',
    informational: 'bg-blue-100 text-blue-700',
  };
  return m[s] ?? '';
}

function freqLabel(f: ConMonItem['monitoringFrequency']) {
  const m: Record<string, string> = {
    continuous: 'Continuous', monthly: 'Monthly', quarterly: 'Quarterly',
    annually: 'Annual', event_driven: 'Event-Driven',
  };
  return m[f] ?? f;
}

const CONTROL_FAMILIES = [
  'AC', 'AT', 'AU', 'CA', 'CM', 'CP', 'IA', 'IR', 'MA', 'MP',
  'PE', 'PL', 'PS', 'RA', 'SA', 'SC', 'SI',
];

const EMPTY: Partial<ConMonItem> = {
  controlId: '', controlFamily: 'AC', monitoringFrequency: 'monthly',
  monitoringMethod: '', lastMonitoredDate: '', nextMonitoringDue: '',
  status: 'not_monitored', findingSeverity: undefined, findingDescription: '',
  remediationStatus: undefined, remediationDate: '',
  automatedMonitoring: false, toolUsed: '', evidenceLocation: '', notes: '',
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContinuousMonPage() {
  const qc = useQueryClient();
  const [modal, setModal]     = useState<'create' | 'edit' | null>(null);
  const [form, setForm]       = useState<Partial<ConMonItem>>(EMPTY);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const { data: items = [], isLoading } = useQuery<ConMonItem[]>({
    queryKey: ['fedramp-conmon'],
    queryFn: () => apiClient.get('/fedramp/continuous-monitoring').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (item: Partial<ConMonItem>) =>
      item.id ? apiClient.put(`/fedramp/continuous-monitoring/${item.id}`, item).then(r => r.data)
              : apiClient.post('/fedramp/continuous-monitoring', item).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['fedramp-conmon'] }); setModal(null); },
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/fedramp/continuous-monitoring/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fedramp-conmon'] }),
  });

  const compliant    = items.filter(i => i.status === 'compliant').length;
  const nonCompliant = items.filter(i => i.status === 'non_compliant').length;
  const overdue      = items.filter(i => i.nextMonitoringDue && daysUntil(i.nextMonitoringDue) < 0).length;
  const openFindings = items.filter(i => i.remediationStatus === 'open' || i.remediationStatus === 'in_remediation').length;

  const filtered = filterStatus ? items.filter(i => i.status === filterStatus) : items;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Continuous Monitoring</h1>
          <p className="text-sm text-slate-500 mt-1">
            FedRAMP NIST SP 800-137 — Ongoing authorization control monitoring &amp; assessment
          </p>
        </div>
        <button
          onClick={() => { setForm(EMPTY); setModal('create'); }}
          className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Control
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Monitored Controls', value: items.length,    color: 'text-sky-600' },
          { label: 'Compliant',          value: compliant,        color: 'text-green-600' },
          { label: 'Non-Compliant',      value: nonCompliant,     color: 'text-red-600' },
          { label: 'Overdue Reviews',    value: overdue,          color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {nonCompliant > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{nonCompliant} control{nonCompliant > 1 ? 's' : ''}</strong> are non-compliant — initiate remediation and update the POA&amp;M.</span>
        </div>
      )}
      {overdue > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{overdue} monitoring activit{overdue > 1 ? 'ies' : 'y'}</strong> overdue — complete monitoring and report findings.</span>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">Filter:</span>
        {['', 'compliant', 'non_compliant', 'deviation', 'pending', 'not_monitored'].map(st => (
          <button key={st} onClick={() => setFilterStatus(st)}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-colors',
              filterStatus === st
                ? 'bg-sky-600 text-white border-sky-600'
                : 'border-slate-200 text-slate-600 hover:border-sky-400')}>
            {st === '' ? 'All' : st === 'non_compliant' ? 'Non-Compliant' : st === 'not_monitored' ? 'Not Monitored' : st.charAt(0).toUpperCase() + st.slice(1)}
            {st !== '' && ` (${items.filter(i => i.status === st).length})`}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600" />
          <span className="font-semibold text-slate-800 text-sm">Monitored Controls ({filtered.length})</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No controls configured for continuous monitoring.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(item => {
              const isOpen = expanded === item.id;
              const days = item.nextMonitoringDue ? daysUntil(item.nextMonitoringDue) : null;
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <button className="text-slate-400 hover:text-slate-600" onClick={() => setExpanded(isOpen ? null : item.id)}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono bg-sky-50 text-sky-700 px-2 py-0.5 rounded">{item.controlId}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{item.controlFamily}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColor(item.status))}>
                          {item.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </span>
                        {item.findingSeverity && (
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', severityColor(item.findingSeverity))}>
                            {item.findingSeverity.toUpperCase()}
                          </span>
                        )}
                        {item.automatedMonitoring && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Automated</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span>{freqLabel(item.monitoringFrequency)}</span>
                        {item.monitoringMethod && <span>{item.monitoringMethod}</span>}
                        {days !== null && (
                          <span className={cn(days < 0 ? 'text-red-600 font-medium' : days <= 14 ? 'text-amber-600' : '')}>
                            {days < 0 ? `${Math.abs(days)}d overdue` : `Due in ${days}d`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setForm(item); setModal('edit'); }} className="p-1.5 text-slate-400 hover:text-sky-600">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => remove.mutate(item.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-10 pb-4 bg-slate-50 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div><span className="text-slate-500">Last Monitored:</span> <span className="font-medium">{item.lastMonitoredDate || '—'}</span></div>
                      <div><span className="text-slate-500">Next Due:</span> <span className="font-medium">{item.nextMonitoringDue || '—'}</span></div>
                      {item.toolUsed && <div><span className="text-slate-500">Tool:</span> <span className="font-medium">{item.toolUsed}</span></div>}
                      {item.evidenceLocation && <div><span className="text-slate-500">Evidence:</span> <span className="font-medium">{item.evidenceLocation}</span></div>}
                      {item.remediationStatus && (
                        <div><span className="text-slate-500">Remediation:</span> <span className="font-medium">{item.remediationStatus.replace('_', ' ')}</span></div>
                      )}
                      {item.remediationDate && <div><span className="text-slate-500">Remediation Due:</span> <span className="font-medium">{item.remediationDate}</span></div>}
                      {item.findingDescription && (
                        <div className="col-span-full"><span className="text-slate-500">Finding:</span> <span>{item.findingDescription}</span></div>
                      )}
                      {item.notes && (
                        <div className="col-span-full"><span className="text-slate-500">Notes:</span> <span>{item.notes}</span></div>
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
              <h2 className="font-semibold text-slate-900">{modal === 'create' ? 'Add Monitored Control' : 'Edit Monitored Control'}</h2>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Control ID *</label>
                <input value={form.controlId ?? ''} onChange={e => setForm((f: any) => ({ ...f, controlId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="AC-2" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Control Family</label>
                <select value={form.controlFamily ?? 'AC'} onChange={e => setForm((f: any) => ({ ...f, controlFamily: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  {CONTROL_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Monitoring Frequency</label>
                <select value={form.monitoringFrequency ?? 'monthly'} onChange={e => setForm((f: any) => ({ ...f, monitoringFrequency: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="continuous">Continuous</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                  <option value="event_driven">Event-Driven</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                <select value={form.status ?? 'not_monitored'} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="compliant">Compliant</option>
                  <option value="non_compliant">Non-Compliant</option>
                  <option value="deviation">Deviation</option>
                  <option value="pending">Pending</option>
                  <option value="not_monitored">Not Monitored</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Monitoring Method</label>
                <input value={form.monitoringMethod ?? ''} onChange={e => setForm((f: any) => ({ ...f, monitoringMethod: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Automated scan, log review…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tool Used</label>
                <input value={form.toolUsed ?? ''} onChange={e => setForm((f: any) => ({ ...f, toolUsed: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Tenable, Splunk…" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Last Monitored Date</label>
                <input type="date" value={form.lastMonitoredDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, lastMonitoredDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Next Monitoring Due</label>
                <input type="date" value={form.nextMonitoringDue ?? ''} onChange={e => setForm((f: any) => ({ ...f, nextMonitoringDue: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Finding Severity</label>
                <select value={form.findingSeverity ?? ''} onChange={e => setForm((f: any) => ({ ...f, findingSeverity: e.target.value || undefined }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">None</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="moderate">Moderate</option>
                  <option value="low">Low</option>
                  <option value="informational">Informational</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Remediation Status</label>
                <select value={form.remediationStatus ?? ''} onChange={e => setForm((f: any) => ({ ...f, remediationStatus: e.target.value || undefined }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">N/A</option>
                  <option value="open">Open</option>
                  <option value="in_remediation">In Remediation</option>
                  <option value="remediated">Remediated</option>
                  <option value="accepted_risk">Accepted Risk</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Remediation Due Date</label>
                <input type="date" value={form.remediationDate ?? ''} onChange={e => setForm((f: any) => ({ ...f, remediationDate: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Evidence Location</label>
                <input value={form.evidenceLocation ?? ''} onChange={e => setForm((f: any) => ({ ...f, evidenceLocation: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="SharePoint, S3 bucket…" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="auto" checked={!!form.automatedMonitoring} onChange={e => setForm((f: any) => ({ ...f, automatedMonitoring: e.target.checked }))}
                  className="rounded border-slate-300" />
                <label htmlFor="auto" className="text-sm text-slate-700">Automated monitoring in place</label>
              </div>
              {form.findingSeverity && (
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Finding Description</label>
                  <textarea rows={2} value={form.findingDescription ?? ''} onChange={e => setForm((f: any) => ({ ...f, findingDescription: e.target.value }))}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </div>
              )}
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
