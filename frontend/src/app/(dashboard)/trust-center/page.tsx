'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Globe, Shield, CheckCircle, Clock, XCircle, Lock, Eye, EyeOff,
  Download, Copy, Check, ChevronRight, FileText, Zap, AlertCircle,
  ExternalLink, Star, RefreshCw, Sparkles, X, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type TrustConfig = {
  id: string;
  companyName: string;
  logoUrl?: string;
  tagline?: string;
  isPublic: boolean;
  publicUrl?: string;
  certifications: string[];
  frameworks: string[];
};

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



// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', accent ?? 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Check Item ──────────────────────────────────────────────────────────────

function TrustCheckItem({ item }: { item: TrustItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.not_started;
  const Icon = CATEGORY_ICONS[item.category] ?? Shield;
  const StatusIcon = cfg.icon;

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full text-left flex items-center gap-4 px-5 py-4"
      >
        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-gray-900">{item.title}</p>
            {item.framework && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 font-medium">
                {item.framework}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {item.lastChecked && (
            <span className="text-xs text-gray-400 hidden sm:block">
              {timeAgo(item.lastChecked)}
            </span>
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
                    <FileText className="w-3 h-3 text-gray-400" />
                    {e}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2">
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

// ─── Public URL Banner ────────────────────────────────────────────────────────

function PublicUrlBanner({ url, isPublic }: { url?: string; isPublic: boolean }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isPublic || !url) return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
          <Globe className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-900">Trust Center is public</p>
          <p className="text-xs text-emerald-700 truncate max-w-xs">{url}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800
                     bg-white border border-emerald-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800
                     bg-white border border-emerald-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          View
        </a>
      </div>
    </div>
  );
}

// ─── AI Security FAQ Modal ────────────────────────────────────────────────────

type FaqItem = {
  category: string;
  question: string;
  answer: string;
  strength: 'high' | 'medium';
};

type FaqResult = {
  companyName: string;
  frameworks: string;
  faqs: FaqItem[];
  generatedAt: string;
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

function SecurityFaqModal({ data, onClose }: { data: FaqResult; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyAll() {
    const text = [
      `SECURITY FAQ — ${data.companyName}`,
      `Frameworks: ${data.frameworks}`,
      ``,
      ...data.faqs.flatMap((f) => [
        `Q: ${f.question}`,
        `A: ${f.answer}`,
        ``,
      ]),
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
              <MessageSquare className="w-4 h-4 text-purple-600" />
              AI Security FAQ
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.faqs.length} questions · {data.frameworks} · Ready to share with customers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              {copied ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy All</>}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
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
                {faq.strength === 'high' && (
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700 leading-relaxed">{faq.answer}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t shrink-0">
          <p className="text-xs text-gray-400 text-center">
            AI-generated from your compliance data · Review before sharing · {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrustCenterPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeStatus, setActiveStatus] = useState<'all' | 'passing' | 'in_progress' | 'failing'>('all');
  const [securityFaq, setSecurityFaq] = useState<FaqResult | null>(null);

  const generateFaq = useMutation({
    mutationFn: () => api.post('/trust-center/ai-security-faq').then((r: any) => r.data),
    onSuccess: (data: any) => setSecurityFaq(data),
  });

  const { data: trustConfig } = useQuery<TrustConfig>({
    queryKey: ['trust-center-config'],
    queryFn: () => api.get('/trust-center').then((r: any) => r.data).catch(() => null),
  });

  const { data: passRate } = useQuery({
    queryKey: ['trust-center-pass-rate'],
    queryFn: () => api.get('/trust-center/pass-rate').then((r: any) => r.data).catch(() => null),
  });

  const { data: trustItems, isLoading, refetch } = useQuery<TrustItem[]>({
    queryKey: ['trust-center-items'],
    queryFn: () => api.get('/trust-center/checks').then((r: any) => r.data).catch(() => []),
  });

  const items: TrustItem[] = trustItems ?? [];

  const categories = ['all', ...Array.from(new Set(items.map((i) => i.category)))];
  const passing = items.filter((i) => i.status === 'passing').length;
  const failing = items.filter((i) => i.status === 'failing').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const score = items.length > 0 ? Math.round((passing / items.length) * 100) : 0;

  const filtered = items.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (activeStatus !== 'all' && item.status !== activeStatus) return false;
    return true;
  });

  const certifications = trustConfig?.certifications ?? ['SOC 2 Type I', 'ISO 27001 (In Progress)'];
  const isPublic = trustConfig?.isPublic ?? false;
  const publicUrl = trustConfig?.publicUrl ?? `https://trust.${typeof window !== 'undefined' ? window.location.hostname : 'app.example.com'}`;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* ── AI Security FAQ Modal ── */}
      {securityFaq && (
        <SecurityFaqModal data={securityFaq} onClose={() => setSecurityFaq(null)} />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trust Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Your security posture, certifications, and compliance status — shareable with customers and auditors.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => generateFaq.mutate()}
            disabled={generateFaq.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-60"
          >
            {generateFaq.isPending
              ? <><span className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generating…</>
              : <><MessageSquare className="w-3.5 h-3.5" />AI Security FAQ</>
            }
          </button>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button className="btn-primary text-xs flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5" />
            {isPublic ? 'Manage Public Page' : 'Publish Trust Center'}
          </button>
        </div>
      </div>

      {/* ── Public URL Banner ── */}
      <PublicUrlBanner url={publicUrl} isPublic={isPublic} />

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Trust Score"
          value={`${score}%`}
          sub={`${passing} of ${items.length} passing`}
          accent="text-brand-700"
        />
        <StatCard
          label="Passing"
          value={passing}
          sub="controls verified"
          accent="text-emerald-700"
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          sub="being implemented"
          accent="text-amber-600"
        />
        <StatCard
          label="Action Needed"
          value={failing}
          sub={failing > 0 ? 'require attention' : 'none — great!'}
          accent={failing > 0 ? 'text-red-600' : 'text-gray-500'}
        />
      </div>

      {/* ── Certifications ── */}
      {certifications.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Certifications & Frameworks</p>
          <div className="flex flex-wrap gap-2">
            {certifications.map((cert) => (
              <div
                key={cert}
                className="flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2"
              >
                <Star className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-sm font-medium text-brand-800">{cert}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Category tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all',
                activeCategory === cat
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'passing', 'in_progress', 'failing'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setActiveStatus(s)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all',
                activeStatus === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trust Checks List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-700">No checks match this filter</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the category or status filter.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Group by category */}
          {Array.from(new Set(filtered.map((i) => i.category))).map((cat) => {
            const catItems = filtered.filter((i) => i.category === cat);
            const CatIcon = CATEGORY_ICONS[cat] ?? Shield;
            const catPassing = catItems.filter((i) => i.status === 'passing').length;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                  <CatIcon className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</p>
                  <span className="text-xs text-gray-400">({catPassing}/{catItems.length} passing)</span>
                </div>
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <TrustCheckItem key={item.id} item={item} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Download section ── */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Security Documents</p>
        <div className="space-y-2">
          {[
            { label: 'Security Overview', desc: 'High-level summary of security controls and practices' },
            { label: 'Penetration Test Summary', desc: 'Latest external pen test executive summary' },
            { label: 'SOC 2 Report (upon NDA)', desc: 'Full audit report available under NDA' },
          ].map(({ label, desc }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400">{desc}</p>
                </div>
              </div>
              <button className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1.5 shrink-0">
                <Download className="w-3.5 h-3.5" />
                Request
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
