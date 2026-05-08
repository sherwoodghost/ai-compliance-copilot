'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '@/lib/api/team';
import {
  BookOpen, Plus, ChevronRight, X, CheckCircle2, AlertTriangle,
  AlertCircle, Clock, Loader2, FileText, Shield, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditPhase = 'planning' | 'fieldwork' | 'reporting' | 'closed';
type FindingSeverity = 'major' | 'minor' | 'observation' | 'opportunity';
type FindingStatus = 'open' | 'in_progress' | 'closed' | 'accepted_risk';

const PHASE_CONFIG: Record<AuditPhase, { label: string; cls: string; next?: string }> = {
  planning:  { label: 'Planning',  cls: 'bg-blue-100 text-blue-700',     next: 'Start Fieldwork' },
  fieldwork: { label: 'Fieldwork', cls: 'bg-amber-100 text-amber-700',   next: 'Start Reporting' },
  reporting: { label: 'Reporting', cls: 'bg-purple-100 text-purple-700', next: 'Close Audit' },
  closed:    { label: 'Closed',    cls: 'bg-emerald-100 text-emerald-700' },
};

const SEVERITY_CONFIG: Record<FindingSeverity, { label: string; dot: string; badge: string; order: number }> = {
  major:       { label: 'Major',       dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',     order: 1 },
  minor:       { label: 'Minor',       dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700', order: 2 },
  observation: { label: 'Observation', dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',   order: 3 },
  opportunity: { label: 'Opportunity', dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600',   order: 4 },
};

const FINDING_STATUS_CONFIG: Record<FindingStatus, { label: string; cls: string }> = {
  open:          { label: 'Open',          cls: 'bg-red-100 text-red-700' },
  in_progress:   { label: 'In Progress',   cls: 'bg-amber-100 text-amber-700' },
  closed:        { label: 'Closed',        cls: 'bg-emerald-100 text-emerald-700' },
  accepted_risk: { label: 'Risk Accepted', cls: 'bg-gray-100 text-gray-600' },
};

// ─── Create Audit Modal ───────────────────────────────────────────────────────

function CreateAuditModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    title:         `ISO 27001 Internal Audit ${currentYear}`,
    auditYear:     currentYear,
    scope:         '',
    auditorId:     '',
    plannedStartAt: '',
    plannedEndAt:   '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.auditorId || !form.plannedStartAt || !form.plannedEndAt) {
      setError('All fields are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const scopeList = form.scope
        ? form.scope.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      await teamApi.createInternalAudit({
        ...form,
        auditYear: Number(form.auditYear),
        scope: scopeList,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create audit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Schedule Internal Audit</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Audit Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Audit Year *</label>
              <input
                type="number"
                value={form.auditYear}
                onChange={(e) => setForm({ ...form, auditYear: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Auditor User ID *</label>
              <input
                value={form.auditorId}
                onChange={(e) => setForm({ ...form, auditorId: e.target.value })}
                placeholder="User ID"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Scope (control codes)</label>
            <input
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="e.g. A.5.1, A.8.2, CC6.1"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Comma-separated control codes</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned Start *</label>
              <input
                type="date"
                value={form.plannedStartAt}
                onChange={(e) => setForm({ ...form, plannedStartAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Planned End *</label>
              <input
                type="date"
                value={form.plannedEndAt}
                onChange={(e) => setForm({ ...form, plannedEndAt: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Schedule Audit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Finding Modal ────────────────────────────────────────────────────────

function AddFindingModal({
  auditId,
  onClose,
  onAdded,
}: {
  auditId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    title:       '',
    description: '',
    severity:    'minor' as FindingSeverity,
    controlCode: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.description) {
      setError('Title and description required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await teamApi.addAuditFinding(auditId, {
        ...form,
        controlCode: form.controlCode || undefined,
      });
      onAdded();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to add finding');
    } finally {
      setSubmitting(false);
    }
  }

  const sevCfg = SEVERITY_CONFIG[form.severity];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Add Audit Finding</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Severity *</label>
              <select
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as FindingSeverity })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {(Object.keys(SEVERITY_CONFIG) as FindingSeverity[]).map((s) => (
                  <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Control Code</label>
              <input
                value={form.controlCode}
                onChange={(e) => setForm({ ...form, controlCode: e.target.value })}
                placeholder="e.g. A.5.1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          {form.severity === 'major' && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">Major findings auto-create a corrective action assigned to the control owner.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the finding"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Detailed description of the finding, evidence reviewed, and impact..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Add Finding
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Audit Detail ─────────────────────────────────────────────────────────────

function AuditDetail({
  auditId,
  onClose,
}: {
  auditId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [showAddFinding, setShowAddFinding] = useState(false);
  const [closing, setClosing] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [closeError, setCloseError] = useState('');

  const { data: audit, isLoading } = useQuery({
    queryKey: ['internal-audit', auditId],
    queryFn:  () => teamApi.getInternalAudit(auditId),
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['internal-audit', auditId] });
    qc.invalidateQueries({ queryKey: ['internal-audits'] });
  }

  async function advance() {
    if (!audit) return;
    setAdvancing(true);
    setCloseError('');
    try {
      if (audit.status === 'planning')  await teamApi.startAuditFieldwork(auditId);
      if (audit.status === 'fieldwork') await teamApi.startAuditReporting(auditId);
      if (audit.status === 'reporting') {
        setClosing(true);
        setAdvancing(false);
        return;
      }
      refresh();
    } finally {
      setAdvancing(false);
    }
  }

  async function handleClose() {
    setClosing(false);
    setCloseError('');
    try {
      await teamApi.closeInternalAudit(auditId);
      refresh();
    } catch (err: any) {
      setCloseError(err?.response?.data?.message ?? 'Failed to close audit');
    }
  }

  async function handleCloseFinding(findingId: string) {
    await teamApi.closeAuditFinding(auditId, findingId);
    refresh();
  }

  async function handleAcceptRisk(findingId: string) {
    await teamApi.acceptRiskFinding(auditId, findingId);
    refresh();
  }

  if (isLoading || !audit) {
    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
        <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
        </div>
      </>
    );
  }

  const phaseCfg = PHASE_CONFIG[audit.status as AuditPhase] ?? PHASE_CONFIG.planning;
  const majorOpen = (audit.findings ?? []).filter((f: any) => f.severity === 'major' && f.status !== 'closed' && f.status !== 'accepted_risk').length;
  const sortedFindings = [...(audit.findings ?? [])].sort(
    (a: any, b: any) => (SEVERITY_CONFIG[a.severity as FindingSeverity]?.order ?? 9) - (SEVERITY_CONFIG[b.severity as FindingSeverity]?.order ?? 9),
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', phaseCfg.cls)}>
                  {phaseCfg.label}
                </span>
                <span className="text-[10px] text-gray-400">{audit.auditYear}</span>
              </div>
              <h2 className="text-sm font-semibold text-gray-900">{audit.title}</h2>
              <p className="text-[10px] text-gray-400 mt-0.5">
                Scope: {(audit.scope ?? []).slice(0, 5).join(', ')}{(audit.scope?.length ?? 0) > 5 ? ` +${audit.scope.length - 5} more` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Close error */}
        {closeError && (
          <div className="mx-6 mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{closeError}</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Planned Period</p>
              <p className="text-xs text-gray-700">
                {new Date(audit.plannedStartAt).toLocaleDateString()} – {new Date(audit.plannedEndAt).toLocaleDateString()}
              </p>
            </div>
            {audit.evidenceId && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Evidence</p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Generated
                </p>
              </div>
            )}
          </div>

          {/* Fieldwork checklist (planning/fieldwork phase) */}
          {(audit.status === 'planning' || audit.status === 'fieldwork') && audit.checklist?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Fieldwork Checklist</h3>
              <div className="space-y-1">
                {audit.checklist.slice(0, 12).map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <div className="w-3.5 h-3.5 rounded border border-gray-300 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600">
                      {item.controlCode && (
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 py-0.5 rounded mr-1">{item.controlCode}</span>
                      )}
                      {item.item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700">
                Findings
                {sortedFindings.length > 0 && (
                  <span className="ml-2 text-[10px] text-gray-400">{sortedFindings.length} total</span>
                )}
              </h3>
              {audit.status !== 'closed' && (
                <button
                  onClick={() => setShowAddFinding(true)}
                  className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Finding
                </button>
              )}
            </div>

            {majorOpen > 0 && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <p className="text-[10px] text-red-700 font-medium">{majorOpen} major finding{majorOpen > 1 ? 's' : ''} must be resolved before closing</p>
              </div>
            )}

            {sortedFindings.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No findings recorded yet</p>
            ) : (
              <div className="space-y-2">
                {sortedFindings.map((finding: any) => {
                  const sevCfg  = SEVERITY_CONFIG[finding.severity as FindingSeverity] ?? SEVERITY_CONFIG.observation;
                  const statCfg = FINDING_STATUS_CONFIG[finding.status as FindingStatus] ?? FINDING_STATUS_CONFIG.open;
                  return (
                    <div key={finding.id} className="border border-gray-100 rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', sevCfg.badge)}>
                              {sevCfg.label}
                            </span>
                            {finding.controlCode && (
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{finding.controlCode}</span>
                            )}
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded', statCfg.cls)}>{statCfg.label}</span>
                          </div>
                          <p className="text-xs font-medium text-gray-900">{finding.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{finding.description}</p>
                          {finding.correctiveActions?.length > 0 && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {finding.correctiveActions.filter((a: any) => a.status !== 'closed').length} open corrective action(s)
                            </p>
                          )}
                        </div>
                        {finding.status === 'open' || finding.status === 'in_progress' ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleCloseFinding(finding.id)}
                              className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                              Close
                            </button>
                            {finding.severity === 'major' && (
                              <button
                                onClick={() => handleAcceptRisk(finding.id)}
                                className="text-[10px] text-gray-500 hover:text-gray-700 font-medium ml-1"
                              >
                                Accept Risk
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {audit.status !== 'closed' && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-2">
            {closing ? (
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">This will generate evidence for ISO Clause 9.2 and mark the audit complete.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setClosing(false)} className="flex-1 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={handleClose}
                    className="flex-1 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                  >
                    Confirm Close & Generate Evidence
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={advance}
                disabled={advancing}
                className="w-full py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {advancing && <Loader2 className="w-3 h-3 animate-spin" />}
                {phaseCfg.next}
              </button>
            )}
          </div>
        )}
      </div>

      {showAddFinding && (
        <AddFindingModal
          auditId={auditId}
          onClose={() => setShowAddFinding(false)}
          onAdded={() => { setShowAddFinding(false); refresh(); }}
        />
      )}
    </>
  );
}

// ─── Audit Row ────────────────────────────────────────────────────────────────

function AuditRow({ audit, onClick }: { audit: any; onClick: () => void }) {
  const phaseCfg = PHASE_CONFIG[audit.status as AuditPhase] ?? PHASE_CONFIG.planning;
  const findings = audit.findings ?? [];
  const majorOpen = findings.filter((f: any) => f.severity === 'major' && f.status !== 'closed' && f.status !== 'accepted_risk').length;
  const totalOpen = findings.filter((f: any) => f.status !== 'closed' && f.status !== 'accepted_risk').length;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{audit.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {audit.auditYear} · {(audit.scope ?? []).length} controls in scope
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {majorOpen > 0 && (
          <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
            {majorOpen} major
          </span>
        )}
        {totalOpen > 0 && majorOpen === 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
            {totalOpen} open
          </span>
        )}
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', phaseCfg.cls)}>
          {phaseCfg.label}
        </span>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InternalAuditPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: audits, isLoading } = useQuery({
    queryKey: ['internal-audits'],
    queryFn:  () => teamApi.listInternalAudits(),
  });

  const auditList = audits ?? [];
  const openAudits = auditList.filter((a: any) => a.status !== 'closed').length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-brand-600" />
            Internal Audit
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">ISO Clause 9.2 · Annual internal audit program</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Schedule Audit
        </button>
      </div>

      {/* ISO 9.2 info banner */}
      <div className="flex items-start gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-brand-800">ISO Clause 9.2 — Internal Audit</p>
          <p className="text-[11px] text-brand-700 mt-0.5">
            Conduct at planned intervals. Closing an audit auto-generates evidence mapped to ISO 9.2 controls.
            Major findings must be resolved before closure.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Audits</p>
          <p className="text-2xl font-bold text-gray-900">{auditList.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-brand-600">{openAudits}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{auditList.filter((a: any) => a.status === 'closed').length}</p>
        </div>
      </div>

      {/* Audit list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          </div>
        ) : auditList.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 px-4 text-center">
            <BookOpen className="w-10 h-10 text-gray-300" />
            <p className="text-sm font-medium text-gray-700">No internal audits yet</p>
            <p className="text-xs text-gray-400">Schedule your first annual internal audit to satisfy ISO Clause 9.2</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-2 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700"
            >
              Schedule Audit
            </button>
          </div>
        ) : (
          auditList.map((audit: any) => (
            <AuditRow key={audit.id} audit={audit} onClick={() => setSelectedId(audit.id)} />
          ))
        )}
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateAuditModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ['internal-audits'] });
          }}
        />
      )}

      {selectedId && (
        <AuditDetail
          auditId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
