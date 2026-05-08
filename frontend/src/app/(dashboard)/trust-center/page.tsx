'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';
import {
  Globe, Shield, CheckCircle, Clock, XCircle, Lock, Eye, EyeOff,
  Download, Copy, Check, ChevronRight, FileText, Zap, AlertCircle,
  ExternalLink, Star, RefreshCw, X, MessageSquare, Loader2,
  Plus, Paintbrush, Link2, Settings2, BarChart3, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  trustCenterApi,
  type TrustCenter,
  type TrustCenterAccessLink,
  type UpdateTrustCenterDto,
} from '@/lib/api/trust-center';

// ─── Types (legacy check items) ───────────────────────────────────────────────

type TrustItem = {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'passing' | 'failing' | 'in_progress' | 'not_started';
  public: boolean;
  framework?: string;
  lastChecked?: string;
  evidence?: string[];
};

type FaqItem  = { category: string; question: string; answer: string; strength: 'high' | 'medium' };
type FaqResult = { companyName: string; frameworks: string; faqs: FaqItem[]; generatedAt: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  passing:     { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle, dot: 'bg-emerald-500' },
  failing:     { cls: 'bg-red-50 text-red-700 border border-red-200',             icon: XCircle,     dot: 'bg-red-500' },
  in_progress: { cls: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: Clock,       dot: 'bg-amber-400' },
  not_started: { cls: 'bg-gray-100 text-gray-500',                                icon: AlertCircle, dot: 'bg-gray-300' },
} as const;

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'Access Control':   Lock,
  'Data Security':    Shield,
  'Availability':     Zap,
  'Incident Response': AlertCircle,
  'Compliance':       FileText,
  'Monitoring':       Eye,
};

