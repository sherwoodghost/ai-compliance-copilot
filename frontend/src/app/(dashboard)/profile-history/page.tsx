'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journeyApi } from '@/lib/api/journey';
import { formatDate } from '@/lib/utils';
import { History, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

function DiffView({ diff }: { diff: Record<string, { from: unknown; to: unknown }> }) {
  const entries = Object.entries(diff);
  if (entries.length === 0) return <p className="text-xs text-gray-400 italic">No field-level diff recorded.</p>;

  return (
    <div className="space-y-2">
      {entries.map(([field, { from, to }]) => (
        <div key={field} className="text-xs">
          <span className="font-mono text-gray-500">{field}</span>
          <div className="mt-0.5 space-y-0.5">
            <div className="bg-danger-50 text-danger-700 px-2 py-0.5 rounded font-mono line-through">
              {JSON.stringify(from)}
            </div>
            <div className="bg-success-50 text-success-700 px-2 py-0.5 rounded font-mono">
              {JSON.stringify(to)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionCard({ version, onRollback }: { version: any; onRollback: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const diff = (version.diff ?? {}) as Record<string, any>;
  const hasDiff = Object.keys(diff).length > 0;

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
              v{version.version}
            </span>
            <span className="text-sm font-medium text-gray-900">
              {version.changeReason ?? 'Profile update'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(version.createdAt)} · {version.changedBy?.fullName ?? 'System'}
            {hasDiff && ` · ${Object.keys(diff).length} field${Object.keys(diff).length > 1 ? 's' : ''} changed`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasDiff && (
            <button
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          <button
            className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
            onClick={onRollback}
          >
            <RotateCcw className="w-3 h-3" /> Restore
          </button>
        </div>
      </div>

      {expanded && hasDiff && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <DiffView diff={diff} />
        </div>
      )}
    </div>
  );
}

export default function ProfileHistoryPage() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['profile-versions'],
    queryFn: journeyApi.getProfileVersions,
  });

  const rollback = useMutation({
    mutationFn: (version: number) =>
      fetch(`/api/onboarding/profile/rollback/${version}`, { method: 'POST' }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile-versions'] });
      setConfirming(null);
    },
  });

  const versions: any[] = data ?? [];

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1>Profile History</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every change to your business profile is versioned and can be restored.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : versions.length === 0 ? (
        <div className="card p-12 text-center">
          <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No version history yet.</p>
          <p className="text-xs text-gray-400 mt-1">Changes to the business profile will be tracked here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {versions.map((v, i) => (
            <div key={v.id}>
              {i === 0 && (
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Current</p>
              )}
              {i === 1 && (
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2 mt-4">Previous versions</p>
              )}
              <VersionCard
                version={v}
                onRollback={() => setConfirming(v.version)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Rollback confirmation */}
      {confirming !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm card p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">Restore v{confirming}?</h2>
            <p className="text-sm text-gray-500 mb-5">
              The current profile will be saved as a new version before restoring. This cannot be undone without another restore.
            </p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setConfirming(null)}>Cancel</button>
              <button
                className="btn-primary flex-1"
                onClick={() => rollback.mutate(confirming)}
                disabled={rollback.isPending}
              >
                {rollback.isPending ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
