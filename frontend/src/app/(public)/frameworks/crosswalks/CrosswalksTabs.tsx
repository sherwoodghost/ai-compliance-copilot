'use client';

import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import CrosswalkTable from './CrosswalkTable';
import type { CrosswalkMapping } from '@/lib/api/frameworks';

interface FrameworkPair {
  id:           string;
  label:        string;
  sourceLabel:  string;
  targetLabel:  string;
  mappings:     CrosswalkMapping[];
  sourceColor:  string;
  targetColor:  string;
}

interface Props {
  pairs: FrameworkPair[];
}

export default function CrosswalksTabs({ pairs }: Props) {
  const [active, setActive] = useState(pairs[0]?.id ?? '');

  const activePair = pairs.find((p) => p.id === active) ?? pairs[0];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap mb-8">
        {pairs.map((pair) => (
          <button
            key={pair.id}
            onClick={() => setActive(pair.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === pair.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <GitMerge className="w-3.5 h-3.5 shrink-0" />
            {pair.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              active === pair.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {pair.mappings.length}
            </span>
          </button>
        ))}
      </div>

      {/* Active table */}
      {activePair && (
        <>
          {/* Pair summary */}
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${activePair.sourceColor}`}>
              {activePair.sourceLabel}
            </span>
            <GitMerge className="w-4 h-4 text-gray-400" />
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${activePair.targetColor}`}>
              {activePair.targetLabel}
            </span>
            <span className="text-xs text-gray-400 ml-1">
              {activePair.mappings.length} mappings ·{' '}
              {activePair.mappings.filter((m) => m.confidence === 'high').length} high confidence
            </span>
          </div>

          {activePair.mappings.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-sm">
              <GitMerge className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                Unable to load crosswalk mappings. Make sure the backend API is running.
              </p>
            </div>
          ) : (
            <CrosswalkTable
              mappings={activePair.mappings}
              sourceLabel={activePair.sourceLabel}
              targetLabel={activePair.targetLabel}
            />
          )}
        </>
      )}
    </div>
  );
}
