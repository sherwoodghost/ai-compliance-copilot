'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import {
  Shield, CheckCircle2, XCircle, Clock, ExternalLink,
  AlertTriangle, Lock, ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrustCenter {
  id:           string;
  slug:         string;
  companyName:  string;
  logoUrl:      string | null;
  primaryColor: string;
  headline:     string;
  description:  string;
  showControls: boolean;
  showEvidence: boolean;
  publishedAt:  string | null;
  updatedAt:    string;
}

interface PassRate {
  total:    number;
  pass:     number;
  fail:     number;
  skipped:  number;
  passRate: number;
}

interface FrameworkSummary {
  framework:   string;
  total:       number;
  implemented: number;
  inProgress:  number;
  notStarted:  number;
}

interface TrustCenterData {
  trustCenter: TrustCenter;
  passRate:    PassRate;
  frameworks:  FrameworkSummary[];
}

// ─── Components ───────────────────────────────────────────────────────────────

function RadialScore({ pct, color }: { pct: number; color: string }) {
  const data = [{ value: pct, fill: color }];
  return (
    <div className="relative w-40 h-40 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%" cy="50%"
          innerRadius="70%" outerRadius="90%"
          data={data} startAngle={90} endAngle={-270}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
          <RadialBar background dataKey="value" cornerRadius={6} angleAxisId={0} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{pct}%</span>
        <span className="text-xs text-gray-500 mt-0.5">pass rate</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: 'pass' | 'fail' | 'pending' }) {
  if (status === 'pass')
    return <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium"><CheckCircle2 className="w-4 h-4" />Passing</span>;
  if (status === 'fail')
    return <span className="flex items-center gap-1 text-red-500 text-sm font-medium"><XCircle className="w-4 h-4" />Needs attention</span>;
  return <span className="flex items-center gap-1 text-amber-500 text-sm font-medium"><Clock className="w-4 h-4" />In progress</span>;
}

function FrameworkCard({ fw, brandColor }: { fw: FrameworkSummary; brandColor: string }) {
  const pct = fw.total > 0 ? Math.round((fw.implemented / fw.total) * 100) : 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">{fw.framework}</h3>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          {fw.implemented}/{fw.total} controls
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: brandColor }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="font-semibold text-emerald-700">{fw.implemented}</div>
          <div className="text-emerald-600">Implemented</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <div className="font-semibold text-amber-700">{fw.inProgress}</div>
          <div className="text-amber-600">In progress</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-semibold text-gray-600">{fw.notStarted}</div>
          <div className="text-gray-500">Not started</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function TrustCenterContent() {
  const params       = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const token        = searchParams.get('token') ?? undefined;

  const [data,    setData]    = useState<TrustCenterData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const apiBase = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

  useEffect(() => {
    const url = `${apiBase}/public/trust/${params.slug}${token ? `?token=${token}` : ''}`;
    fetch(url)
      .then((r) => {
        if (!r.ok) {
          if (r.status === 403) throw new Error('This trust center is private or the access link has expired.');
          if (r.status === 404) throw new Error('Trust center not found.');
          throw new Error(`Error ${r.status}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.slug, token, apiBase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          Loading trust center…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Trust Center Unavailable</h1>
          <p className="text-gray-500">{error ?? 'Unable to load the trust center.'}</p>
        </div>
      </div>
    );
  }

  const { trustCenter: tc, passRate, frameworks } = data;
  const brand = tc.primaryColor || '#6366f1';

  const overallStatus: 'pass' | 'fail' | 'pending' =
    passRate.total === 0 ? 'pending' :
    passRate.passRate >= 80 ? 'pass' : 'fail';

  const lastUpdated = new Date(tc.updatedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Brand accent bar ── */}
      <div className="h-1 w-full" style={{ backgroundColor: brand }} />

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {tc.logoUrl ? (
              <img src={tc.logoUrl} alt={tc.companyName} className="h-9 w-auto object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: brand }}>
                {tc.companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-semibold text-gray-900">{tc.companyName}</h1>
              <p className="text-xs text-gray-400">Trust Center</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <StatusBadge status={overallStatus} />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* ── Hero ── */}
        <section className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-gray-900">{tc.headline}</h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">{tc.description}</p>
          <p className="text-xs text-gray-400">Last updated {lastUpdated}</p>
        </section>

        {/* ── Pass Rate Card ── */}
        <section>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Control Test Pass Rate</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Our automated compliance tests run every 6 hours across all connected systems.
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-emerald-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-emerald-600">{passRate.pass}</div>
                    <div className="text-xs text-emerald-600 mt-0.5">Passing</div>
                  </div>
                  <div className="bg-red-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-red-500">{passRate.fail}</div>
                    <div className="text-xs text-red-500 mt-0.5">Failing</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-2xl font-bold text-gray-500">{passRate.skipped}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Skipped</div>
                  </div>
                </div>
              </div>

              <div>
                {passRate.total > 0 ? (
                  <RadialScore pct={passRate.passRate} color={brand} />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <AlertTriangle className="w-10 h-10" />
                    <p className="text-sm">No tests run yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Framework Coverage ── */}
        {tc.showControls && frameworks.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Frameworks</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {frameworks.map((fw) => (
                <FrameworkCard key={fw.framework} fw={fw} brandColor={brand} />
              ))}
            </div>
          </section>
        )}

        {/* ── What we test ── */}
        <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: brand }} />
            What We Test
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { label: 'Policy Approvals', icon: '📋', desc: 'All critical policies reviewed and approved' },
              { label: 'MFA Enforcement',  icon: '🔐', desc: 'Multi-factor authentication on all accounts' },
              { label: 'Branch Protection', icon: '🌿', desc: 'Protected main branches across repositories' },
              { label: 'Secret Scanning',  icon: '🔍', desc: 'No exposed secrets in source code' },
              { label: 'Vulnerability Mgmt', icon: '🛡️', desc: 'Dependabot alerts remediated promptly' },
              { label: 'Risk Management',  icon: '⚠️', desc: 'No unresolved critical or high risks' },
            ].map(({ label, icon, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                <span className="text-xl">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center space-y-4">
          <a
            href={`mailto:security@${tc.companyName.toLowerCase().replace(/\s+/g, '')}.com?subject=Security%20Inquiry`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: brand }}
          >
            Request Full Security Report
            <ExternalLink className="w-4 h-4" />
          </a>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <p>
            This page is maintained by <strong className="text-gray-600">{tc.companyName}</strong>.
            It reflects our current compliance posture, not a formal certification.
          </p>
          <span className="flex items-center gap-1 text-xs">
            Powered by
            <span className="font-medium text-gray-500 ml-1">AI Compliance Copilot</span>
            <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function TrustCenterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Shield className="w-8 h-8 text-brand-600 animate-pulse" />
          <p className="text-sm text-gray-500">Loading trust center…</p>
        </div>
      </div>
    }>
      <TrustCenterContent />
    </Suspense>
  );
}