const CATEGORY_COLOR: Record<string, string> = {
  'Data Security':    'bg-blue-50 text-blue-700 border-blue-200',
  'Access Control':   'bg-purple-50 text-purple-700 border-purple-200',
  'Compliance':       'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Incident Response': 'bg-red-50 text-red-700 border-red-200',
  'Vendor Risk':      'bg-orange-50 text-orange-700 border-orange-200',
  'Data Management':  'bg-teal-50 text-teal-700 border-teal-200',
  'Employee Security': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function publicPageUrl(slug: string) {
  if (typeof window === 'undefined') return `/trust/${slug}`;
  return `${window.location.origin}/trust/${slug}`;
}

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      title="Copy"
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
        copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        className,
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', accent ?? 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── TrustCheckItem ───────────────────────────────────────────────────────────

function TrustCheckItem({ item }: { item: TrustItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started;
  const Icon = CATEGORY_ICONS[item.category] ?? Shield;
  const StatusIcon = cfg.icon;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <button onClick={() => setExpanded((p) => !p)} className="w-full text-left flex items-center gap-4 px-5 py-4">
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            {item.framework && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">{item.framework}</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.lastChecked && (
            <span className="text-xs text-gray-400 hidden sm:block">{timeAgo(item.lastChecked)}</span>
          )}
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full', cfg.cls)}>
            <StatusIcon className="w-3 h-3" />
            {item.status.replace(/_/g, ' ')}
          </span>
          <ChevronRight className={cn('w-4 h-4 text-gray-300 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-3">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-gray-700">{item.description}</p>
          </div>
          {item.evidence && item.evidence.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Evidence</p>
              <div className="space-y-1">
                {item.evidence.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <FileText className="w-3 h-3 text-gray-400" />{e}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className={cn('w-2 h-2 rounded-full', cfg.dot)} />
            <span className="text-xs text-gray-500 capitalize">{item.status.replace(/_/g, ' ')}</span>
            {item.lastChecked && (
              <span className="text-xs text-gray-400">· Last verified {timeAgo(item.lastChecked)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SecurityFaqModal ─────────────────────────────────────────────────────────

function SecurityFaqModal({ data, onClose }: { data: FaqResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = [
      `SECURITY FAQ — ${data.companyName}`, `Frameworks: ${data.frameworks}`, '',
      ...data.faqs.flatMap((f) => [`Q: ${f.question}`, `A: ${f.answer}`, '']),
      `Generated: ${new Date(data.generatedAt).toLocaleString()}`,
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-600" />AI Security FAQ
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{data.faqs.length} questions · {data.frameworks}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
              {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy All</>}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {data.faqs.map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3 bg-gray-50">
                <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 mt-0.5', CATEGORY_COLOR[faq.category] ?? 'bg-gray-100 text-gray-600 border-gray-200')}>
                  {faq.category}
                </span>
                <p className="text-sm font-semibold text-gray-900">{faq.question}</p>
                {faq.strength === 'high' && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
              </div>
              <div className="px-4 py-3"><p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p></div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t shrink-0">
          <p className="text-xs text-gray-400 text-center">AI-generated · Review before sharing · {new Date(data.generatedAt).toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ─── PublishPanel ─────────────────────────────────────────────────────────────

function PublishPanel({ tc }: { tc: TrustCenter }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const { mutate: publish,   isPending: publishing   } = useMutation({
    mutationFn: trustCenterApi.publish,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['trust-center'] }); setConfirming(false); },
  });
  const { mutate: unpublish, isPending: unpublishing } = useMutation({
    mutationFn: trustCenterApi.unpublish,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['trust-center'] }); setConfirming(false); },
  });

  const busy = publishing || unpublishing;
  const url  = publicPageUrl(tc.slug);

  if (tc.isPublic) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-800">Trust Center is public</p>
            <p className="text-sm text-emerald-600 mt-0.5">Published {fmtDate(tc.publishedAt)} · Anyone with the link can view it.</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium hover:underline underline-offset-2">
                {url}<ExternalLink className="w-3.5 h-3.5 ml-0.5" />
              </a>
              <CopyButton text={url} />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-emerald-200">
          {confirming ? (
            <div className="flex items-center gap-3 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-sm text-gray-700 flex-1">This will immediately hide the page from public view.</span>
              <button onClick={() => setConfirming(false)} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={() => unpublish()} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 disabled:opacity-60">
                {unpublishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Unpublish
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors">
              <EyeOff className="w-4 h-4" />Unpublish trust center
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <Clock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-gray-800">Trust Center is private</p>
          <p className="text-sm text-gray-500 mt-0.5">Only accessible via private access links until you publish it publicly.</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">Public URL: {url}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        {confirming ? (
          <div className="flex items-center gap-3 flex-wrap">
            <Globe className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="text-sm text-gray-700 flex-1">This will make the page visible to anyone with the link.</span>
            <button onClick={() => setConfirming(false)} className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={() => publish()} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Publish now
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors">
            <Globe className="w-4 h-4" />Publish trust center
          </button>
        )}
      </div>
    </div>
  );
}

// ─── BrandingForm ─────────────────────────────────────────────────────────────

function BrandingForm({ tc }: { tc: TrustCenter }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<UpdateTrustCenterDto>({
    companyName:  tc.companyName,
    logoUrl:      tc.logoUrl ?? '',
    primaryColor: tc.primaryColor,
    headline:     tc.headline,
    description:  tc.description,
    showControls: tc.showControls,
    showEvidence: tc.showEvidence,
  });
  const [saved, setSaved] = useState(false);

  const { mutate, isPending } = useMutation({
    mutationFn: () => trustCenterApi.update({ ...form, logoUrl: form.logoUrl || null }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['trust-center'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const set = useCallback((k: keyof UpdateTrustCenterDto, v: unknown) => setForm((p) => ({ ...p, [k]: v })), []);

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutate(); }} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Company Name</label>
          <input type="text" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Brand Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)}
              className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
            <input type="text" value={form.primaryColor} onChange={(e) => set('primaryColor', e.target.value)}
              placeholder="#6366f1" pattern="^#[0-9A-Fa-f]{6}$"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Logo URL <span className="font-normal text-gray-400">(leave blank for initials)</span></label>
        <input type="url" value={form.logoUrl ?? ''} onChange={(e) => set('logoUrl', e.target.value)}
          placeholder="https://example.com/logo.png"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Page Headline</label>
        <input type="text" value={form.headline} onChange={(e) => set('headline', e.target.value)} required
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </div>

      {/* Visibility toggles */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visible sections</p>
        {([
          { key: 'showControls' as const, label: 'Show Compliance Frameworks', desc: 'Framework-level control implementation progress' },
          { key: 'showEvidence' as const, label: 'Show Evidence Count',        desc: 'Total evidence documents collected' },
        ] as const).map(({ key, label, desc }) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-gray-800">{label}</span>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <button type="button" role="switch" aria-checked={!!form[key]} onClick={() => set(key, !form[key])}
              className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none shrink-0',
                form[key] ? 'bg-brand-600' : 'bg-gray-300')}>
              <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                form[key] ? 'translate-x-4' : 'translate-x-0.5')} />
            </button>
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending}
          className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
            saved ? 'bg-emerald-500' : 'bg-brand-600 hover:bg-brand-700 disabled:opacity-60')}>
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {saved ? <><Check className="w-3.5 h-3.5" />Saved</> : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

// ─── AccessLinksPanel ─────────────────────────────────────────────────────────

function AccessLinksPanel({ tc }: { tc: TrustCenter }) {
  const qc = useQueryClient();
  const [label, setLabel]           = useState('');
  const [expireDays, setExpireDays] = useState('30');
  const [showForm, setShowForm]     = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['trust-center-links'],
    queryFn:  trustCenterApi.listLinks,
    staleTime: 60_000,
  });

  const { mutate: createLink, isPending: creating } = useMutation({
    mutationFn: () => trustCenterApi.createLink({ label, expiresInDays: expireDays === '' ? undefined : Number(expireDays) }),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['trust-center-links'] }); setLabel(''); setExpireDays('30'); setShowForm(false); },
  });

  function isExpired(l: TrustCenterAccessLink) {
    return !!l.expiresAt && new Date(l.expiresAt) < new Date();
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No access links yet</p>
          <p className="text-xs mt-1">Create a link to share with specific auditors or customers before publishing publicly.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const expired = isExpired(link);
            const url     = `${publicPageUrl(tc.slug)}?token=${link.token}`;
            return (
              <div key={link.id} className={cn('flex items-start gap-3 p-3 rounded-xl border',
                expired ? 'border-red-100 bg-red-50/50 opacity-60' : 'border-gray-100 bg-white')}>
                <Link2 className={cn('w-4 h-4 mt-0.5 shrink-0', expired ? 'text-red-400' : 'text-gray-400')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 truncate">{link.label}</span>
                    {expired && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Expired</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                    <span>Created {timeAgo(link.createdAt)}</span>
                    {link.expiresAt && <span>{expired ? 'Expired' : 'Expires'} {fmtDate(link.expiresAt)}</span>}
                    <span>{link.viewCount} view{link.viewCount !== 1 ? 's' : ''}</span>
                  </div>
                  <p className="text-xs text-gray-300 truncate mt-1 font-mono">{url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!expired && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-brand-50 transition-colors" title="Open">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <CopyButton text={url} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm ? (
        <div className="border border-dashed border-brand-300 rounded-xl p-4 bg-brand-50/30 space-y-3">
          <p className="text-sm font-medium text-gray-700">New access link</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Label (e.g. "Acme Corp Audit Q2")</label>
              <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Recipient / purpose" autoFocus
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expires in (days, blank = never)</label>
              <input type="number" min={1} value={expireDays} onChange={(e) => setExpireDays(e.target.value)} placeholder="30"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            <button type="button" disabled={!label.trim() || creating} onClick={() => createLink()}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-60 transition-colors">
              {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create link
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-colors">
          <Plus className="w-4 h-4" />New access link
        </button>
      )}
    </div>
  );
}

// ─── PassRateWidget ───────────────────────────────────────────────────────────

function PassRateWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['trust-center-pass-rate'],
    queryFn:  trustCenterApi.getPassRate,
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;

  const pr = data ?? { total: 0, pass: 0, fail: 0, skipped: 0, passRate: 0 };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Control Test Pass Rate</span>
        <span className={cn('text-xl font-bold',
          pr.passRate >= 80 ? 'text-emerald-600' : pr.passRate >= 50 ? 'text-amber-500' : 'text-red-500')}>
          {pr.passRate}%
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all',
          pr.passRate >= 80 ? 'bg-emerald-500' : pr.passRate >= 50 ? 'bg-amber-400' : 'bg-red-400')}
          style={{ width: `${pr.passRate}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-50 rounded-lg p-2"><div className="text-lg font-bold text-emerald-600">{pr.pass}</div><div className="text-emerald-600">Passing</div></div>
        <div className="bg-red-50 rounded-lg p-2"><div className="text-lg font-bold text-red-500">{pr.fail}</div><div className="text-red-500">Failing</div></div>
        <div className="bg-gray-50 rounded-lg p-2"><div className="text-lg font-bold text-gray-500">{pr.skipped}</div><div className="text-gray-500">Skipped</div></div>
      </div>
      {pr.total === 0 && (
        <p className="text-xs text-gray-400 text-center">No control tests yet — connect integrations to populate results.</p>
      )}
    </div>
  );
}

// ─── SettingsTab ──────────────────────────────────────────────────────────────

function SettingsTab({ tc }: { tc: TrustCenter }) {
  return (
    <div className="space-y-6">
      {/* Publish */}
      <PublishPanel tc={tc} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Branding */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
              <Paintbrush className="w-3.5 h-3.5 text-brand-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Branding &amp; Content</h2>
              <p className="text-xs text-gray-500 mt-0.5">Customize what visitors see on your public page</p>
            </div>
          </div>
          <div className="p-6"><BrandingForm tc={tc} /></div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pass rate */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <BarChart3 className="w-3.5 h-3.5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Live Pass Rate</h2>
                <p className="text-xs text-gray-500 mt-0.5">Displayed on the public trust center page</p>
              </div>
            </div>
            <div className="p-6"><PassRateWidget /></div>
          </div>

          {/* Access links */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                <Link2 className="w-3.5 h-3.5 text-brand-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Private Access Links</h2>
                <p className="text-xs text-gray-500 mt-0.5">Share with specific auditors or customers before publishing</p>
              </div>
            </div>
            <div className="p-6"><AccessLinksPanel tc={tc} /></div>
          </div>

          {/* Slug info */}
          <div className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 text-sm">
            <Settings2 className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-500 text-xs">
              Your slug is{' '}
              <span className="font-mono text-gray-700 bg-white border border-gray-200 px-1.5 py-0.5 rounded">{tc.slug}</span>
              {' '}— contact support to change it.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────

function OverviewTab({ tc }: { tc: TrustCenter }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus,   setActiveStatus]   = useState<'all' | 'passing' | 'in_progress' | 'failing'>('all');
  const [securityFaq,    setSecurityFaq]    = useState<FaqResult | null>(null);

  const generateFaq = useMutation({
    mutationFn: () => api.post('/trust-center/ai-security-faq').then((r: any) => r.data),
    onSuccess:  (data: any) => setSecurityFaq(data),
  });

  const { data: trustItems, isLoading, refetch } = useQuery<TrustItem[]>({
    queryKey: ['trust-center-items'],
    queryFn:  () => api.get('/trust-center/checks').then((r: any) => r.data).catch(() => []),
  });

  const items: TrustItem[] = trustItems ?? [];
  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))];
  const passing    = items.filter((i) => i.status === 'passing').length;
  const failing    = items.filter((i) => i.status === 'failing').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const score      = items.length > 0 ? Math.round((passing / items.length) * 100) : 0;

  const filtered = items.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (activeStatus   !== 'all' && item.status   !== activeStatus)   return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {securityFaq && <SecurityFaqModal data={securityFaq} onClose={() => setSecurityFaq(null)} />}

      {/* Actions bar */}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => generateFaq.mutate()} disabled={generateFaq.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-60">
          {generateFaq.isPending
            ? <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generating…</>
            : <><MessageSquare className="w-3.5 h-3.5" />AI Security FAQ</>}
        </button>
        <button onClick={() => refetch()} className="btn-secondary text-xs flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Trust Score" value={`${score}%`} sub={`${passing} of ${items.length} passing`} accent="text-brand-700" />
        <StatCard label="Passing" value={passing} sub="controls verified" accent="text-emerald-700" />
        <StatCard label="In Progress" value={inProgress} sub="being implemented" accent="text-amber-600" />
        <StatCard label="Action Needed" value={failing} sub={failing > 0 ? 'require attention' : 'none — great!'} accent={failing > 0 ? 'text-red-600' : 'text-gray-500'} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all',
                activeCategory === cat ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'passing', 'in_progress', 'failing'] as const).map((s) => (
            <button key={s} onClick={() => setActiveStatus(s)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all',
                activeStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No checks match this filter</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the category or status filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {Array.from(new Set(filtered.map((i) => i.category))).map((cat) => {
            const catItems  = filtered.filter((i) => i.category === cat);
            const CatIcon   = CATEGORY_ICONS[cat] ?? Shield;
            const catPassing = catItems.filter((i) => i.status === 'passing').length;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                  <CatIcon className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</p>
                  <span className="text-xs text-gray-400">({catPassing}/{catItems.length} passing)</span>
                </div>
                <div className="space-y-2">{catItems.map((item) => <TrustCheckItem key={item.id} item={item} />)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Security docs */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Security Documents</p>
        <div className="space-y-2">
          {[
            { label: 'Security Overview',           desc: 'High-level summary of security controls and practices' },
            { label: 'Penetration Test Summary',    desc: 'Latest external pen test executive summary' },
            { label: 'SOC 2 Report (upon NDA)',     desc: 'Full audit report available under NDA' },
          ].map(({ label, desc }) => (
            <div key={label} className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              <button className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1.5 shrink-0">
                <Download className="w-3.5 h-3.5" />Request
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'settings';

export default function TrustCenterPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const { data: tc, isLoading, isError } = useQuery({
    queryKey: ['trust-center'],
    queryFn:  trustCenterApi.get,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="h-8 bg-gray-100 rounded-xl w-48 animate-pulse" />
        <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="grid sm:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      </div>
    );
  }

  if (isError || !tc) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 font-medium">Failed to load Trust Center settings</p>
          <p className="text-sm text-red-500 mt-1">Check that the API server is running and try refreshing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-600" />
            Trust Center
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your security posture, certifications, and compliance status — shareable with customers and auditors.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {tc.isPublic && (
            <a href={publicPageUrl(tc.slug)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors">
              <Eye className="w-3.5 h-3.5" />Preview
            </a>
          )}
          <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border',
            tc.isPublic
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-gray-50 text-gray-500 border-gray-200')}>
            {tc.isPublic ? <><CheckCircle className="w-3.5 h-3.5" />Public</> : <><EyeOff className="w-3.5 h-3.5" />Private</>}
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { id: 'overview' as Tab, label: 'Trust Checks',  icon: Shield },
          { id: 'settings' as Tab, label: 'Settings',      icon: Settings2 },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'overview' ? <OverviewTab tc={tc} /> : <SettingsTab tc={tc} />}
    </div>
  );
}
