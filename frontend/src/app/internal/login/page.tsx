'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Cookies from 'js-cookie';
import { Shield, Eye, EyeOff, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function InternalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (step === 'credentials') {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/internal/auth/login`,
          { email, password },
        );
        if (res.data.requiresMfa) {
          setStep('mfa');
        } else if (res.data.token) {
          Cookies.set('internal_token', res.data.token, { expires: 1 / 24 });
          router.push('/internal');
        }
      } else {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/internal/auth/mfa`,
          { email, code: mfaCode },
        );
        if (res.data.token) {
          Cookies.set('internal_token', res.data.token, { expires: 1 / 24 });
          router.push('/internal');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold text-white">Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">Internal access only</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          {step === 'credentials' ? (
            <>
              <h2 className="text-sm font-semibold text-white mb-5">Sign in to continue</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="admin@internal.io"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5
                               text-sm text-white placeholder-gray-600 focus:outline-none
                               focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5
                                 text-sm text-white placeholder-gray-600 focus:outline-none
                                 focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                    loading
                      ? 'bg-indigo-700 cursor-not-allowed text-indigo-300'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white',
                  )}
                >
                  {loading ? 'Signing in…' : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-white mb-1">Two-factor authentication</h2>
              <p className="text-xs text-gray-500 mb-5">Enter the 6-digit code from your authenticator app.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Authentication Code</label>
                  <input
                    type="text"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    maxLength={6}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5
                               text-sm text-white placeholder-gray-600 focus:outline-none
                               focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                               tracking-widest text-center text-lg font-mono"
                  />
                </div>

                {error && (
                  <div className="bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className={cn(
                    'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors',
                    loading || mfaCode.length !== 6
                      ? 'bg-indigo-700/50 cursor-not-allowed text-indigo-400'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white',
                  )}
                >
                  {loading ? 'Verifying…' : 'Verify'}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('credentials'); setMfaCode(''); setError(''); }}
                  className="w-full text-xs text-gray-500 hover:text-gray-400"
                >
                  ← Back to credentials
                </button>
              </form>
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6">
          <Terminal className="w-3.5 h-3.5 text-gray-700" />
          <p className="text-xs text-gray-700">Restricted access · All sessions logged</p>
        </div>
      </div>
    </div>
  );
}
