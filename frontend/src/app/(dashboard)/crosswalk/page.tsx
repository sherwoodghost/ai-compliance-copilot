'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, CrosswalkEntry, CrosswalkSummary } from '@/lib/api/gap-analysis';
import {
  GitMerge, ArrowLeftRight, CheckCircle2, Circle, Search, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function MappingBadge({ type }: { type: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    equivalent: { bg: 'bg-green-100', text: 'text-green-700' },
    partial: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    related: { bg: 'bg-blue-100', text: 'text-blue-700' },
  };
  const c = config[type] ?? config.related;
  return <span className={cn('px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase', c.bg, c.text)}>{type}</span>;
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'implemented' ? 'text-green-500' : status === 'in_progress' ? 'text-yellow-500' : 'text-gray-300';
  const Icon = status === 'implemented' ? CheckCircle2 : Circle;
  return <Icon className={cn('w-3.5 h-3.5', color)} />;
}

function SummaryCard({ summary }: { summary: CrosswalkSummary }) {
  const sharedColor = summary.sharedEffortPercentage >= 60 ? 'text-green-600' : summary.sharedEffortPercentage >= 30 ? 'text-yellow-600' : 'text-gray-600';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <ArrowLeftRight className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-gray-800">{summary.frameworkPair}</h3>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          <p className="text-xs text-gray-500">mapped controls</p>
        </div>
        <div>
          <p className={cn('text-2xl font-bold', sharedColor)}>{summary.sharedEffortPercentage}%</p>
          <p className="text-xs text-gray-500">shared effort</p>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 bg-green-50 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-green-700">{summary.equivalent}</p>
          <p className="text-[10px] text-green-600">Equivalent</p>
        </div>
        <div className="flex-1 bg-yellow-50 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-yellow-700">{summary.partial}</p>
          <p className="text-[10px] text-yellow-600">Partial</p>
        </div>
        <div className="flex-1 bg-blue-50 rounded-lg p-2 text-center">
          <p className="text-sm font-bold text-blue-700">{summary.related}</p>
          <p className="text-[10px] text-blue-600">Related</p>
        </div>
      </div>
      {summary.bothImplemented > 0 && (
        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {summary.bothImplemented} mappings fully implemented on both sides
        </p>
      )}
    </div>
  );
}

function CrosswalkRow({ entry }: { entry: CrosswalkEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        {/* Source control */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={entry.sourceControl.status} />
            <span className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{entry.sourceControl.code}</span>
            <span className="text-sm text-gray-800 truncate">{entry.sourceControl.title}</span>
          </div>
          <span className="text-[10px] text-gray-400 ml-6">{entry.sourceControl.framework}</span>
        </div>

        {/* Mapping type */}
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0 px-2">
          <ArrowLeftRight className="w-3.5 h-3.5 text-gray-300" />
          <MappingBadge type={entry.mappingType} />
        </div>

        {/* Target control */}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-sm text-gray-800 truncate">{entry.targetControl.title}</span>
            <span className="text-xs font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">{entry.targetControl.code}</span>
            <StatusDot status={entry.targetControl.status} />
          </div>
          <span className="text-[10px] text-gray-400 mr-6">{entry.targetControl.framework}</span>
        </div>
      </button>

      {expanded && entry.rationale && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-600 mt-2">
            <span className="font-medium">Rationale:</span> {entry.rationale}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-gray-400">Confidence: {entry.confidence}</span>
            {entry.automatable && (
              <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">Automatable</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CrosswalkPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['crosswalk'],
    queryFn: () => gapAnalysisApi.getCrosswalk(),
  });

  const filteredCrosswalks = data?.crosswalks.filter((cw) => {
    if (typeFilter !== 'all' && cw.mappingType !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return cw.sourceControl.code.toLowerCase().includes(q) ||
        cw.sourceControl.title.toLowerCase().includes(q) ||
        cw.targetControl.code.toLowerCase().includes(q) ||
        cw.targetControl.title.toLowerCase().includes(q);
    }
    return true;
  }) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GitMerge className="w-6 h-6 text-brand-600" />
          Framework Crosswalk
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          See how controls map across frameworks to maximize shared compliance effort
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading framework crosswalk data...</div>
      ) : !data || data.crosswalks.length === 0 ? (
        <div className="text-center py-12">
          <GitMerge className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No crosswalk mappings available</p>
          <p className="text-sm text-gray-400">
            Crosswalk data is generated when you have multiple frameworks with mapped controls.
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          {data.summary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.summary.map((s) => (
                <SummaryCard key={s.frameworkPair} summary={s} />
              ))}
            </div>
          )}

          {/* Explanation banner */}
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 text-sm text-brand-800">
            <p className="font-medium mb-1">How crosswalk saves effort</p>
            <p className="text-brand-600 text-xs">
              <strong>Equivalent</strong> controls can share the same evidence, policies, and implementation.
              <strong> Partial</strong> overlaps share some requirements.
              <strong> Related</strong> controls address similar concerns but may need separate evidence.
              Implementing a control in one framework often counts toward the other.
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search controls..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              {['all', 'equivalent', 'partial', 'related'].map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                    typeFilter === type
                      ? 'bg-brand-50 border-brand-300 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                  {type !== 'all' && data && (
                    <span className="ml-1 opacity-70">
                      ({data.crosswalks.filter((cw) => cw.mappingType === type).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Crosswalk list */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 px-1">
              {filteredCrosswalks.length} mappings
            </div>
            {filteredCrosswalks.map((cw) => (
              <CrosswalkRow key={cw.id} entry={cw} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
