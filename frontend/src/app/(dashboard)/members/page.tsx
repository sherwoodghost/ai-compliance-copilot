'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamApi, TeamMember, InviteMemberDto, PlatformRole, ComplianceRole, RaciLetter } from '@/lib/api/team';
import {
  Users, UserPlus, Shield, AlertTriangle, CheckCircle2, Clock,
  MoreVertical, ChevronRight, X, Loader2, RefreshCw,
  AlertCircle, BookOpen, Grid3X3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<PlatformRole, { label: string; cls: string; desc: string }> = {
  owner:             { label: 'Owner',          cls: 'bg-amber-100 text-amber-800 border border-amber-200',  desc: 'Full access. Owns the compliance program.' },
  admin:             { label: 'Admin',          cls: 'bg-purple-100 text-purple-800 border border-purple-200', desc: 'All actions except changing owner.' },
  contributor:       { label: 'Contributor',    cls: 'bg-blue-100 text-blue-800 border border-blue-200',    desc: 'Upload evidence, create policies (cannot approve).' },
  approver:          { label: 'Approver',       cls: 'bg-indigo-100 text-indigo-800 border border-indigo-200', desc: 'Approve policies and tasks (SoD-enforced).' },
  viewer:            { label: 'Viewer',         cls: 'bg-gray-100 text-gray-700',                           desc: 'Read-only access to all compliance data.' },
  auditor_external:  { label: 'Ext. Auditor',   cls: 'bg-teal-100 text-teal-800 border border-teal-200',    desc: 'Download-only. Cannot modify any records.' },
};

const COMPLIANCE_ROLES: { value: ComplianceRole; label: string; hint: string }[] = [
  { value: 'SECURITY_LEAD',      label: 'Security Lead / CISO',    hint: 'Accountable for CC6.*, A.5.*, A.8.*' },
  { value: 'COMPLIANCE_LEAD',    label: 'Compliance Lead',          hint: 'Program management & management reviews' },
  { value: 'DPO',                label: 'Data Protection Officer',  hint: 'GDPR / A.5.34 controls' },
  { value: 'IT_ADMIN',           label: 'IT Administrator',         hint: 'Access provisioning, A.8.2, A.9.*' },
  { value: 'ENGINEERING_LEAD',   label: 'Engineering Lead',         hint: 'CC7.*, CC8.*, SDLC controls' },
  { value: 'HR_LEAD',            label: 'HR Lead',                  hint: 'Screening, onboarding, A.6.*' },
  { value: 'LEGAL',              label: 'Legal / General Counsel',  hint: 'Contracts, NDA, regulatory obligations' },
  { value: 'RISK_OWNER',         label: 'Risk Owner',               hint: 'Risk register, A.5.7, A.6.4' },
  { value: 'CONTROL_OWNER',      label: 'Control Owner',            hint: 'Responsible for assigned controls' },
  { value: 'EVIDENCE_REVIEWER',  label: 'Evidence Reviewer',        hint: 'Review and approve uploaded evidence' },
  { value: 'INCIDENT_RESPONDER', label: 'Incident Responder',       hint: 'Security incidents, A.5.26, A.5.27' },
  { value: 'VENDOR_MANAGER',     label: 'Vendor Manager',           hint: 'Supplier review, A.5.19–A.5.22' },
];

const RACI_COLORS: Record<RaciLetter, string> = {
  R: 'bg-blue-100 text-blue-800 border-blue-200',
  A: 'bg-amber-100 text-amber-800 border-amber-200',
  C: 'bg-purple-100 text-purple-700 border-purple-200',
  I: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_CONFIG = {
  active:       { label: 'Active',       cls: 'bg-emerald-100 text-emerald-700' },
  suspended:    { label: 'Suspended',    cls: 'bg-yellow-100 text-yellow-700' },
  offboarding:  { label: 'Offboarding',  cls: 'bg-orange-100 text-orange-700' },
  deactivated:  { label: 'Deactivated',  cls: 'bg-red-100 text-red-700' },
};

// ─── Invite Modal ─────────────────────────────────────────────────────────────

const INVITE_STEPS = ['Identity', 'Platform Role', 'Responsibilities', 'Pre-access', 'Review & Send'];

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<InviteMemberDto>({
    email: '',
    fullName: '',
    jobTitle: '',
    department: '',
    platformRole: 'contributor',
    employmentType: 'full_time',
    responsibilities: [],
    requireNda: true,
    requireAup: true,
    requireTraining: true,
    requireBackgroundCheck: false,
  });

  const qc = useQueryClient();
  const invite = useMutation({
    mutationFn: () => teamApi.inviteMember(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] });
      onSuccess();
    },
  });

  const update = (patch: Partial<InviteMemberDto>) => setForm((f) => ({ ...f, ...patch }));

  const toggleResponsibility = (role: ComplianceRole) => {
    const current = form.responsibilities ?? [];
    update({
      responsibilities: current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role],
    });
  };

  const canNext = () => {
    if (step === 0) return form.email && form.fullName;
    if (step === 1) return !!form.platformRole;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Invite Team Member</h2>
            <p className="text-xs text-gray-500 mt-0.5">Step {step + 1} of {INVITE_STEPS.length} — {INVITE_STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex px-6 pt-3 gap-1">
          {INVITE_STEPS.map((s, i) => (
            <div
              key={s}
              className={cn('h-1 flex-1 rounded-full transition-colors', i <= step ? 'bg-brand-600' : 'bg-gray-200')}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[280px]">
          {/* Step 0: Identity */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    className="input"
                    value={form.fullName}
                    onChange={(e) => update({ fullName: e.target.value })}
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                    placeholder="jane@company.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Job Title</label>
                  <input className="input" value={form.jobTitle ?? ''} onChange={(e) => update({ jobTitle: e.target.value })} placeholder="Security Engineer" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <input className="input" value={form.department ?? ''} onChange={(e) => update({ department: e.target.value })} placeholder="Engineering" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Employment Type</label>
                  <select className="input" value={form.employmentType} onChange={(e) => update({ employmentType: e.target.value as any })}>
                    <option value="full_time">Full-time</option>
                    <option value="part_time">Part-time</option>
                    <option value="contractor">Contractor</option>
                    <option value="vendor">Vendor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                  <input className="input" type="date" value={form.startDate ?? ''} onChange={(e) => update({ startDate: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Platform Role */}
          {step === 1 && (
            <div className="space-y-2">
              {(Object.entries(ROLE_CONFIG) as [PlatformRole, (typeof ROLE_CONFIG)[PlatformRole]][]).map(([role, cfg]) => (
                <label
                  key={role}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                    form.platformRole === role ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <input
                    type="radio"
                    name="platformRole"
                    checked={form.platformRole === role}
                    onChange={() => update({ platformRole: role })}
                    className="mt-0.5 accent-brand-600"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', cfg.cls)}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Step 2: Responsibilities */}
          {step === 2 && (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">Select all compliance roles this person holds. Used for RACI auto-assignment.</p>
              <div className="grid grid-cols-1 gap-1.5">
                {COMPLIANCE_ROLES.map(({ value, label, hint }) => {
                  const checked = (form.responsibilities ?? []).includes(value);
                  return (
                    <label
                      key={value}
                      className={cn(
                        'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                        checked ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleResponsibility(value)}
                        className="accent-brand-600"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-medium text-gray-800">{label}</span>
                        <span className="text-xs text-gray-400 ml-2">{hint}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Pre-access */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-3">Required before the user can access the platform (ISO A.6.1 / A.6.2).</p>
              {[
                { key: 'requireNda',             label: 'NDA / Confidentiality Agreement', hint: 'ISO A.6.6 — required for all' },
                { key: 'requireAup',             label: 'Acceptable Use Policy sign-off',   hint: 'ISO A.5.10 / CC6.6' },
                { key: 'requireTraining',        label: 'Security Awareness Training',      hint: 'ISO A.6.3 — auto-enrolls in module' },
                { key: 'requireBackgroundCheck', label: 'Background Check verification',    hint: 'ISO A.6.1 — required for privileged roles' },
              ].map(({ key, label, hint }) => (
                <label key={key} className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-brand-300 transition-colors">
                  <input
                    type="checkbox"
                    checked={!!(form as any)[key]}
                    onChange={(e) => update({ [key]: e.target.checked } as any)}
                    className="mt-0.5 accent-brand-600"
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{hint}</p>
                  </div>
                </label>
              ))}
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                User account will be created with <strong>Suspended</strong> status and activated only when all selected requirements are met.
              </p>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium text-gray-900">{form.fullName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-900">{form.email}</span>
                </div>
                {form.jobTitle && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Title</span>
                    <span className="font-medium text-gray-900">{form.jobTitle}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Platform Role</span>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', ROLE_CONFIG[form.platformRole].cls)}>
                    {ROLE_CONFIG[form.platformRole].label}
                  </span>
                </div>
                {(form.responsibilities ?? []).length > 0 && (
                  <div className="flex justify-between text-xs items-start">
                    <span className="text-gray-500 shrink-0">Responsibilities</span>
                    <span className="text-right font-medium text-gray-900">{(form.responsibilities ?? []).map(r => COMPLIANCE_ROLES.find(cr => cr.value === r)?.label ?? r).join(', ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Pre-access</span>
                  <span className="font-medium text-gray-900">
                    {[
                      form.requireNda && 'NDA',
                      form.requireAup && 'AUP',
                      form.requireTraining && 'Training',
                      form.requireBackgroundCheck && 'Background check',
                    ].filter(Boolean).join(' · ') || 'None'}
                  </span>
                </div>
              </div>
              {invite.error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-200">
                  {(invite.error as any)?.response?.data?.message ?? 'Invite failed. Please try again.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <button
            className="btn-secondary text-sm"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < INVITE_STEPS.length - 1 ? (
            <button className="btn-primary text-sm" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ChevronRight className="w-3.5 h-3.5 inline" />
            </button>
          ) : (
            <button
              className="btn-primary text-sm min-w-[120px]"
              onClick={() => invite.mutate()}
              disabled={invite.isPending}
            >
              {invite.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Send Invite →'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────────

function MembersTab({ members }: { members: TeamMember[] }) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            {['Member', 'Title', 'Role', 'Responsibilities', 'RACI', 'Status', ''].map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-gray-500 py-2.5 px-3 first:pl-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {members.map((m) => {
            const roleCfg = ROLE_CONFIG[m.platformRole] ?? ROLE_CONFIG.viewer;
            const statusCfg = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.active;
            const hasSodConflict = (m.stats?.sodConflicts ?? 0) > 0;
            return (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                <td className="py-3 pl-0 pr-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand-700">{m.fullName[0]}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{m.fullName}</p>
                      <p className="text-gray-400">{m.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3 text-gray-600">{m.jobTitle ?? '—'}</td>
                <td className="py-3 px-3">
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', roleCfg.cls)}>
                    {roleCfg.label}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="flex flex-wrap gap-1">
                    {m.responsibilities.slice(0, 2).map((r) => (
                      <span key={r.role} className="text-xs bg-gray-100 text-gray-600 rounded px-1.5 py-0.5 border border-gray-200">
                        {r.role.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {m.responsibilities.length > 2 && (
                      <span className="text-xs text-gray-400">+{m.responsibilities.length - 2}</span>
                    )}
                    {m.responsibilities.length === 0 && <span className="text-gray-400">—</span>}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5">
                    {m.stats?.raciAccountable ? (
                      <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 rounded px-1.5 py-0.5">A:{m.stats.raciAccountable}</span>
                    ) : null}
                    {hasSodConflict && (
                      <button title="SoD conflict — same person is R and A on a control" className="text-red-500 hover:text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', statusCfg.cls)}>
                    {statusCfg.label}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <div className="relative">
                    <button
                      className="p-1 rounded hover:bg-gray-100 transition-colors"
                      onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                    >
                      <MoreVertical className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {menuOpen === m.id && (
                      <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
                        <button className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">Edit role</button>
                        <button className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">Assign RACI</button>
                        <button className="block w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">Offboard</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {members.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No team members yet. Invite your first member.</p>
        </div>
      )}
    </div>
  );
}

// ─── RACI Matrix Tab ──────────────────────────────────────────────────────────

function RaciMatrixTab({ members }: { members: TeamMember[] }) {
  const qc = useQueryClient();
  const { data: matrix = [], isLoading } = useQuery({
    queryKey: ['team-raci'],
    queryFn: teamApi.getRaci,
  });
  const { data: conflicts = [] } = useQuery({
    queryKey: ['team-sod-conflicts'],
    queryFn: teamApi.getSodConflicts,
  });

  const autoFill = useMutation({
    mutationFn: teamApi.autoFillRaci,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-raci'] }),
  });

  const conflictSet = new Set(conflicts.map((c) => `${c.controlId}:${c.userId}`));

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
    </div>
  );

  const activeMembers = members.filter((m) => m.status === 'active').slice(0, 10);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-gray-500">
            {conflicts.length > 0
              ? <span className="text-red-600 font-medium">⚠ {conflicts.length} SoD conflict{conflicts.length > 1 ? 's' : ''} detected</span>
              : <span className="text-emerald-600 font-medium">✓ No SoD conflicts</span>}
          </p>
        </div>
        <button
          className="btn-secondary text-xs flex items-center gap-1.5"
          onClick={() => autoFill.mutate()}
          disabled={autoFill.isPending}
        >
          {autoFill.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Auto-fill from responsibilities
        </button>
      </div>

      {matrix.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Grid3X3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No RACI assignments yet.</p>
          <p className="text-xs mt-1">Use "Auto-fill from responsibilities" to get started, or assign manually.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-r border-gray-200 min-w-[180px]">Control</th>
                {activeMembers.map((m) => (
                  <th key={m.id} className="text-center px-2 py-2 font-medium text-gray-600 border-b border-r border-gray-200 min-w-[80px] max-w-[100px]">
                    <div className="truncate" title={m.fullName}>{m.fullName.split(' ')[0]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {matrix.slice(0, 30).map((row) => (
                <tr key={row.controlId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-r border-gray-200">
                    <span className="font-mono font-semibold text-gray-700">{row.controlCode}</span>
                  </td>
                  {activeMembers.map((m) => {
                    const assignment = row.assignments.find((a) => a.userId === m.id);
                    const isConflict = conflictSet.has(`${row.controlId}:${m.id}`);
                    return (
                      <td
                        key={m.id}
                        className={cn('text-center px-2 py-2 border-r border-gray-100', isConflict && 'bg-red-50')}
                      >
                        {assignment ? (
                          <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border', RACI_COLORS[assignment.raci])}>
                            {assignment.raci}
                          </span>
                        ) : (
                          <span className="text-gray-300">·</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {matrix.length > 30 && (
            <p className="text-xs text-gray-400 text-center mt-2">Showing 30 of {matrix.length} controls</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
        <span className="text-xs text-gray-500 font-medium">Legend:</span>
        {(['R', 'A', 'C', 'I'] as RaciLetter[]).map((l) => (
          <div key={l} className="flex items-center gap-1.5">
            <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold border', RACI_COLORS[l])}>{l}</span>
            <span className="text-xs text-gray-500">{{ R: 'Responsible', A: 'Accountable', C: 'Consulted', I: 'Informed' }[l]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Access Reviews Tab ───────────────────────────────────────────────────────

const ACCESS_REVIEW_STATUS_CONFIG = {
  pending:     { label: 'Pending',     cls: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
  signed:      { label: 'Signed',      cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  overdue:     { label: 'Overdue',     cls: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
};

function AccessReviewsTab() {
  const qc = useQueryClient();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['access-reviews'],
    queryFn: teamApi.getAccessReviews,
  });

  const generate = useMutation({
    mutationFn: teamApi.generateAccessReviews,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['access-reviews'] }),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          ISO A.8.2 / SOC 2 CC6.3 — Quarterly access reviews ensure access rights remain appropriate.
        </p>
        <button
          className="btn-primary text-xs flex items-center gap-1.5"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
        >
          {generate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Generate Quarterly Reviews
        </button>
      </div>

      {generate.data && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg px-3 py-2 mb-3">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Generated {(generate.data as any).created} new access review{(generate.data as any).created !== 1 ? 's' : ''}
        </div>
      )}

      {(reviews as any[]).length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">No access reviews yet.</p>
          <p className="text-xs text-gray-400 mt-1">Click "Generate Quarterly Reviews" to create the first cycle.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(reviews as any[]).map((review) => {
            const status = review.status as keyof typeof ACCESS_REVIEW_STATUS_CONFIG;
            const statusCfg = ACCESS_REVIEW_STATUS_CONFIG[status] ?? ACCESS_REVIEW_STATUS_CONFIG.pending;
            const isOverdue = new Date(review.dueDate) < new Date() && status !== 'signed';
            const effectiveStatus = isOverdue ? 'overdue' : status;
            const effectiveCfg = ACCESS_REVIEW_STATUS_CONFIG[effectiveStatus] ?? statusCfg;
            return (
              <div key={review.id} className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <div className={cn('w-2 h-2 rounded-full shrink-0', effectiveCfg.dot)} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    Review for {review.reviewer?.fullName ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {review.items?.length ?? 0} items · Due {new Date(review.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', effectiveCfg.cls)}>
                  {effectiveCfg.label}
                </span>
                {status !== 'signed' && (
                  <button className="btn-primary text-xs py-1.5 px-3">
                    Review
                  </button>
                )}
                {status === 'signed' && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Evidence generated
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Training Tab ─────────────────────────────────────────────────────────────

function TrainingTab({ members }: { members: TeamMember[] }) {
  const completionPct = members.length > 0
    ? Math.round(members.filter((m) => (m.stats?.trainingComplete ?? 0) > 0).length / members.length * 100)
    : 0;

  return (
    <div>
      {/* Org completion bar */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">Security Awareness Training Completion</span>
          <span className="text-xs font-bold text-brand-700">{completionPct}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-2 bg-brand-500 rounded-full transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">ISO A.6.3 requires 100% annual completion before audit</p>
      </div>

      {/* Per-member table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200">
            {['Member', 'Modules Assigned', 'Completed', 'Status'].map((h) => (
              <th key={h} className="text-left text-xs font-semibold text-gray-500 py-2 px-3 first:pl-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {members.filter((m) => m.status === 'active').map((m) => {
            const complete = m.stats?.trainingComplete ?? 0;
            return (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="py-2.5 pl-0 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-brand-700">{m.fullName[0]}</span>
                    </div>
                    <span className="font-medium text-gray-800">{m.fullName}</span>
                  </div>
                </td>
                <td className="py-2.5 px-3 text-gray-500">—</td>
                <td className="py-2.5 px-3">
                  <span className="font-medium text-gray-800">{complete}</span>
                </td>
                <td className="py-2.5 px-3">
                  {complete > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                      <Clock className="w-3.5 h-3.5" /> Pending
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'members',       label: 'Members',        icon: Users },
  { id: 'raci',          label: 'RACI Matrix',     icon: Grid3X3 },
  { id: 'access-reviews', label: 'Access Reviews', icon: Shield },
  { id: 'training',      label: 'Training',        icon: BookOpen },
];

export default function MembersPage() {
  const [activeTab, setActiveTab] = useState('members');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: teamApi.getMembers,
  });

  const activeCount  = members.filter((m) => m.status === 'active').length;
  const pendingCount = members.filter((m) => m.status === 'suspended').length;

  return (
    <div className="p-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount} active member{activeCount !== 1 ? 's' : ''}
            {pendingCount > 0 && <span className="text-amber-600"> · {pendingCount} pending activation</span>}
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setShowInvite(true); setInviteSuccess(false); }}>
          <UserPlus className="w-4 h-4" /> Invite Member
        </button>
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Invite sent successfully! The user will receive an email with activation instructions.
          <button onClick={() => setInviteSuccess(false)} className="ml-auto p-0.5 rounded hover:bg-emerald-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Members', value: activeCount, icon: Users, color: 'text-brand-600' },
          { label: 'Pending Activation', value: pendingCount, icon: Clock, color: 'text-amber-600' },
          { label: 'RACI Gaps', value: '—', icon: AlertTriangle, color: 'text-orange-500' },
          { label: 'SoD Conflicts', value: '—', icon: AlertCircle, color: 'text-red-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', color)} />
              <span className="text-xs text-gray-500">{label}</span>
            </div>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-5">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            {activeTab === 'members'       && <MembersTab members={members} />}
            {activeTab === 'raci'          && <RaciMatrixTab members={members} />}
            {activeTab === 'access-reviews' && <AccessReviewsTab />}
            {activeTab === 'training'      && <TrainingTab members={members} />}
          </>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSuccess={() => { setShowInvite(false); setInviteSuccess(true); }}
        />
      )}
    </div>
  );
}
