'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi } from '@/lib/api/team';
import {
  AlertTriangle, Plus, ChevronRight, Clock, X, CheckCircle2,
  Shield, Zap, Activity, BarChart3, FileText, Loader2, Info,
  AlertCircle, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'] as const;
type Severity = typeof SEVERITIES[number];

const SEVERITY_CONFIG: Record<Severity, { label: string; dot: string; badge: string; ring: string }> = {
  CRITICAL:      { label: 'Critical',      dot: 'bg-red-600',    badge: 'bg-red-100 text-red-700 border-red-200',        ring: 'border-l-red-600' },
  HIGH:          { label: 'High',          dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border-orange-200', ring: 'border-l-orange-500' },
  MEDIUM:        { label: 'Medium',        dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border-amber-200',   ring: 'border-l-amber-500' },
  LOW:           { label: 'Low',           dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700 border-blue-200',      ring: 'border-l-blue-400' },
  INFORMATIONAL: { label: 'Informational', dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600 border-gray-200',      ring: 'border-l-gray-400' },
};

const STATUSES = ['detected', 'triaging', 'contained', 'eradicating', 'recovering', 'closed'] as const;
type IncidentStatus = typeof STATUSES[number];

const STATUS_CONFIG: Record<IncidentStatus, { label: string; cls: string }> = {
  detected:    { label: 'Detected',    cls: 'bg-red-100 text-red-700' },
  triaging:    { label: 'Triaging',    cls: 'bg-orange-100 text-orange-700' },
  contained:   { label: 'Contained',   cls: 'bg-amber-100 text-amber-700' },
  eradicating: { label: 'Eradicating', cls: 'bg-purple-100 text-purple-700' },
  recovering:  { label: 'Recovering',  cls: 'bg-blue-100 text-blue-700' },
  closed:      { label: 'Closed',      cls: 'bg-emerald-100 text-emerald-700' },
};

const CATEGORIES = [
  { value: 'data_breach',          label: 'Data Breach' },
  { value: 'ransomware',           label: 'Ransomware' },
  { value: 'phishing',             label: 'Phishing' },
  { value: 'unauthorized_access',  label: 'Unauthorized Access' },
  { value: 'availability',         label: 'Availability' },
  { value: 'other',                label: 'Other' },
];

const NEXT_STATUSES: Partial<Record<IncidentStatus, IncidentStatus>> = {
  detected:    'triaging',
  triaging:    'contained',
  contained:   'eradicating',
  eradicating: 'recovering',
};

function formatMinutes(mins: number | null) {
  if (mins === null || mins === undefined) return '—';
  if (mins < 60)  return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Create Incident Modal ────────────────────────────────────────────────────

function CreateIncidentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title:           '',
    description:     '',
    severity:        'MEDIUM' as Severity,
    category:        'other',
    affectedSystems: '',
    impactedUsers:   '',
    dataClassification: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError('Title and description are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await teamApi.createIncident({
        title:           form.title,
        description:     form.description,
        severity:        form.severity,
        category:        form.category,
        affectedSystems: form.affectedSystems ? form.affectedSystems.split(',').map((s) => s.trim()) : [],
        impactedUsers:   form.impactedUsers ? parseInt(form.impactedUsers, 10) : undefined,
        dataClassification: form.dataClassification || undefined,
      });
      onCreated();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create incident');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Report Security Incident</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          <div>
            <label htmlFor="inc-title" className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
            <input
              id="inc-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Unauthorized access to production database"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inc-severity" className="block text-xs font-medium text-gray-700 mb-1">Severity *</label>
              <select
                id="inc-severity"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inc-category" className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
              <select
                id="inc-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="inc-description" className="block text-xs font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              id="inc-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Describe what happened, when it was detected, and initial impact assessment..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Affected Systems</label>
              <input
                value={form.affectedSystems}
                onChange={(e) => setForm({ ...form, affectedSystems: e.target.value })}
                placeholder="e.g. AWS RDS, GitHub"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">Comma-separated</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Impacted Users</label>
              <input
                type="number"
                value={form.impactedUsers}
                onChange={(e) => setForm({ ...form, impactedUsers: e.target.value })}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Data Classification</label>
            <select
              value={form.dataClassification}
              onChange={(e) => setForm({ ...form, dataClassification: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Unknown / Not applicable</option>
              <option value="PII">PII — Personally Identifiable Information</option>
              <option value="PHI">PHI — Protected Health Information</option>
              <option value="PCI">PCI — Payment Card Data</option>
              <option value="internal">Internal / Confidential</option>
              <option value="public">Public</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Report Incident
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Close Incident Modal ─────────────────────────────────────────────────────

function CloseIncidentModal({
  incident,
  onClose,
  onClosed,
}: {
  incident: any;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [form, setForm] = useState({ rootCause: '', lessonsLearned: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.rootCause.trim() || !form.lessonsLearned.trim()) {
      setError('Both root cause and lessons learned are required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await teamApi.closeIncident(incident.id, form);
      onClosed();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to close incident');
    } finally {
      setSubmitting(false);
    }
  }

  const openActions = (incident.correctiveActions ?? []).filter((a: any) => a.status !== 'closed');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Close Incident</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          {openActions.length > 0 && incident.severity === 'CRITICAL' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                This CRITICAL incident has <strong>{openActions.length}</strong> open corrective action(s). All must be closed first.
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <p className="text-xs text-blue-700 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0" />
              Closing will auto-generate evidence mapped to ISO A.5.24–A.5.27
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Root Cause *</label>
            <textarea
              value={form.rootCause}
              onChange={(e) => setForm({ ...form, rootCause: e.target.value })}
              rows={3}
              placeholder="What was the underlying cause of this incident?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lessons Learned *</label>
            <textarea
              value={form.lessonsLearned}
              onChange={(e) => setForm({ ...form, lessonsLearned: e.target.value })}
              rows={3}
              placeholder="What improvements will be made to prevent recurrence?"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-600 hover:text-gray-900 font-medium">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (incident.severity === 'CRITICAL' && openActions.length > 0)}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Close & Generate Evidence
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Incident Detail Panel ────────────────────────────────────────────────────

function IncidentDetail({
  incident,
  onClose,
  onRefresh,
}: {
  incident: any;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const qc = useQueryClient();
  const sevCfg  = SEVERITY_CONFIG[incident.severity as Severity] ?? SEVERITY_CONFIG.LOW;
  const statCfg = STATUS_CONFIG[incident.status as IncidentStatus] ?? STATUS_CONFIG.detected;
  const nextStatus = NEXT_STATUSES[incident.status as IncidentStatus];
  const [showClose, setShowClose] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const [caForm, setCaForm] = useState({ title: '', description: '', assignedTo: '', dueDate: '' });
  const [caSubmitting, setCaSubmitting] = useState(false);
  const [caError, setCaError] = useState('');
  const [showCaForm, setShowCaForm] = useState(false);

  async function advance() {
    if (!nextStatus) return;
    setAdvancing(true);
    try {
      await teamApi.updateIncidentStatus(incident.id, nextStatus);
      onRefresh();
    } finally {
      setAdvancing(false);
    }
  }

  async function handleAddCa(e: React.FormEvent) {
    e.preventDefault();
    if (!caForm.title || !caForm.assignedTo || !caForm.dueDate) {
      setCaError('Title, assignee, and due date are required');
      return;
    }
    setCaSubmitting(true);
    setCaError('');
    try {
      await teamApi.addCorrectiveAction(incident.id, caForm);
      setCaForm({ title: '', description: '', assignedTo: '', dueDate: '' });
      setShowCaForm(false);
      onRefresh();
    } catch (err: any) {
      setCaError(err?.response?.data?.message ?? 'Failed to add corrective action');
    } finally {
      setCaSubmitting(false);
    }
  }

  async function closeCa(actionId: string) {
    await teamApi.closeCorrectiveAction(incident.id, actionId);
    onRefresh();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className={cn('border-l-4 px-6 py-4 border-b border-gray-100', sevCfg.ring)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', sevCfg.badge)}>
                  {sevCfg.label}
                </span>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', statCfg.cls)}>
                  {statCfg.label}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-gray-900 leading-snug">{incident.title}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Detected {timeAgo(incident.detectedAt)}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Description</h3>
            <p className="text-xs text-gray-600 leading-relaxed">{incident.description}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            {incident.affectedSystems?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Affected Systems</p>
                <div className="flex flex-wrap gap-1">
                  {incident.affectedSystems.map((s: string) => (
                    <span key={s} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {incident.impactedUsers !== null && incident.impactedUsers !== undefined && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Impacted Users</p>
                <p className="text-xs text-gray-800 font-medium">{incident.impactedUsers}</p>
              </div>
            )}
            {incident.dataClassification && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Data Classification</p>
                <p className="text-xs text-gray-800">{incident.dataClassification}</p>
              </div>
            )}
            {incident.category && (
              <div>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Category</p>
                <p className="text-xs text-gray-800 capitalize">{incident.category.replace('_', ' ')}</p>
              </div>
            )}
          </div>

          {/* Root cause / lessons learned (if closed) */}
          {incident.rootCause && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Root Cause</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{incident.rootCause}</p>
            </div>
          )}
          {incident.lessonsLearned && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-1.5">Lessons Learned</h3>
              <p className="text-xs text-gray-600 leading-relaxed">{incident.lessonsLearned}</p>
            </div>
          )}

          {/* Timeline */}
          {incident.timeline?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">Timeline</h3>
              <div className="space-y-2">
                {[...incident.timeline].reverse().map((entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700">{entry.note}</p>
                      <p className="text-[10px] text-gray-400">{timeAgo(entry.at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrective Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-700">Corrective Actions</h3>
              {incident.status !== 'closed' && (
                <button
                  onClick={() => setShowCaForm((v) => !v)}
                  className="text-[10px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              )}
            </div>

            {showCaForm && (
              <form onSubmit={handleAddCa} className="mb-3 border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                {caError && <p className="text-[10px] text-red-600">{caError}</p>}
                <input
                  value={caForm.title}
                  onChange={(e) => setCaForm({ ...caForm, title: e.target.value })}
                  placeholder="Action title"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  value={caForm.description}
                  onChange={(e) => setCaForm({ ...caForm, description: e.target.value })}
                  placeholder="Description (optional)"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  value={caForm.assignedTo}
                  onChange={(e) => setCaForm({ ...caForm, assignedTo: e.target.value })}
                  placeholder="Assignee user ID"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="date"
                  value={caForm.dueDate}
                  onChange={(e) => setCaForm({ ...caForm, dueDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowCaForm(false)} className="text-[10px] text-gray-500 hover:text-gray-700">Cancel</button>
                  <button type="submit" disabled={caSubmitting} className="text-[10px] bg-brand-600 text-white px-3 py-1 rounded font-medium">
                    {caSubmitting ? 'Adding…' : 'Add'}
                  </button>
                </div>
              </form>
            )}

            {incident.correctiveActions?.length > 0 ? (
              <div className="space-y-1.5">
                {incident.correctiveActions.map((ca: any) => (
                  <div key={ca.id} className="flex items-center gap-2.5 p-2.5 border border-gray-100 rounded-lg bg-white">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', ca.status === 'closed' ? 'bg-emerald-400' : 'bg-amber-400')} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-medium', ca.status === 'closed' ? 'text-gray-400 line-through' : 'text-gray-800')}>{ca.title}</p>
                      <p className="text-[10px] text-gray-400">Due {new Date(ca.dueDate).toLocaleDateString()}</p>
                    </div>
                    {ca.status !== 'closed' && incident.status !== 'closed' && (
                      <button
                        onClick={() => closeCa(ca.id)}
                        className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium shrink-0"
                      >
                        Close
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No corrective actions yet</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        {incident.status !== 'closed' && (
          <div className="border-t border-gray-100 px-6 py-4 flex items-center gap-2">
            {nextStatus && (
              <button
                onClick={advance}
                disabled={advancing}
                className="flex-1 py-2 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {advancing && <Loader2 className="w-3 h-3 animate-spin" />}
                Advance to {STATUS_CONFIG[nextStatus].label}
              </button>
            )}
            {incident.status === 'recovering' && (
              <button
                onClick={() => setShowClose(true)}
                className="flex-1 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Close Incident
              </button>
            )}
          </div>
        )}
      </div>

      {showClose && (
        <CloseIncidentModal
          incident={incident}
          onClose={() => setShowClose(false)}
          onClosed={() => { setShowClose(false); onRefresh(); onClose(); }}
        />
      )}
    </>
  );
}

// ─── Metrics Panel ────────────────────────────────────────────────────────────

function MetricsPanel({ metrics }: { metrics: any }) {
  // Always render a stable grid so server/client HTML matches (prevents hydration mismatch).
  // Show skeleton placeholders while data is loading.
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-[74px] animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 mb-1">Total Incidents</p>
        <p className="text-2xl font-bold text-gray-900">{metrics.total ?? 0}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 mb-1">Open</p>
        <p className="text-2xl font-bold text-red-600">{metrics.open ?? 0}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 mb-1">MTTD</p>
        <p className="text-2xl font-bold text-gray-900">{formatMinutes(metrics.mttdMinutes)}</p>
        <p className="text-[10px] text-gray-400">mean time to detect</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <p className="text-xs text-gray-500 mb-1">MTTR</p>
        <p className="text-2xl font-bold text-gray-900">{formatMinutes(metrics.mttrMinutes)}</p>
        <p className="text-[10px] text-gray-400">mean time to resolve</p>
      </div>
    </div>
  );
}

// ─── Incident Row ─────────────────────────────────────────────────────────────

function IncidentRow({ incident, onClick }: { incident: any; onClick: () => void }) {
  const sev  = SEVERITY_CONFIG[incident.severity as Severity] ?? SEVERITY_CONFIG.LOW;
  const stat = STATUS_CONFIG[incident.status as IncidentStatus] ?? STATUS_CONFIG.detected;
  const openCa = (incident.correctiveActions ?? []).filter((a: any) => a.status !== 'closed').length;

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors border-l-2',
        sev.ring.replace('border-l-', 'border-l-'),
      )}
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', sev.dot)} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-900 truncate">{incident.title}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {CATEGORIES.find((c) => c.value === incident.category)?.label ?? incident.category} · {timeAgo(incident.detectedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {openCa > 0 && (
          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
            {openCa} CA
          </span>
        )}
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', stat.cls)}>
          {stat.label}
        </span>
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selected,   setSelected]   = useState<any>(null);
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['incidents', filterStatus, filterSeverity],
    queryFn:  () => teamApi.listIncidents({
      status:   filterStatus   || undefined,
      severity: filterSeverity || undefined,
    }),
  });

  const { data: metrics } = useQuery({
    queryKey: ['incident-metrics'],
    queryFn:  () => teamApi.getIncidentMetrics(),
    staleTime: 60_000,
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ['incidents'] });
    qc.invalidateQueries({ queryKey: ['incident-metrics'] });
    setSelected(null);
  }

  const incidents: any[] = data?.incidents ?? [];
  const critical = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'closed').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Incident Management
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">ISO A.5.24–A.5.27 · Security incident lifecycle</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
        >
          <Plus className="w-3.5 h-3.5" />
          Report Incident
        </button>
      </div>

      {/* Critical alert banner */}
      {critical > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 font-medium">
            {critical} CRITICAL incident{critical > 1 ? 's' : ''} require immediate attention
          </p>
        </div>
      )}

      {/* Metrics — always rendered (skeleton when loading) to prevent SSR/hydration mismatch */}
      <MetricsPanel metrics={metrics ?? null} />

      {/* Status pipeline */}
      <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
        <p className="text-xs font-semibold text-gray-700 mb-3">Incident Pipeline</p>
        <div className="flex items-center gap-1 overflow-x-auto">
          {STATUSES.filter((s) => s !== 'closed').map((status, i, arr) => {
            const count = incidents.filter((inc) => inc.status === status).length;
            const cfg   = STATUS_CONFIG[status];
            return (
              <div key={status} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setFilterStatus(filterStatus === status ? '' : status)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                    filterStatus === status ? cfg.cls + ' ring-2 ring-offset-1 ring-brand-400' : cfg.cls + ' opacity-70 hover:opacity-100',
                  )}
                >
                  {cfg.label}
                  {count > 0 && <span className="ml-0.5 font-bold">{count}</span>}
                </button>
                {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
              </div>
            );
          })}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            <ChevronRight className="w-3 h-3 text-gray-300" />
            <button
              onClick={() => setFilterStatus(filterStatus === 'closed' ? '' : 'closed')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filterStatus === 'closed'
                  ? STATUS_CONFIG.closed.cls + ' ring-2 ring-offset-1 ring-brand-400'
                  : STATUS_CONFIG.closed.cls + ' opacity-70 hover:opacity-100',
              )}
            >
              Closed
              <span className="ml-0.5 font-bold">
                {incidents.filter((i) => i.status === 'closed').length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-600"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{SEVERITY_CONFIG[s].label}</option>
          ))}
        </select>
        {(filterStatus || filterSeverity) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterSeverity(''); }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{incidents.length} incident{incidents.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Incidents list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 px-4 text-center">
            <Shield className="w-10 h-10 text-emerald-400" />
            <p className="text-sm font-medium text-gray-700">No incidents</p>
            <p className="text-xs text-gray-400">
              {filterStatus || filterSeverity
                ? 'No incidents match the current filters'
                : 'No security incidents have been reported'}
            </p>
          </div>
        ) : (
          incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              onClick={() => setSelected(incident)}
            />
          ))
        )}
      </div>

      {/* By-severity breakdown */}
      {metrics?.bySeverity && metrics.bySeverity.some((s: any) => s.total > 0) && (
        <div className="bg-white rounded-xl border border-gray-100 px-5 py-4">
          <p className="text-xs font-semibold text-gray-700 mb-3">By Severity</p>
          <div className="space-y-2">
            {metrics.bySeverity.filter((s: any) => s.total > 0).map((s: any) => {
              const cfg = SEVERITY_CONFIG[s.severity as Severity];
              const pct = metrics.total > 0 ? Math.round((s.total / metrics.total) * 100) : 0;
              return (
                <div key={s.severity} className="flex items-center gap-3">
                  <div className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                  <span className="text-xs text-gray-600 w-24 shrink-0">{cfg.label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', cfg.dot)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16 text-right shrink-0">
                    {s.open > 0 ? `${s.open} open` : ''} / {s.total} total
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateIncidentModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); refresh(); }}
        />
      )}

      {selected && (
        <IncidentDetail
          incident={selected}
          onClose={() => setSelected(null)}
          onRefresh={() => {
            qc.invalidateQueries({ queryKey: ['incidents'] });
            qc.invalidateQueries({ queryKey: ['incident-metrics'] });
            // Re-fetch detail
            teamApi.getIncident(selected.id).then(setSelected).catch(() => setSelected(null));
          }}
        />
      )}
    </div>
  );
}
