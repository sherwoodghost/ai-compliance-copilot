'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WidgetShellProps {
  title:       string;
  /** Tailwind color token — e.g. 'violet', 'teal', 'emerald' */
  color:       string;
  linkHref?:   string;
  linkLabel?:  string;
  isLoading?:  boolean;
  children:    React.ReactNode;
  className?:  string;
}

const COLOR_MAP: Record<string, { header: string; link: string; dot: string }> = {
  violet:  { header: 'border-violet-200  bg-violet-50',  link: 'text-violet-600 hover:text-violet-800',  dot: 'bg-violet-400'  },
  teal:    { header: 'border-teal-200    bg-teal-50',    link: 'text-teal-600   hover:text-teal-800',    dot: 'bg-teal-400'    },
  emerald: { header: 'border-emerald-200 bg-emerald-50', link: 'text-emerald-600 hover:text-emerald-800', dot: 'bg-emerald-400' },
  indigo:  { header: 'border-indigo-200  bg-indigo-50',  link: 'text-indigo-600 hover:text-indigo-800',  dot: 'bg-indigo-400'  },
  blue:    { header: 'border-blue-200    bg-blue-50',    link: 'text-blue-600   hover:text-blue-800',    dot: 'bg-blue-400'    },
  amber:   { header: 'border-amber-200   bg-amber-50',   link: 'text-amber-600  hover:text-amber-800',   dot: 'bg-amber-400'   },
  red:     { header: 'border-red-200     bg-red-50',     link: 'text-red-600    hover:text-red-800',     dot: 'bg-red-400'     },
  orange:  { header: 'border-orange-200  bg-orange-50',  link: 'text-orange-600 hover:text-orange-800',  dot: 'bg-orange-400'  },
};

export function WidgetShell({
  title, color, linkHref, linkLabel = 'View all', isLoading, children, className,
}: WidgetShellProps) {
  const c = COLOR_MAP[color] ?? COLOR_MAP['blue'];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className={cn('flex items-center justify-between px-4 py-3 border-b', c.header)}>
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', c.dot)} />
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
        {linkHref && (
          <Link
            href={linkHref}
            className={cn('inline-flex items-center gap-1 text-xs font-medium transition-colors', c.link)}
          >
            {linkLabel}
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : children}
      </div>
    </div>
  );
}
