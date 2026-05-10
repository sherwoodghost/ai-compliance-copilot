'use client';

import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, AuditChecklist, ChecklistItem } from '@/lib/api/gap-analysis';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Circle, Clock, AlertTriangle, Shield,
  ChevronRight, Calendar, Award, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Progress ring ───────────────────────────────────────────────────────

function ProgressRing({ percentage, size = 120 }: { percentage: number; size?: number }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 80 ? '#16a34a' : percentage >= 50 ? '#ca8a04' : '#dc2626';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black" style={{ color }}>{percentage}%</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wider">Complete</span>
      </div>
    </div>
  );
}

// ── Checklist item row ──────────────────────────────────────────────────

function ChecklistRow({ item, onNavigate }: { item: ChecklistItem; onNavigate: (url: string) => void }) {
  const statusConfig = {
    complete: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: 'Done' },
    in_progress: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'In Progress' },
    not_started: { icon: Circle, color: 'text-gray-300', bg: 'bg-gray-50', label: 'Not Started' },
    warning: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Needs Attention' },
  };

  const priorityConfig = {
    critical: { bg: 'bg-red-100', text: 'text-red-700' },
    high: { bg: 'bg-orange-100', text: 'text-orange-700' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    low: { bg: 'bg-blue-100', text: 'text-blue-700' },
  };

  const s = statusConfig[item.status];
  const p = priorityConfig[item.priority];
  const Icon = s.icon;
  const pct = item.required > 0 ? Math.round((item.current / item.required) * 100) : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-xl border transition-all',
        item.status === 'complete' ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white hover:shadow-sm cursor-pointer',
      )}
      onClick={() => item.actionUrl && item.status !== 'complete' && onNavigate(item.actionUrl)}
    >
      <Icon className={cn('w-6 h-6 flex-shrink-0', s.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold', item.status === 'complete' ? 'text-green-800 line-through' : 'text-gray-800')}>
            {item.title}
          </h3>
          <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', p.bg, p.text)}>
            {item.priority}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
        {item.status !== 'complete' && item.required > 1 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[200px]">
              <div
                className={cn('h-full rounded-full transition-all',
                  pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{item.current}/{item.required}</span>
          </div>
        )}
      </div>
      {item.actionUrl && item.status !== 'complete' && (
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      )}
    </div>
  );
}

// ── Category section ────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  controls: { label: 'Controls', icon: Shield },
  evidence: { label: 'Evidence', icon: Target },
  policies: { label: 'Policies', icon: Award },
  risks: { label: 'Risk Management', icon: AlertTriangle },
  tasks: { label: 'Tasks', icon: Clock },
  documents: { label: 'Documents', icon: Award },
  scope: { label: 'Scope & Boundaries', icon: Target },
};

// ── Main page ───────────────────────────────────────────────────────────

export default function AuditChecklistPage() {
  const router = useRouter();

  const { data: checklist, isLoading } = useQuery({
    queryKey: ['audit-checklist'],
    queryFn: () => gapAnalysisApi.getAuditChecklist(),
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-gray-400">
        Loading audit readiness checklist...
      </div>
    );
  }

  if (!checklist) return null;

  // Group items by category
  const grouped = checklist.items.reduce<Record<string, ChecklistItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const gradeColor = checklist.readinessGrade === 'A' ? 'text-green-600'
    : checklist.readinessGrade === 'B' ? 'text-blue-600'
    : checklist.readinessGrade === 'C' ? 'text-yellow-600'
    : 'text-red-600';

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-600" />
          Audit Readiness Checklist
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Your step-by-step guide to becoming audit-ready for {checklist.framework}
        </p>
      </div>

      {/* Summary banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ProgressRing percentage={checklist.completionPercentage} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <span className={cn('text-4xl font-black', gradeColor)}>{checklist.readinessGrade}</span>
              <div>
                <div className="text-lg font-bold text-gray-800">
                  {checklist.completedItems} of {checklist.totalItems} items complete
                </div>
                <div className="text-sm text-gray-500">
                  Readiness Score: {checklist.readinessScore}%
                </div>
              </div>
            </div>
            {checklist.estimatedDaysToReady > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 justify-center sm:justify-start">
                <Calendar className="w-4 h-4" />
                Estimated ~{checklist.estimatedDaysToReady} days to audit-ready
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-red-50 rounded-lg px-4 py-2">
              <div className="text-xl font-bold text-red-600">
                {checklist.items.filter((i) => i.priority === 'critical' && i.status !== 'complete').length}
              </div>
              <div className="text-[10px] text-red-500 uppercase">Critical</div>
            </div>
            <div className="bg-orange-50 rounded-lg px-4 py-2">
              <div className="text-xl font-bold text-orange-600">
                {checklist.items.filter((i) => i.priority === 'high' && i.status !== 'complete').length}
              </div>
              <div className="text-[10px] text-orange-500 uppercase">High</div>
            </div>
            <div className="bg-yellow-50 rounded-lg px-4 py-2">
              <div className="text-xl font-bold text-yellow-600">
                {checklist.items.filter((i) => i.status === 'warning').length}
              </div>
              <div className="text-[10px] text-yellow-500 uppercase">Warnings</div>
            </div>
            <div className="bg-green-50 rounded-lg px-4 py-2">
              <div className="text-xl font-bold text-green-600">
                {checklist.completedItems}
              </div>
              <div className="text-[10px] text-green-500 uppercase">Complete</div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist by category */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => {
          const config = CATEGORY_CONFIG[category] ?? { label: category, icon: Shield };
          const Icon = config.icon;
          const completed = items.filter((i) => i.status === 'complete').length;

          return (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">{config.label}</h2>
                <span className="text-xs text-gray-400">
                  {completed}/{items.length} complete
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    onNavigate={(url) => router.push(url)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
