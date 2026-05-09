'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { useControlDetail } from '@/lib/hooks/useControlDetail';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Derive chip color classes from the control code prefix */
function getChipColors(code: string): string {
  if (/^CC[12]/.test(code)) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (/^CC[345]/.test(code)) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (/^CC[67]/.test(code)) return 'bg-green-100 text-green-800 border-green-200';
  if (/^CC[89]/.test(code)) return 'bg-amber-100 text-amber-800 border-amber-200';
  if (/^A1\./.test(code)) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
  if (/^C\d/.test(code)) return 'bg-rose-100 text-rose-800 border-rose-200';
  if (/^PI\d/.test(code)) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (/^P\d/.test(code)) return 'bg-pink-100 text-pink-800 border-pink-200';
  if (/^A\.5/.test(code)) return 'bg-red-100 text-red-800 border-red-200';
  if (/^A\.6/.test(code)) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (/^A\.7/.test(code)) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (/^A\.8/.test(code)) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

/** Derive the framework from the code prefix */
function getFramework(code: string): { name: string; slug: string } {
  if (/^A\./.test(code)) return { name: 'ISO 27001', slug: 'iso27001' };
  return { name: 'SOC 2', slug: 'soc2' };
}

/** Build the detail page URL for a control code */
function getDetailUrl(code: string): string {
  const { slug } = getFramework(code);
  return `/frameworks/${slug}/controls/${encodeURIComponent(code)}`;
}

// ─── Popover Portal ──────────────────────────────────────────────────────────

interface PopoverPosition {
  top: number;
  left: number;
  transformOrigin: string;
}

function calcPosition(anchorRect: DOMRect): PopoverPosition {
  const POPOVER_WIDTH = 384; // max-w-sm ≈ 384px
  const POPOVER_HEIGHT = 400; // estimate
  const GAP = 8;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = anchorRect.bottom + GAP + window.scrollY;
  let left = anchorRect.left + window.scrollX;
  let transformOrigin = 'top left';

  // Flip left if overflows right edge
  if (left + POPOVER_WIDTH > viewportWidth + window.scrollX) {
    left = anchorRect.right + window.scrollX - POPOVER_WIDTH;
    transformOrigin = 'top right';
  }

  // Flip above if overflows bottom edge
  if (anchorRect.bottom + POPOVER_HEIGHT + GAP > viewportHeight) {
    top = anchorRect.top + window.scrollY - POPOVER_HEIGHT - GAP;
    transformOrigin = transformOrigin.replace('top', 'bottom');
  }

  return { top, left, transformOrigin };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SkeletonLine({ w }: { w: string }) {
  return <div className={`h-3 bg-gray-200 rounded animate-pulse ${w}`} />;
}

interface PopoverContentProps {
  code: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

function PopoverContent({ code, anchorRect, onClose }: PopoverContentProps) {
  const { data, isLoading, error } = useControlDetail(code);
  const pos = calcPosition(anchorRect);
  const { name: frameworkName, slug: frameworkSlug } = getFramework(code);
  const chipColors = getChipColors(code);

  const detailUrl = getDetailUrl(code);

  // Collect related controls from both crosswalk directions
  const related: Array<{ code: string; title: string }> = [];
  if (data) {
    for (const cs of data.crosswalkSources ?? []) {
      if (related.length >= 4) break;
      related.push(cs.targetControl);
    }
    for (const ct of data.crosswalkTargets ?? []) {
      if (related.length >= 4) break;
      related.push(ct.sourceControl);
    }
  }

  return createPortal(
    <>
      {/* Backdrop — invisible, closes on outside click */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-label={`Control details for ${code}`}
        style={{
          position: 'absolute',
          top: pos.top,
          left: pos.left,
          transformOrigin: pos.transformOrigin,
          zIndex: 50,
          width: '100%',
          maxWidth: '24rem',
        }}
        className="bg-white rounded-lg border border-gray-200 shadow-xl p-4 text-sm"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 p-1 rounded"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {error ? (
          <div className="text-gray-500 py-2">
            Could not load details for{' '}
            <span className="font-mono font-medium">{code}</span>.
          </div>
        ) : isLoading ? (
          <div className="space-y-3 py-1">
            <div className="flex items-center gap-2">
              <SkeletonLine w="w-16" />
              <SkeletonLine w="w-20" />
            </div>
            <SkeletonLine w="w-3/4" />
            <SkeletonLine w="w-full" />
            <SkeletonLine w="w-5/6" />
            <SkeletonLine w="w-2/3" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap pr-6">
              <span className={`font-mono font-semibold text-base ${chipColors.split(' ')[1]}`}>
                {code}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                  frameworkSlug === 'iso27001'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-violet-50 text-violet-700 border-violet-200'
                }`}
              >
                {frameworkName}
              </span>
            </div>

            {/* Title */}
            <p className="font-medium text-gray-900 leading-snug">{data.title}</p>

            {/* Category badge */}
            {data.category && (
              <span className="inline-block text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                {data.category}
              </span>
            )}

            {/* Description excerpt */}
            {data.description && (
              <p className="text-gray-600 text-xs leading-relaxed line-clamp-3">
                {data.description.length > 200
                  ? data.description.slice(0, 200) + '…'
                  : data.description}
              </p>
            )}

            {/* Evidence requirements */}
            {data.evidenceRequirements && data.evidenceRequirements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Evidence required</p>
                <ul className="space-y-0.5">
                  {data.evidenceRequirements.slice(0, 3).map((ev, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                      <span>
                        {ev.evidenceType}
                        {ev.isMandatory && (
                          <span className="ml-1 text-red-500 font-medium">*</span>
                        )}
                      </span>
                    </li>
                  ))}
                  {data.evidenceRequirements.length > 3 && (
                    <li className="text-xs text-gray-400 pl-3">
                      +{data.evidenceRequirements.length - 3} more
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Related controls */}
            {related.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-1">Related controls</p>
                <div className="flex flex-wrap gap-1">
                  {related.map((r) => (
                    <a
                      key={r.code}
                      href={getDetailUrl(r.code)}
                      className={`font-mono text-xs px-1.5 py-0.5 rounded-full border font-medium hover:opacity-80 transition-opacity ${getChipColors(r.code)}`}
                      title={r.title}
                    >
                      {r.code}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Footer link */}
            <div className="pt-1 border-t border-gray-100">
              <a
                href={detailUrl}
                className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                View full details
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface ControlChipProps {
  code: string;
  /** Optional pre-known title — avoids fetching just for the chip label */
  title?: string;
}

export default function ControlChip({ code, title: _title }: ControlChipProps) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const chipRef = useRef<HTMLSpanElement>(null);
  const chipColors = getChipColors(code);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open && chipRef.current) {
      setAnchorRect(chipRef.current.getBoundingClientRect());
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      <span
        ref={chipRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        className={`inline-flex items-center font-mono text-xs px-2 py-0.5 rounded-full border cursor-pointer font-medium select-none hover:opacity-80 transition-opacity ${chipColors}`}
      >
        {code}
      </span>

      {open && anchorRect && (
        <PopoverContent
          code={code}
          anchorRect={anchorRect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
