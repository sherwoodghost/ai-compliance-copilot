'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import {
  BookOpen, Plus, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, X, Calendar, Building2, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditCycle {
  id: string;
  framework: string;
  label: string;
  status: string;
  startDate: string;
  endDate?: string;
  auditorName?: string;
  auditorFirm?: string;
  notes?: string;
  outcome?: string;
  createdAt: string;
  creator: { id: string; fullName: string };
  _count: { findings: number };
}

interface AuditFinding {
  id: string;
  auditCycleId: string;
  controlId?: string;
  findingType: string;
  severity: string;
  title: string;
  description: string;
  remediation?: string;
  lessonLearned?: string;
  status: string;
  resolvedAt?: string;
  auditCycle: { id: string; label: string; framework: string };
  control?: { id: string; code: string; title: string };
  resolver?: { id: string; fullName: string };
}

interface Stats {
  totalCycles: number;
  activeCycle?: { id: string; label: string; framework: string; startDate: string };
  totalFindings: number;
  openFindings: number;
  lessonsLearned: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  low: 'bg-blue-100 text-blue-700 border-blue-200',
  informational: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function NewCycleModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    framework: 'SOC2',
    label: '',
    startDate: new Date().toISOString().split('T')[0],
    auditorName: '',
    auditorFirm: '',
    notes: '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Start Audit Cycle</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Framework</label>
            <select className="input-field" value={form.framework} onChange={e => setForm({ ...form, framework: e.target.value })}>
              <option value="SOC2">SOC 2</option>
              <option value="ISO27001">ISO 27001</option>
              <option value="HIPAA">HIPAA</option>
              <option value="GDPR">GDPR</option>
              <option value="PCI_DSS">PCI DSS</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cycle Label *</label>
            <input className="input-field" placeholder="e.g. FY2025 SOC 2 Type II" value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
            <input type="date" className="input-field" value={form.startDate}
              onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Auditor Name</label>
              <input className="input-field" placeholder="Jane Smith" value={form.auditorName}
                onChange={e => setForm({ ...form, auditorName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Auditor Firm</label>
              <input className="input-field" placeholder="Deloitte" value={form.auditorFirm}
                onChange={e => setForm({ ...form, auditorFirm: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input-field resize-none" rows={2} placeholder="Optional context..."
              value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-sm" disabled={!form.label} onClick={() => onSave(form)}>
            Start Cycle
          </button>
        </div>
      </div>
    </div>
  );
}

function NewFindingModal({ cycles, onClose, onSave }: {
  cycles: AuditCycle[]; onClose: () => void; onSave: (data: any) => void;
}) {
  const [form, setForm] = useState({
    auditCycleId: cycles[0]?.id ?? '',
    findingType: 'deficiency',
    severity: 'medium',
    title: '',
    description: '',
    remediation: '',
    lessonLearned: '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Log Finding</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Audit Cycle</label>
            <select className="input-field" value={form.auditCycleId} onChange={e => setForm({ ...form, auditCycleId: e.target.value })}>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select className="input-field" value={form.findingType} onChange={e => setForm({ ...form, findingType: e.target.value })}>
                <option value="deficiency">Deficiency</option>
                <option value="observation">Observation</option>
                <option value="recommendation">Recommendation</option>
                <option value="exception">Exception</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
              <select className="input-field" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="informational">Informational</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input className="input-field" placeholder="Brief description of finding" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
            <textarea className="input-field resize-none" rows={3} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Remediation taken</label>
            <textarea className="input-field resize-none" rows={2} placeholder="What was done to address this..."
              value={form.remediation} onChange={e => setForm({ ...form, remediation: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lesson learned</label>
            <textarea className="input-field resize-none" rows={2} placeholder="What would you do differently..."
              value={form.lessonLearned} onChange={e => setForm({ ...form, lessonLearned: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-sm" disabled={!form.title || !form.description} onClick={() => onSave(form)}>
            Log Finding
          </button>
        </div>
      </div>
    </div>
  );
}

function CycleCard({ cycle, onAddFinding }: { cycle: AuditCycle; onAddFinding: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: cycleDetail } = useQuery({
    queryKey: ['audit-cycle-detail', cycle.id],
    queryFn: () => apiClient.get<AuditCycle & { findings: AuditFinding[] }>(`/audit-memory/cycles/${cycle.id}`).then((r: any) => r.data as AuditCycle & { findings: AuditFinding[] }),
    enabled: expanded,
  });

  const resolveFinding = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch(`/audit-memory/findings/${id}`, { status: 'resolved' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-cycle-detail', cycle.id] }),
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{cycle.label}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', STATUS_COLORS[cycle.status] ?? 'bg-gray-100 text-gray-500')}>
              {cycle.status}
            </span>
            <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{cycle.framework}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(cycle.startDate).toLocaleDateString()}
              {cycle.endDate && ` – ${new Date(cycle.endDate).toLocaleDateString()}`}
            </span>
            {cycle.auditorFirm && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Building2 className="w-3 h-3" />{cycle.auditorFirm}
              </span>
            )}
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <FileText className="w-3 h-3" />{cycle._count.findings} findings
            </span>
          </div>
        </div>
        <button
          className="text-xs btn-secondary shrink-0"
          onClick={e => { e.stopPropagation(); onAddFinding(); }}
        >
          + Finding
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {cycle.notes && (
            <p className="text-xs text-gray-500 mb-4 bg-gray-50 rounded p-3">{cycle.notes}</p>
          )}
          {!cycleDetail?.findings?.length ? (
            <p className="text-xs text-gray-400 text-center py-4">No findings logged yet</p>
          ) : (
            <div className="space-y-3">
              {cycleDetail.findings.map(f => (
                <div key={f.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className={cn('text-xs px-2 py-0.5 rounded border font-medium shrink-0', SEVERITY_COLORS[f.severity] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                      {f.severity}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 justify-between">
                        <p className="text-sm font-medium text-gray-900">{f.title}</p>
                        <span className="text-xs text-gray-400 shrink-0 capitalize">{f.findingType}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{f.description}</p>
                      {f.control && (
                        <p className="text-xs text-brand-600 mt-1">Control: {f.control.code} — {f.control.title}</p>
                      )}
                      {f.remediation && (
                        <div className="mt-2 p-2 bg-green-50 rounded text-xs text-green-800">
                          <span className="font-medium">Remediation: </span>{f.remediation}
                        </div>
                      )}
                      {f.lessonLearned && (
                        <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                          <span className="font-medium">💡 Lesson: </span>{f.lessonLearned}
                        </div>
                      )}
                    </div>
                    {f.status !== 'resolved' && (
                      <button
                        className="text-xs text-green-600 hover:text-green-700 shrink-0 mt-0.5"
                        onClick={() => resolveFinding.mutate(f.id)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    {f.status === 'resolved' && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuditHistoryPage() {
  const qc = useQueryClient();
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewFinding, setShowNewFinding] = useState(false);
  const [tab, setTab] = useState<'cycles' | 'findings'>('cycles');

  const { data: stats } = useQuery({
    queryKey: ['audit-memory-stats'],
    queryFn: () => apiClient.get<Stats>('/audit-memory/stats').then((r: any) => r.data as Stats),
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['audit-cycles'],
    queryFn: () => apiClient.get<AuditCycle[]>('/audit-memory/cycles').then((r: any) => r.data as AuditCycle[]),
  });

  const { data: allFindings = [] } = useQuery({
    queryKey: ['audit-findings'],
    queryFn: () => apiClient.get<AuditFinding[]>('/audit-memory/findings').then((r: any) => r.data as AuditFinding[]),
    enabled: tab === 'findings',
  });

  const createCycle = useMutation({
    mutationFn: (data: any) => apiClient.post('/audit-memory/cycles', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-cycles'] });
      qc.invalidateQueries({ queryKey: ['audit-memory-stats'] });
      setShowNewCycle(false);
    },
  });

  const createFinding = useMutation({
    mutationFn: (data: any) => apiClient.post('/audit-memory/findings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-cycles'] });
      qc.invalidateQueries({ queryKey: ['audit-memory-stats'] });
      qc.invalidateQueries({ queryKey: ['audit-findings'] });
      setShowNewFinding(false);
    },
  });

  const openFindings = allFindings.filter(f => f.status === 'open' || f.status === 'in_progress');
  const resolvedFindings = allFindings.filter(f => f.status === 'resolved');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Compliance Memory</h1>
            <p className="text-xs text-gray-500">Track audit cycles, findings, and lessons learned across years</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => setShowNewFinding(true)}>
            <Plus className="w-3.5 h-3.5" /> Log Finding
          </button>
          <button className="btn-primary text-sm flex items-center gap-1.5" onClick={() => setShowNewCycle(true)}>
            <Plus className="w-3.5 h-3.5" /> New Audit Cycle
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Cycles', value: stats?.totalCycles ?? 0, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active Cycle', value: stats?.activeCycle?.label ?? 'None', icon: Clock, color: 'text-green-600 bg-green-50', small: true },
          { label: 'Total Findings', value: stats?.totalFindings ?? 0, icon: FileText, color: 'text-gray-600 bg-gray-50' },
          { label: 'Open Findings', value: stats?.openFindings ?? 0, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
          { label: 'Lessons Learned', value: stats?.lessonsLearned ?? 0, icon: BookOpen, color: 'text-amber-600 bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, small }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', color)}>
              <Icon className="w-4 h-4" />
            </div>
            <p className={cn('font-semibold text-gray-900', small ? 'text-xs truncate' : 'text-lg')}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['cycles', 'findings'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 capitalize',
              tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'cycles' ? `Audit Cycles (${cycles.length})` : `All Findings (${stats?.totalFindings ?? 0})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'cycles' ? (
        <div className="space-y-3">
          {!cycles.length ? (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-500">No audit cycles yet</p>
              <p className="text-xs text-gray-400 mt-1">Start tracking your first audit cycle to build institutional memory</p>
              <button className="btn-primary text-sm mt-4" onClick={() => setShowNewCycle(true)}>Start First Cycle</button>
            </div>
          ) : (
            cycles.map(cycle => (
              <CycleCard key={cycle.id} cycle={cycle} onAddFinding={() => setShowNewFinding(true)} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {openFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500" /> Open Findings ({openFindings.length})
              </h3>
              <div className="space-y-2">
                {openFindings.map(f => (
                  <div key={f.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded border font-medium shrink-0', SEVERITY_COLORS[f.severity])}>
                        {f.severity}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{f.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{f.auditCycle.label} · {f.auditCycle.framework}</p>
                        <p className="text-xs text-gray-600 mt-1">{f.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolvedFindings.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Resolved with Lessons ({resolvedFindings.length})
              </h3>
              <div className="space-y-2">
                {resolvedFindings.filter(f => f.lessonLearned).map(f => (
                  <div key={f.id} className="bg-white rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-900">{f.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.auditCycle.label}</p>
                    {f.lessonLearned && (
                      <div className="mt-2 p-2 bg-amber-50 rounded text-xs text-amber-800">
                        <span className="font-medium">💡 </span>{f.lessonLearned}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!allFindings.length && (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-400">No findings logged yet</p>
            </div>
          )}
        </div>
      )}

      {showNewCycle && (
        <NewCycleModal
          onClose={() => setShowNewCycle(false)}
          onSave={data => createCycle.mutate(data)}
        />
      )}

      {showNewFinding && (
        <NewFindingModal
          cycles={cycles}
          onClose={() => setShowNewFinding(false)}
          onSave={data => createFinding.mutate(data)}
        />
      )}
    </div>
  );
}
