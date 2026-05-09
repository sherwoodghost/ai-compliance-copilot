'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth.store';
import { Shield, Building2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoMode, setSsoMode]   = useState(false);
  const [orgSlug, setOrgSlug]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(form.email, form.password);
      setUser(res.user);
      // Route to onboarding if not yet complete, otherwise straight to overview
      router.push(res.user.onboardingComplete === false ? '/onboarding' : '/overview');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

  function handleSsoRedirect(e: React.FormEvent) {
    e.preventDefault();
    const slug = orgSlug.trim().toLowerCase();
    if (!slug) return;
    // Redirect to backend SSO initiation endpoint → backend redirects to IdP
    window.location.href = `${apiBase}/auth/sso/${encodeURIComponent(slug)}`;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-600 rounded-xl mb-4">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your compliance workspace</p>
        </div>

        <div className="card p-8">
          {!ssoMode ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
                    {error}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    autoComplete="email"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                    <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                </div>

                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              {/* SSO divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">OR</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button
                type="button"
                onClick={() => setSsoMode(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <Building2 className="w-4 h-4 text-gray-500" />
                Continue with SSO
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setSsoMode(false); setOrgSlug(''); setError(''); }}
                className="text-xs text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
              >
                ← Back to password login
              </button>

              <form onSubmit={handleSsoRedirect} className="space-y-4">
                <div className="text-center mb-2">
                  <Building2 className="w-8 h-8 text-brand-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-gray-900">Single Sign-On</p>
                  <p className="text-xs text-gray-500 mt-0.5">Enter your organization&apos;s URL slug to continue</p>
                </div>

                <div>
                  <label htmlFor="orgSlug" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Organization slug
                  </label>
                  <div className="flex items-center input px-0 overflow-hidden">
                    <span className="pl-3 pr-1 text-sm text-gray-400 whitespace-nowrap">app.domain.com/</span>
                    <input
                      id="orgSlug"
                      type="text"
                      className="flex-1 border-0 outline-none focus:ring-0 bg-transparent text-sm pr-3 py-0"
                      placeholder="your-company"
                      value={orgSlug}
                      onChange={(e) => setOrgSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/\s+/g, '-')           // spaces → hyphens
                          .replace(/[^a-z0-9-]/g, '')     // strip everything else
                          .replace(/-{2,}/g, '-')          // collapse double hyphens
                      )}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Ask your IT admin for your organization slug if you&apos;re not sure.
                  </p>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={!orgSlug.trim()}
                >
                  Continue with SSO
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/register" className="text-brand-600 font-medium hover:underline">
              Start for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
