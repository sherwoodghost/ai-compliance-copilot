'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { vendorsApi, Vendor, VsqResult, VsqQuestion } from '@/lib/api/vendors';
import { formatDate } from '@/lib/utils';
import {
  Building2, AlertTriangle, CheckCircle, Search, ChevronDown, ChevronUp,
  Calendar, ShieldAlert, ShieldCheck, Package, ExternalLink, Plus,
  Pencil, Trash2, X, Save, Sparkles, ClipboardList, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types imported from @/lib/api/vendors ────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const RISK_CONFIG: Record<string, { badge: string; dot: string; border: string; accent: string }> = {
  critical: { badge: 'bg-red-100 text-red-800 border border-red-200', dot: 'bg-red-500', border: 'border-l-4 border-red-400', accent: 'bg-gradient-to-br from-red-50 to-white' },
  high:     { badge: 'bg-orange-100 text-orange-800 border border-orange-200', dot: 'bg-orange-400', border: 'border-l-4 border-orange-400', accent: 'bg-gradient-to-br from-orange-50 to-white' },
  medium:   { badge: 'bg-yellow-100 text-yellow-800 border border-yellow-200', dot: 'bg-yellow-400', border: 'border-l-4 border-yellow-300', accent: 'bg-gradient-to-br from-yellow-50 to-white' },
  low:      { badge: 'bg-green-100 text-green-800 border border-green-200', dot: 'bg-green-400', border: 'border-l-4 border-green-300', accent: 'bg-gradient-to-br from-green-50 to-white' },
};

const STATUS_CONFIG: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border border-green-200',
  flagged:  'bg-red-50 text-red-700 border border-red-200',
  pending:  'bg-gray-100 text-gray-500',
};

const FILTER_TABS = ['all', 'critical', 'high', 'medium', 'low'] as const;
type FilterTab = typeof FILTER_TABS[number];

const CATEGORIES = [
  'Cloud Infrastructure', 'DevOps / CI-CD', 'Identity / IAM', 'Monitoring / Observability',
  'Data Storage', 'Communication', 'Payment Processing', 'HR / Payroll',
  'Security', 'Legal / Compliance', 'CRM / Sales', 'Other',
];

// ─── Vendor Form Modal ────────────────────────────────────────────────────────

function VendorModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Partial<Vendor>;
  onClose: () => void;
  onSave: (data: Partial<Vendor>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<Partial<Vendor>>({
    vendorName: initial?.vendorName ?? '',
    category: initial?.category ?? '',
    riskLevel: initial?.riskLevel ?? 'medium',
    status: initial?.status ?? 'pending',
    contactEmail: initial?.contactEmail ?? '',
    website: initial?.website ?? '',
    notes: initial?.notes ?? '',
    summary: initial?.summary ?? '',
  });

  function field(k: keyof Vendor) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? 'Edit Vendor' : 'Add Vendor'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Vendor Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Vendor Name *</label>
            <input
              type="text"
              value={form.vendorName}
              onChange={field('vendorName')}
              className="input w-full"
              placeholder="e.g. AWS, GitHub, Okta"
            />
          </div>

          {/* Category + Risk Level */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
              <select value={form.category} onChange={field('category')} className="input w-full text-sm">
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Risk Level</label>
              <select value={form.riskLevel} onChange={field('riskLevel')} className="input w-full text-sm">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={field('status')} className="input w-full text-sm">
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>

          {/* Contact + Website */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={field('contactEmail')}
                className="input w-full text-sm"
                placeholder="security@vendor.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={field('website')}
                className="input w-full text-sm"
                placeholder="https://vendor.com"
              />
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Risk Summary</label>
            <textarea
              value={form.summary}
              onChange={field('summary')}
              className="input w-full text-sm"
              rows={2}
              placeholder="Brief summary of vendor risk posture…"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea
              value={form.notes}
              onChange={field('notes')}
              className="input w-full text-sm"
              rows={2}
              placeholder="Internal notes visible only to your team…"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.vendorName?.trim() || saving}
            className="btn-primary text-sm flex items-center gap-2"
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

function DeleteDialog({ vendorName, onConfirm, onCancel, deleting }: {
  vendorName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Remove Vendor</h3>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to remove <strong>{vendorName}</strong>? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
            {deleting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Security Questionnaire Modal ─────────────────────────────────────

// VsqResult and VsqQuestion imported from @/lib/api/vendors

const VSQ_CATEGORY_COLOR: Record<string, string> = {
  'Data Security':        'bg-blue-50 text-blue-700',
  'Access Controls':      'bg-purple-50 text-purple-700',
  'Incident Response':    'bg-red-50 text-red-700',
  'Business Continuity':  'bg-orange-50 text-orange-700',
  'Compliance':           'bg-emerald-50 text-emerald-700',
  'Subprocessors':        'bg-indigo-50 text-indigo-700',
  'Data Retention':       'bg-teal-50 text-teal-700',
  'Penetration Testing':  'bg-yellow-50 text-yellow-700',
  'Employee Security':    'bg-pink-50 text-pink-700',
};

function VendorQsnModal({ result, onClose }: { result: VsqResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const categories = [...new Set(result.questions.map((q) => q.category))];

  function copyAll() {
    const text = categories.map((cat) => {
      const qs = result.questions.filter((q) => q.category === cat);
      return `## ${cat}\n${qs.map((q, i) => `${i + 1}. ${q.question}${q.notes ? `\n   (${q.notes})` : ''}`).join('\n')}`;
    }).join('\n\n');

    navigator.clipboard.writeText(
      `VENDOR SECURITY QUESTIONNAIRE\nVendor: ${result.vendorName}\nFrameworks: ${result.frameworks}\n\n${text}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Vendor Security Questionnaire</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {result.vendorName} · {result.questions.length} questions · {result.frameworks}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Calendar className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy All'}
            </button>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-5 space-y-5">
          {categories.map((cat) => {
            const qs = result.questions.filter((q) => q.category === cat);
            const cls = VSQ_CATEGORY_COLOR[cat] ?? 'bg-gray-50 text-gray-600';
            return (
              <div key={cat}>
                <div className={cn('inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full mb-3', cls)}>
                  {cat}
                </div>
                <ol className="space-y-3">
                  {qs.map((q, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          {q.question}
                          {q.required && (
                            <span className="ml-1.5 text-xs font-medium text-red-500">*</span>
                          )}
                        </p>
                        {q.notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{q.notes}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center shrink-0">
          * Required questions · Generated by AI based on vendor risk profile and compliance frameworks
        </div>
      </div>
    </div>
  );
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  onEdit,
  onDelete,
  onAiAnalyze,
  analyzing,
}: {
  vendor: Vendor;
  onEdit: (v: Vendor) => void;
  onDelete: (v: Vendor) => void;
  onAiAnalyze: (v: Vendor) => void;
  analyzing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<VsqResult | null>(null);
  const [generatingQsn, setGeneratingQsn] = useState(false);
  const cfg = RISK_CONFIG[vendor.riskLevel] ?? RISK_CONFIG.low;

  async function generateQuestionnaire(e: React.MouseEvent) {
    e.stopPropagation();
    setGeneratingQsn(true);
    try {
      const res = await vendorsApi.aiQuestionnaire(vendor.id);
      setQuestionnaire(res);
    } catch {
      // silent error
    } finally {
      setGeneratingQsn(false);
    }
  }
  const findingCount = vendor.findings?.length ?? 0;
  const mitigationCount = vendor.mitigations?.length ?? 0;

  return (
    <>
    {questionnaire && (
      <VendorQsnModal result={questionnaire} onClose={() => setQuestionnaire(null)} />
    )}
    <div className={cn('card overflow-hidden transition-shadow hover:shadow-md', cfg.border)}>
      {/* Clickable header */}
      <button onClick={() => setExpanded((p) => !p)} className="w-full text-left p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', cfg.accent)}>
              <Building2 className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{vendor.vendorName}</p>
              {vendor.category && <p className="text-xs text-gray-400 capitalize">{vendor.category}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', cfg.badge)}>
              {vendor.riskLevel}
            </span>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          {findingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
              <ShieldAlert className="w-3 h-3" />{findingCount} finding{findingCount !== 1 ? 's' : ''}
            </span>
          )}
          {mitigationCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200">
              <ShieldCheck className="w-3 h-3" />{mitigationCount} mitigated
            </span>
          )}
          {vendor.status && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full capitalize', STATUS_CONFIG[vendor.status] ?? STATUS_CONFIG.pending)}>
              {vendor.status}
            </span>
          )}
        </div>

        {/* Mitigation bar */}
        {findingCount > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Mitigations</span>
              <span className="text-xs font-medium text-gray-700">{mitigationCount}/{findingCount}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', mitigationCount === findingCount ? 'bg-green-500' : mitigationCount >= findingCount / 2 ? 'bg-blue-500' : 'bg-orange-400')}
                style={{ width: `${Math.round((mitigationCount / findingCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {vendor.lastReviewedAt && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
            <Calendar className="w-3 h-3 text-gray-400" />
            <p className="text-xs text-gray-400">Last reviewed {formatDate(vendor.lastReviewedAt)}</p>
          </div>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-4 space-y-3">
          {vendor.summary && (
            <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{vendor.summary}</p>
          )}
          {vendor.findings && vendor.findings.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Findings</p>
              {vendor.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 bg-orange-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-700">{f}</p>
                </div>
              ))}
            </div>
          )}
          {vendor.mitigations && vendor.mitigations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mitigations</p>
              {vendor.mitigations.map((m, i) => (
                <div key={i} className="flex items-start gap-2 bg-green-50 rounded-lg px-3 py-2">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-gray-700">{m}</p>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {vendor.contactEmail && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Contact</p>
                <p className="text-xs font-medium text-gray-700 truncate">{vendor.contactEmail}</p>
              </div>
            )}
            {vendor.website && (
              <div className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-400 mb-0.5">Website</p>
                <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 truncate"
                  onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  Visit
                </a>
              </div>
            )}
          </div>
          {vendor.notes && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{vendor.notes}</p>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onAiAnalyze(vendor); }}
              disabled={analyzing}
              className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 transition-colors disabled:opacity-50"
            >
              {analyzing ? (
                <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {analyzing ? 'Analyzing…' : 'AI Analyze'}
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={generateQuestionnaire}
              disabled={generatingQsn}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 transition-colors disabled:opacity-50"
            >
              {generatingQsn
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : <ClipboardList className="w-3.5 h-3.5" />}
              {generatingQsn ? 'Generating…' : 'VSQ'}
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(vendor); }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-600 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(vendor); }}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendorsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [editVendor, setEditVendor] = useState<Vendor | null | 'new'>('new' as any);
  const [deleteVendor, setDeleteVendor] = useState<Vendor | null>(null);

  // Reset editVendor after first render so modal doesn't auto-open
  const [showModal, setShowModal] = useState(false);
  const [modalVendor, setModalVendor] = useState<Vendor | null>(null);
  const [showDelete, setShowDelete] = useState<Vendor | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.list(),
  });

  const vendors: Vendor[] = data ?? [];

  const summary = useMemo(() => ({
    total:    vendors.length,
    critical: vendors.filter((v) => v.riskLevel === 'critical').length,
    high:     vendors.filter((v) => v.riskLevel === 'high').length,
    medium:   vendors.filter((v) => v.riskLevel === 'medium').length,
    low:      vendors.filter((v) => v.riskLevel === 'low').length,
  }), [vendors]);

  const filtered = useMemo(() => {
    let list = [...vendors].sort((a, b) => (RISK_ORDER[a.riskLevel] ?? 4) - (RISK_ORDER[b.riskLevel] ?? 4));
    if (activeTab !== 'all') list = list.filter((v) => v.riskLevel === activeTab);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((v) => v.vendorName.toLowerCase().includes(q) || (v.category ?? '').toLowerCase().includes(q));
    }
    return list;
  }, [vendors, activeTab, search]);

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; payload: Partial<Vendor> }) => {
      if (data.id) {
        return vendorsApi.update(data.id, data.payload);
      }
      return vendorsApi.create(data.payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setShowModal(false);
      setModalVendor(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setShowDelete(null);
    },
  });

  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const analyzeMutation = useMutation({
    mutationFn: (id: string) => vendorsApi.analyze(id),
    onMutate: (id) => setAnalyzingId(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] });
      setAnalyzingId(null);
    },
    onError: () => setAnalyzingId(null),
  });

  function openCreate() { setModalVendor(null); setShowModal(true); }
  function openEdit(v: Vendor) { setModalVendor(v); setShowModal(true); }
  function openDelete(v: Vendor) { setShowDelete(v); }

  function handleSave(formData: Partial<Vendor>) {
    saveMutation.mutate({ id: modalVendor?.id, payload: formData });
  }

  return (
    <div className="p-8 max-w-6xl">
      {/* Modals */}
      {showModal && (
        <VendorModal
          initial={modalVendor ?? undefined}
          onClose={() => { setShowModal(false); setModalVendor(null); }}
          onSave={handleSave}
          saving={saveMutation.isPending}
        />
      )}
      {showDelete && (
        <DeleteDialog
          vendorName={showDelete.vendorName}
          onConfirm={() => deleteMutation.mutate(showDelete.id)}
          onCancel={() => setShowDelete(null)}
          deleting={deleteMutation.isPending}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor Risk</h1>
          <p className="text-sm text-gray-500 mt-1">Third-party vendor assessments and risk posture</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      {/* Risk Summary Strip */}
      {!isLoading && vendors.length > 0 && (
        <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3 mb-6 shadow-sm flex-wrap">
          <span className="text-sm font-medium text-gray-700">{summary.total} vendor{summary.total !== 1 ? 's' : ''}</span>
          <div className="h-4 w-px bg-gray-200" />
          {(['critical', 'high', 'medium', 'low'] as const).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', RISK_CONFIG[level].dot)} />
              <span className="text-sm text-gray-600">
                <span className="font-semibold">{summary[level]}</span>{' '}
                <span className="text-gray-400 capitalize">{level}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Search + Filter */}
      {!isLoading && vendors.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn('text-xs font-medium px-3 py-1.5 rounded-md capitalize transition-all', activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
              >
                {tab === 'all' ? `All (${summary.total})` : (
                  <span className="flex items-center gap-1.5">
                    <span className={cn('w-1.5 h-1.5 rounded-full', RISK_CONFIG[tab].dot)} />
                    {tab} {summary[tab] > 0 && `(${summary[tab]})`}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            {search.trim() || activeTab !== 'all' ? <Search className="w-7 h-7 text-gray-300" /> : <Package className="w-7 h-7 text-gray-300" />}
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {search.trim() || activeTab !== 'all' ? 'No vendors match your filter' : 'No vendors yet'}
          </p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto mb-4">
            {search.trim() || activeTab !== 'all' ? 'Try a different filter or clear the search.' : 'Add your first vendor to start tracking third-party risk.'}
          </p>
          {!search.trim() && activeTab === 'all' && (
            <button onClick={openCreate} className="btn-primary text-sm inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              onEdit={openEdit}
              onDelete={openDelete}
              onAiAnalyze={(vendor) => analyzeMutation.mutate(vendor.id)}
              analyzing={analyzingId === v.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
