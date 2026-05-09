'use client';

/**
 * SSO Callback Page
 *
 * The backend redirects here after SAML authentication with either:
 *   ?accessToken=...&refreshToken=...&userId=...&orgId=...  (success)
 *   ?error=...                                               (failure)
 *
 * On success: stores tokens in cookies (js-cookie), redirects to dashboard.
 * On failure: shows error with link back to login.
 *
 * NOTE: Must be wrapped in <Suspense> because useSearchParams() triggers a
 * suspension boundary in Next.js 14 during static rendering.
 */

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth.store';
import { authApi } from '@/lib/api/auth';
import { setTokens } from '@/lib/api/client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

function SsoCallbackContent() {
  const router       = useRouter();
  const params       = useSearchParams();
  const { setUser }  = useAuthStore();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const accessToken  = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const error        = params.get('error');

    if (error) {
      setStatus('error');
      setErrorMsg(decodeURIComponent(error));
      return;
    }

    if (!accessToken || !refreshToken) {
      setStatus('error');
      setErrorMsg('Missing authentication tokens. Please try again.');
      return;
    }

    // Store tokens in cookies (same as regular login — uses js-cookie + secure flags)
    setTokens(accessToken, refreshToken);

    // Fetch user profile then redirect
    authApi.me()
      .then((user) => {
        setUser(user);
        setStatus('success');
        setTimeout(() => router.replace('/'), 1200);
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Failed to load user profile. Please try again.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card p-10 max-w-sm w-full text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-brand-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-600 font-medium">Completing sign-in…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-800">Signed in successfully!</p>
            <p className="text-xs text-gray-500">Redirecting to your dashboard…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-red-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-800">Sign-in failed</p>
            <p className="text-xs text-gray-500">{errorMsg}</p>
            <a
              href="/login"
              className="inline-block mt-2 text-sm text-brand-600 hover:underline font-medium"
            >
              ← Back to login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function SsoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      }
    >
      <SsoCallbackContent />
    </Suspense>
  );
}
