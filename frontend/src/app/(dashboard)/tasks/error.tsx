'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function TasksError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Tasks page error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-red-400" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 mb-1">Couldn&apos;t load tasks</h2>
      <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
        Something went wrong while loading the tasks page. This is usually a temporary issue.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-brand-600 text-white
                   hover:bg-brand-700 transition-colors font-medium"
      >
        <RefreshCw className="w-4 h-4" />
        Try again
      </button>
    </div>
  );
}
