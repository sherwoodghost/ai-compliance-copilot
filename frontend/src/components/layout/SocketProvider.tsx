'use client';

import { useComplianceSocket } from '@/lib/hooks/useSocket';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useComplianceSocket();
  return <>{children}</>;
}
