'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient as api } from '@/lib/api/client';
import { Library, Search, Shield, CheckCircle, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Control = {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  weight: number;
  framework: { name: string; type: string };
  libraryMeta?: { domain?: { name: string; code: string } };
  evidenceRequirements: Array<{ evidenceType: string; description: string; isMandatory: boolean }>;
  policyRequirements: Array<{ policyName: string; description: string }>;
};

function ControlRow({ control, expanded, onToggle }: {
  control: Control;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left transition-colors"
        onClick={onToggle}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded shrink-0">
          {control.code}
        </span>
        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{control.title}</span>
        <span className="text-xs text-gray-400 shrink-0">{control.framework.type}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-4 pt-2 bg-gray-50 border-t border-gray-100 space-y-3">
          <p className="text-sm text-gray-700">{control.description}</p>

          {control.evidenceRequirements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Evidence Required</p>
              <div className="space-y-1">
                {control.evidenceRequirements.map((er, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    {er.isMandatory
                      ? <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      : <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />}
                    <span><span className="font-medium">{er.evidenceType}</span>: {er.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {control.policyRequirements.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Policies Required</p>
              <div className="space-y-1">
                {control.policyRequirements.map((pr, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    <span className="font-medium">{pr.policyName}</span>
                    {pr.description && <span className="text-gray-400"> — {pr.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ControlLibraryPage() {
  const [search, setSearch] = useState('');
  const [filterFramework, setFilterFramework] = useState<'all' | 'SOC2' | 'ISO27001'>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: controls = [], isLoading } = useQuery<Control[]>({
    queryKey: ['control-library'],
    queryFn: () => api.get('/controls/library').then((r: any) => r.data),
  });

  const filtered = controls.filter((c) => {
    const matchesFramework = filterFramework === 'all' || c.framework.type === filterFramework;
    const matchesSearch = !search ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase());
    return matchesFramework && matchesSearch;
  });

  const soc2Count = controls.filter((c) => c.framework.type === 'SOC2').length;
  const isoCount = controls.filter((c) => c.framework.type === 'ISO27001').length;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-100 flex items-center justify-center">
            <Library className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Control Library</h1>
            <p className="text-sm text-gray-500">Canonical source of truth — {controls.length} controls</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">SOC 2: {soc2Count}</span>
          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">ISO 27001: {isoCount}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Search by code, title, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'SOC2', 'ISO27001'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterFramework(f)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                filterFramework === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {search && (
        <p className="text-xs text-gray-500">{filtered.length} of {controls.length} controls match "{search}"</p>
      )}

      {/* Control list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((control) => (
            <ControlRow
              key={control.id}
              control={control}
              expanded={expanded.has(control.id)}
              onToggle={() => toggleExpanded(control.id)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Library className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No controls found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
