'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This route has been retired. Redirect customers to the overview.
export default function LlmGatewayRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/overview'); }, [router]);
  return null;
}
