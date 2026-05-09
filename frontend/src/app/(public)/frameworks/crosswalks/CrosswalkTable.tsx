'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Filter } from 'lucide-react';
import type { CrosswalkMapping } from '@/lib/api/frameworks';

type Confidence = 'all' | 'high' | 'medium' | 'low';

function categoryColor(code: string): { bg: string; text: string } {
  if (code.startsWith('CC1') || code.startsWith('CC2'))
    return { bg: 'bg-blue-100',   text: 'text-blue-800'   };
  if (['CC3','CC4','CC5'].some((p) => code.startsWith(p)))
    return { bg: 'bg-purple-100', text: 'text-purple-800' };
  if (['CC6','CC7'].some((p) => code.startsWith(p)))
    return { bg: 'bg-green-100',  text: 'text-green-800'  };
  if (['CC8','CC9'].some((p) => code.startsWith(p)))
    return { bg: 'bg-amber-100',  text: 'text-amber-800'  };
  if (code.startsWith('A1'))
    return { bg: 'bg-cyan-100',   text: 'text-cyan-800'   };
  if (code.startsWith('C1'))
    return { bg: 'bg-rose-100',   text: 'text-rose-800'   };
  if (code.startsWith('PI1'))
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (code.startsWith('P') && !code.startsWith('PI'))
    return { bg: 'bg-pink-100',   text: 'text-pink-800'   };
  if (code.startsWith('A.5'))
    return { bg: 'bg-red-100',    text: 'text-red-800'    };
  if (code.startsWith('A.6'))
    return { bg: 'bg-orange-100', text: 'text-orange-800' };
  if (code.startsWith('A.7'))
    return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
  if (code.startsWith('A.8'))
    return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
  return { bg: 'bg-gray-100', text: 'text-gray-700' };
}

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
};

interface Props {
  mappings: CrosswalkMapping[];
}

export default function CrosswalkTable({ mappings }: Props) {
  const [confidence, setConfidence] = useState<Confidence>('all');

  const filtered = confidence === 'all'
    ? mappings
    : mappings.filter((m) => m.confidence === confidence);

  const counts = {
    all:    mappings.length,
    high:   mappings.filter((m) => m.confidence === 'high').length,
    medium: mappings.filter((m) => m.confidence === 'medium').length,
    low:    mappings.filter((m) => m.confidence === 'low').length,
  };

  const btns: { value: Confidence; label: string }[] = [
    { value: 'all',    label: `All (${counts.all})`       },
    { value: 'high',   label: `High (${counts.high})`     },
    { value: 'medium', label: `Medium (${counts.medium})` },
    { value: 'low',    label: `Low (${counts.low})`       },
  ];

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500 mr-1">Confidence:</span>
        {btns.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setConfidence(value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              confidence === value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No mappings found for this filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    SOC 2 Control
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    ISO 27001 Control
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-36">
                    Mapping Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m, i) => {
                  // Determine which is SOC2 and which is ISO27001
                  const isSoc2Source = m.sourceFramework?.toLowerCase().includes('soc');
                  const soc2Code  = isSoc2Source ? m.sourceCode  : m.targetCode;
                  const soc2Title = isSoc2Source ? m.sourceTitle : m.targetTitle;
                  const isoCode   = isSoc2Source ? m.targetCode  : m.sourceCode;
                  const isoTitle  = isSoc2Source ? m.targetTitle : m.sourceTitle;

                  const soc2Color = categoryColor(soc2Code);
                  const isoColor  = categoryColor(isoCode);
                  const confClass = CONFIDENCE_STYLES[m.confidence] ?? CONFIDENCE_STYLES.low;

                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      {/* SOC 2 */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/frameworks/soc2/controls/${encodeURIComponent(soc2Code)}`}
                          className="group flex items-start gap-2"
                        >
                          <span
                            className={`font-mono text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${soc2Color.bg} ${soc2Color.text}`}
                          >
                            {soc2Code}
                          </span>
                          <span className="text-gray-700 group-hover:text-brand-600 transition-colors leading-snug text-xs">
                            {soc2Title}
                          </span>
                        </Link>
                      </td>

                      {/* ISO 27001 */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/frameworks/iso27001/controls/${encodeURIComponent(isoCode)}`}
                          className="group flex items-start gap-2"
                        >
                          <span
                            className={`font-mono text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${isoColor.bg} ${isoColor.text}`}
                          >
                            {isoCode}
                          </span>
                          <span className="text-gray-700 group-hover:text-brand-600 transition-colors leading-snug text-xs">
                            {isoTitle}
                          </span>
                        </Link>
                      </td>

                      {/* Mapping type */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500 capitalize">
                          {m.mappingType ?? '—'}
                        </span>
                      </td>

                      {/* Confidence */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize ${confClass}`}
                        >
                          {m.confidence}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {mappings.length} mappings
          </div>
        </div>
      )}
    </div>
  );
}
