'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { Control } from '@/lib/api/frameworks';

// A.5=red, A.6=orange, A.7=yellow, A.8=indigo
export function getCategoryColor(category: string): {
  bg: string;
  text: string;
  dot: string;
} {
  if (category.startsWith('A.5'))
    return { bg: 'bg-red-100',    text: 'text-red-800',    dot: 'bg-red-400'    };
  if (category.startsWith('A.6'))
    return { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-400' };
  if (category.startsWith('A.7'))
    return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400' };
  // A.8 + fallback
  return   { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-400' };
}

interface Props {
  controls: Control[];
  groupedCategories: { category: string; controls: Control[] }[];
}

export default function ControlSearch({ controls, groupedCategories }: Props) {
  const [query, setQuery] = useState('');
  const [, startTransition] = useTransition();
  const [filtered, setFiltered] = useState<Control[] | null>(null);

  function handleSearch(value: string) {
    setQuery(value);
    startTransition(() => {
      if (!value.trim()) {
        setFiltered(null);
        return;
      }
      const q = value.toLowerCase();
      setFiltered(
        controls.filter(
          (c) =>
            c.code.toLowerCase().includes(q) ||
            c.title.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.category.toLowerCase().includes(q),
        ),
      );
    });
  }

  const isSearching = filtered !== null;

  return (
    <div>
      {/* Search box */}
      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search controls by code, title, or description…"
          className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results */}
      {isSearching ? (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            {filtered!.length} result{filtered!.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;
          </p>
          {filtered!.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No controls matched your search.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered!.map((c) => (
                <ControlCard key={c.id} control={c} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-10">
          {groupedCategories.map(({ category, controls: cats }) => {
            const color = getCategoryColor(category);
            return (
              <section key={category} id={`cat-${category.replace(/[\s.]+/g, '-')}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
                  <h2 className="text-base font-semibold text-gray-900">{category}</h2>
                  <span className="text-xs text-gray-400 font-medium">
                    {cats.length} control{cats.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {cats.map((c) => (
                    <ControlCard key={c.id} control={c} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControlCard({ control }: { control: Control }) {
  const color = getCategoryColor(control.category);
  return (
    <Link
      href={`/frameworks/iso27001/controls/${encodeURIComponent(control.code)}`}
      className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-2 group"
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-xs px-2 py-0.5 rounded ${color.bg} ${color.text} font-semibold`}
        >
          {control.code}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-brand-600 transition-colors leading-snug">
        {control.title}
      </p>
      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
        {control.description}
      </p>
    </Link>
  );
}
