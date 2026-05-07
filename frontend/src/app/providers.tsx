'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth.store';
import { apiClient } from '@/lib/api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

function AuthInitializer() {
  const { setUser, clearUser } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Skip customer auth check on internal admin pages — they use their own token
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/internal')) return;

    apiClient.get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => clearUser());
  }, [setUser, clearUser]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      {children}
    </QueryClientProvider>
  );
}
