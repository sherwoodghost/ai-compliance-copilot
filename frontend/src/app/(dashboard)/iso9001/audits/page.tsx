'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ScrollText, Plus, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface AuditFinding {
  title: string;
  severity: string;
  description?: string;
}

interface ProcessAudit {
  id: string;
  processName: string;
  scheduledAt: string;
  completedAt?: string;
  auditorId?: string;
  status: string;
  findings: AuditFinding[];
  notes?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled:   { label: 'Scheduled',   color: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700' },
  cancelled:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600' },
};

const FINDING_SEVERITY_COLORS: Record<string, string> = {
  major:       'bg-red-100 text-red-700',
  minor:       'bg-amber-100 text-amber-700',
  observation: 'bg-blue-100 text-blue-700',
};

function isOverdue(audit: ProcessAudit) {
  return audit.status === 'scheduled' && new Date(audit.scheduledAt) < new Date();
}

export default function ProcessAuditsPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<ProcessAudit | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [closeNotes, setCloseNotes] = useState('');
  const [findingInput, setFindingInput] = useState({ title: '', severity: 'minor', description: '' });
  const [form, setForm] = useState({ processName: '', scheduledAt: '' });

  const { data: audits = [], isLoading } = useQuery<ProcessAudit[]>({
    queryKey: ['quality-audits'],
    queryFn: () => apiClient.get('/quality/audits').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/quality/audits', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality-audits'] });
      setShowForm(false);
      setForm({ processName: '', scheduledAt: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.patch(`/quality/audits/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality-audits'] });
      setCloseTarget(null);
      setFindings([]);
      setCloseNotes('');
    },
  });

  const scheduled = audits.filter(a => a.status === 'scheduled' || a.status === 'in_progress');
  const overdue   = audits.filter(isOverdue);
  const openFindings = audits
    .filter(a => a.status !== 'completed')
    .flatMap(a => a.findings ?? []).length;

  function addFinding() {
    if (!findingInput.title.trim()) return;
    setFindings(prev => [...prev, { ...findingInput }]);
    setFindingInput({ title: '', severity: 'minor', description: '' });
  }

  function removeFinding(i: number) {
    setFindings(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <ScrollText className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Process Audits</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 9001 Clause 9.2 — Internal audit schedule and findings management</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Schedule Audit
        </button>
      </div>

      {overdue.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {overdue.length} audit{overdue.length !== 1 ? 's' : ''} overdue — complete or reschedule immediately
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className={`border rounded-xl p-4 ${scheduled.length > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${scheduled.length > 0 ? 'text-blue-600' : 'text-gray-900'}`}>{scheduled.length}</div>
          <div className={`text-sm ${scheduled.length > 0 ? 'text-blue-500' : 'text-gray-500'}`}>Scheduled</div>
        </div>
        <div className={`border rounded-xl p-4 ${overdue.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>{overdue.length}</div>
          <div className={`text-sm ${overdue.length > 0 ? 'text-red-500' : 'text-gray-500'}`}>Overdue</div>
        </div>
        <div className={`border rounded-xl p-4 ${openFindings > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${openFindings > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{openFindings}</div>
          <div className={`text-sm ${openFindings > 0 ? 'text-amber-500' : 'text-gray-500'}`}>Open Findings</div>
        </div>
      </div>

      {/* Schedule Audit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Schedule Audit</h2>
            </div>
            <form
              onSubmit={e => { e.preventDefault(); createMutation.mutate(form); }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Process Name *</label>
                <input
                  required
                  value={form.processName}
                  onChange={e => setForm(f => ({ ...f, processName: e.target.value }))}
                  placeholder="e.g. Customer Order Fulfillment, Supplier Evaluation"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                <input
                  required
                  type="date"
                  value={form.scheduledAt}
                  onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Scheduling…' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close/Complete Audit Modal */}
      {closeTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Complete Audit</h2>
              <p className="text-sm text-gray-500 mt-0.5">{closeTarget.processName}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Audit Notes</label>
                <textarea
                  rows={3}
                  value={closeNotes}
                  onChange={e => setCloseNotes(e.target.value)}
                  placeholder="Summary of audit observations..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Findings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Findings</label>
                {findings.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {findings.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium mr-2 ${FINDING_SEVERITY_COLORS[f.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                            {f.severity}
                          </span>
                          <span className="text-sm text-gray-700">{f.title}</span>
                          {f.description && <p className="text-xs text-gray-500 mt-0.5 ml-0">{f.description}</p>}
                        </div>
                        <button onClick={() => removeFinding(i)} className="text-gray-400 hover:text-red-500 text-xs shrink-0">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value={findingInput.severity}
                    onChange={e => setFindingInput(fi => ({ ...fi, severity: e.target.value }))}
                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="observation">Observation</option>
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                  </select>
                  <input
                    value={findingInput.title}
                    onChange={e => setFindingInput(fi => ({ ...fi, title: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addFinding())}
                    placeholder="Finding title..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={addFinding}
                    disabled={!findingInput.title.trim()}
                    className="px-3 py-1.5 text-sm text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-lg disabled:opacity-40"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setCloseTarget(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button
                  onClick={() => updateMutation.mutate({
                    id: closeTarget.id,
                    data: {
                      status: 'completed',
                      completedAt: new Date().toISOString(),
                      findings: findings.length > 0 ? findings : undefined,
                      notes: closeNotes || undefined,
                    },
                  })}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-1"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  {updateMutation.isPending ? 'Saving…' : 'Complete Audit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : audits.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <ScrollText className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No audits scheduled</p>
          <p className="text-sm text-gray-400 mt-1">
            ISO 9001 Clause 9.2 requires an annual internal audit program — schedule your first audit to begin
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map(audit => {
            const overdue = isOverdue(audit);
            const cfg = STATUS_CONFIG[audit.status] ?? { label: audit.status, color: 'bg-gray-100 text-gray-600' };
            const isExpanded = expandedId === audit.id;
            const hasMajorFindings = (audit.findings ?? []).some(f => f.severity === 'major');

            return (
              <div
                key={audit.id}
                className={`bg-white border rounded-xl overflow-hidden ${overdue ? 'border-red-300' : hasMajorFindings ? 'border-amber-300' : 'border-gray-200'}`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900">{audit.processName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                        {overdue && (
                          <span className="text-xs text-red-600 font-medium flex items-center gap-0.5">
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {audit.completedAt
                            ? `Completed ${new Date(audit.completedAt).toLocaleDateString()}`
                            : `Scheduled ${new Date(audit.scheduledAt).toLocaleDateString()}`}
                        </span>
                        {(audit.findings ?? []).length > 0 && (
                          <span className={hasMajorFindings ? 'text-amber-600 font-medium' : ''}>
                            {audit.findings.length} finding{audit.findings.length !== 1 ? 's' : ''}
                            {hasMajorFindings && ' (incl. major)'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {audit.status !== 'completed' && audit.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            setCloseTarget(audit);
                            setFindings(audit.findings ?? []);
                            setCloseNotes(audit.notes ?? '');
                          }}
                          className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg"
                        >
                          Complete
                        </button>
                      )}
                      {(audit.findings ?? []).length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : audit.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (audit.findings ?? []).length > 0 && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Findings</p>
                    <div className="space-y-2">
                      {audit.findings.map((f, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${FINDING_SEVERITY_COLORS[f.severity] ?? 'bg-gray-100 text-gray-600'}`}>
                            {f.severity}
                          </span>
                          <div>
                            <span className="text-sm text-gray-700">{f.title}</span>
                            {f.description && <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {audit.notes && (
                      <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                        <span className="font-medium">Notes:</span> {audit.notes}
                      </p>
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
}
