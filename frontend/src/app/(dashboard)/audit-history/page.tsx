'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auditApi, AuditCycle, AuditFinding, AuditStats } from '@/lib/api/audit';
import {
  BookOpen, Plus, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, Clock, X, Calendar, Building2, FileText,
  Sparkles, Copy, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// AuditCycle and AuditFinding imported from @/lib/api/audit

// Stats: use AuditStats from @/lib/api/audit + extra audit-memory-specific fields
interface Stats extends AuditStats {
  activeCycle?: { id: string; label: string; framework: string; startDate: string };
  totalFindings: number;
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
              <option value="PCI_DSS">PCI DSS v4.0</option>
              <option value="FEDRAMP">FedRAMP</option>
              <option value="NIST_CSF">NIST CSF 2.0</option>
              <option value="ISO9001">ISO 9001</option>
              <option value="ISO14001">ISO 14001</option>
              <option value="ISO45001">ISO 45001</option>
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
  const [debrief, setDebrief] = useState<any | null>(null);
  const [remediating, setRemediating] = useState<string | null>(null);
  const [aiResults, setAiResults] = useState<Record<string, any>>({});
  const [copiedDebrief, setCopiedDebrief] = useState(false);
  const qc = useQueryClient();

  const { data: cycleDetail } = useQuery({
    queryKey: ['audit-cycle-detail', cycle.id],
    queryFn: () => auditApi.getCycle(cycle.id),
    enabled: expanded,
  });

  const resolveFinding = useMutation({
    mutationFn: (id: string) => auditApi.resolveFinding(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit-cycle-detail', cycle.id] }),
  });

  const generateDebrief = useMutation({
    mutationFn: () => auditApi.aiDebrief(cycle.id),
    onSuccess: (data) => setDebrief(data),
  });

  async function aiRemediateFinding(findingId: string) {
    setRemediating(findingId);
    try {
      const res = await auditApi.aiFindingRemediation(findingId);
      setAiResults((prev) => ({ ...prev, [findingId]: res }));
      qc.invalidateQueries({ queryKey: ['audit-cycle-detail', cycle.id] });
    } finally {
      setRemediating(null);
    }
  }

  function copyDebrief() {
    if (!debrief) return;
    const text = [
      `AUDIT DEBRIEF — ${debrief.cycleLabel} (${debrief.framework})`,
      ``,
      debrief.executiveSummary,
      ``,
      `STRENGTHS:`,
      ...debrief.strengths.map((s: string) => `• ${s}`),
      ``,
      `KEY FINDINGS:`,
      ...debrief.keyFindings.map((f: string) => `• ${f}`),
      ``,
      `LESSONS LEARNED:`,
      ...debrief.lessonsLearned.map((l: string) => `• ${l}`),
      ``,
      `NEXT CYCLE RECOMMENDATIONS:`,
      ...debrief.nextCycleRecommendations.map((r: string) => `• ${r}`),
      ``,
      `PRIORITY ACTIONS:`,
      ...debrief.priorityActions.map((a: string, i: number) => `${i + 1}. ${a}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedDebrief(true);
    setTimeout(() => setCopiedDebrief(false), 2000);
  }

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
        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60"
            onClick={() => generateDebrief.mutate()}
            disabled={generateDebrief.isPending}
            title="Generate AI debrief for this cycle"
          >
            {generateDebrief.isPending
              ? <span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              : <Sparkles className="w-3 h-3" />
            }
            Debrief
          </button>
          <button
            className="text-xs btn-secondary shrink-0"
            onClick={() => onAddFinding()}
          >
            + Finding
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {cycle.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded p-3">{cycle.notes}</p>
          )}

          {/* AI Debrief Panel */}
          {debrief && (
            <div className="rounded-xl bg-purple-50 border border-purple-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />AI Cycle Debrief
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={copyDebrief} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1">
                    {copiedDebrief ? <><Check className="w-3 h-3" />Copied</> : <><Copy className="w-3 h-3" />Copy</>}
                  </button>
                  <button onClick={() => setDebrief(null)} className="text-purple-400 hover:text-purple-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <p className="text-xs text-gray-700">{debrief.executiveSummary}</p>
              {debrief.keyFindings?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Key Findings</p>
                  {debrief.keyFindings.map((f: string, i: number) => (
                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5 mb-0.5">
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />{f}
                    </p>
                  ))}
                </div>
              )}
              {debrief.priorityActions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Priority Actions Before Next Audit</p>
                  {debrief.priorityActions.map((a: string, i: number) => (
                    <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5 mb-0.5">
                      <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>{a}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {!cycleDetail?.findings?.length ? (
            <p className="text-xs text-gray-400 text-center py-4">No findings logged yet</p>
          ) : (
            <div className="space-y-3">
              {cycleDetail.findings.map(f => {
                const aiResult = aiResults[f.id];
                return (
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
                        {/* AI result inline */}
                        {aiResult && !f.remediation && (
                          <div className="mt-2 p-2 bg-purple-50 border border-purple-100 rounded text-xs space-y-1">
                            <p className="font-semibold text-purple-800 flex items-center gap-1"><Sparkles className="w-3 h-3" />AI Remediation Plan ({aiResult.estimatedTimeline})</p>
                            {aiResult.remediationSteps?.slice(0,3).map((s: string, i: number) => (
                              <p key={i} className="text-purple-700">• {s}</p>
                            ))}
                          </div>
                        )}
                        {/* AI Remediation button — only for open findings without remediation */}
                        {f.status !== 'resolved' && !f.remediation && (
                          <button
                            className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
                            onClick={() => aiRemediateFinding(f.id)}
                            disabled={remediating === f.id}
                          >
                            {remediating === f.id
                              ? <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generating…</>
                              : <><Sparkles className="w-3 h-3" />AI Remediation Plan</>
                            }
                          </button>
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
                );
              })}
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
    queryFn: () => auditApi.getStats() as Promise<Stats>,
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['audit-cycles'],
    queryFn: () => auditApi.getCycles(),
  });

  const { data: allFindings = [] } = useQuery<AuditFinding[]>({
    queryKey: ['audit-findings'],
    queryFn: () => auditApi.getFindings(),
    enabled: tab === 'findings',
  });

  const createCycle = useMutation({
    mutationFn: (data: any) => auditApi.createCycle(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-cycles'] });
      qc.invalidateQueries({ queryKey: ['audit-memory-stats'] });
      setShowNewCycle(false);
    },
  });

  const createFinding = useMutation({
    mutationFn: (data: any) => auditApi.createFinding(data),
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
                        <p className="text-xs text-gray-400 mt-0.5">{f.auditCycle?.label} · {f.auditCycle?.framework}</p>
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
                    <p className="text-xs text-gray-400 mt-0.5">{f.auditCycle?.label}</p>
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
