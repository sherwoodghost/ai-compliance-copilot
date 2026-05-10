'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gapAnalysisApi, ActionItem } from '@/lib/api/gap-analysis';
import {
  Zap, Target, Wrench, Shield, Clock, ArrowRight,
  ChevronDown, ChevronUp, Filter, Search, Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORY_CONFIG = {
  quick_win: { label: 'Quick Wins', icon: Zap, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', desc: 'Low effort, high impact — do these first' },
  foundation: { label: 'Foundation', icon: Shield, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', desc: 'Critical items that everything else depends on' },
  strategic: { label: 'Strategic', icon: Target, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', desc: 'Medium effort, builds long-term compliance posture' },
  maintenance: { label: 'Maintenance', icon: Wrench, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', desc: 'Keep existing compliance in good shape' },
};

const EFFORT_COLORS = { low: 'text-green-600 bg-green-50', medium: 'text-yellow-600 bg-yellow-50', high: 'text-red-600 bg-red-50' };
const IMPACT_COLORS = { low: 'text-gray-500 bg-gray-50', medium: 'text-blue-600 bg-blue-50', high: 'text-purple-600 bg-purple-50' };

function SummaryCards({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {(['quick_win', 'foundation', 'strategic', 'maintenance'] as const).map((cat) => {
        const config = CATEGORY_CONFIG[cat];
        const Icon = config.icon;
        const count = summary[cat === 'quick_win' ? 'quickWins' : cat];
        return (
          <div key={cat} className={cn('rounded-xl border p-4', config.bg, config.border)}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', config.color)} />
              <span className={cn('text-xs font-semibold uppercase', config.color)}>{config.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{count}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{config.desc}</p>
          </div>
        );
      })}
    </div>
  );
}

function EstimateBar({ summary }: { summary: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Estimated Effort</h3>
          <p className="text-xs text-gray-500">{summary.totalActions} actions to full compliance</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-brand-600">{summary.estimatedTotalHours}h</p>
          <p className="text-xs text-gray-500">~{summary.estimatedWeeksToComplete} weeks</p>
        </div>
      </div>
      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-gray-100">
        {summary.byEffort.map((e: any) => {
          const pct = summary.totalActions > 0 ? (e.count / summary.totalActions) * 100 : 0;
          const color = e.effort === 'low' ? 'bg-green-400' : e.effort === 'medium' ? 'bg-yellow-400' : 'bg-red-400';
          return pct > 0 ? <div key={e.effort} className={cn(color, 'rounded-sm')} style={{ width: `${pct}%` }} /> : null;
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        {summary.byEffort.map((e: any) => (
          <span key={e.effort} className="text-[10px] text-gray-400 capitalize">{e.effort}: {e.count}</span>
        ))}
      </div>
      {summary.byFramework.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">By Framework</p>
          <div className="space-y-1.5">
            {summary.byFramework.map((fw: any) => (
              <div key={fw.framework} className="flex items-center justify-between">
                <span className="text-xs text-gray-700">{fw.framework}</span>
                <span className="text-xs text-gray-500">{fw.actions} actions · {fw.estimatedHours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRow({ action }: { action: ActionItem }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = CATEGORY_CONFIG[action.category];
  const CatIcon = catConfig.icon;

  return (
    <div className="bg-white border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', catConfig.bg)}>
          <CatIcon className={cn('w-3.5 h-3.5', catConfig.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-800 font-medium truncate">{action.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {action.frameworkName && (
              <span className="text-[10px] text-gray-400">{action.frameworkName}</span>
            )}
            {action.controlCode && (
              <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1 py-0.5 rounded">{action.controlCode}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', EFFORT_COLORS[action.effort])}>
            {action.effort} effort
          </span>
          <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded', IMPACT_COLORS[action.impact])}>
            {action.impact} impact
          </span>
          <div className="flex items-center gap-0.5 text-gray-400">
            <Clock className="w-3 h-3" />
            <span className="text-[10px]">{action.estimatedHours}h</span>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-600 mt-2">{action.description}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-gray-400">Priority score: {action.priorityScore}</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded',
              action.status === 'in_progress' ? 'text-yellow-600 bg-yellow-50' : 'text-gray-500 bg-gray-100',
            )}>
              {action.status.replace('_', ' ')}
            </span>
            {action.dueDate && (
              <span className="text-[10px] text-red-500">Due: {new Date(action.dueDate).toLocaleDateString()}</span>
            )}
          </div>
          {action.relatedEntityType && (
            <div className="mt-2">
              <a
                href={`/${action.relatedEntityType === 'control' ? 'controls' : action.relatedEntityType === 'policy' ? 'policies' : action.relatedEntityType === 'evidence' ? 'evidence' : action.relatedEntityType === 'task' ? 'tasks' : 'risks'}`}
                className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700"
              >
                Go to {action.relatedEntityType} <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionPlanPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'prioritized' | 'category'>('prioritized');

  const { data, isLoading } = useQuery({
    queryKey: ['action-plan'],
    queryFn: () => gapAnalysisApi.getActionPlan(),
  });

  const filtered = data?.actions.filter((a) => {
    if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) ||
        (a.controlCode?.toLowerCase().includes(q) ?? false);
    }
    return true;
  }) ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-brand-600" />
          Action Plan
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Smart prioritized list of what to do next to reach compliance fastest
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Generating your action plan...</div>
      ) : !data || data.actions.length === 0 ? (
        <div className="text-center py-12">
          <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-lg font-medium text-gray-700">No actions needed!</p>
          <p className="text-sm text-gray-400">Your compliance posture looks great. Keep it up.</p>
        </div>
      ) : (
        <>
          <SummaryCards summary={data.summary} />
          <EstimateBar summary={data.summary} />

          {/* Compliance lift callout */}
          {data.summary.complianceLiftPercentage > 0 && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-brand-800">
                  Completing all actions could improve your coverage by ~{data.summary.complianceLiftPercentage}%
                </p>
                <p className="text-xs text-brand-600">
                  Start with {data.summary.quickWins} quick wins — they take minimal effort but significantly boost compliance
                </p>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              {['all', 'quick_win', 'foundation', 'strategic', 'maintenance'].map((cat) => {
                const config = cat !== 'all' ? CATEGORY_CONFIG[cat as keyof typeof CATEGORY_CONFIG] : null;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                      categoryFilter === cat
                        ? 'bg-brand-50 border-brand-300 text-brand-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {config ? config.label : 'All'}
                    {cat !== 'all' && data && (
                      <span className="ml-1 opacity-70">
                        ({data.actions.filter((a) => a.category === cat).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setViewMode('prioritized')}
                className={cn('px-2 py-1 text-xs rounded', viewMode === 'prioritized' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
              >
                By Priority
              </button>
              <button
                onClick={() => setViewMode('category')}
                className={cn('px-2 py-1 text-xs rounded', viewMode === 'category' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100')}
              >
                By Category
              </button>
            </div>
          </div>

          {/* Action list */}
          {viewMode === 'prioritized' ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 px-1">{filtered.length} actions, sorted by priority</p>
              {filtered.map((action) => (
                <ActionRow key={action.id} action={action} />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {(['quick_win', 'foundation', 'strategic', 'maintenance'] as const).map((cat) => {
                const catActions = filtered.filter((a) => a.category === cat);
                if (catActions.length === 0) return null;
                const config = CATEGORY_CONFIG[cat];
                const Icon = config.icon;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn('w-4 h-4', config.color)} />
                      <h3 className="text-sm font-semibold text-gray-800">{config.label}</h3>
                      <span className="text-xs text-gray-400">({catActions.length})</span>
                    </div>
                    <div className="space-y-2">
                      {catActions.map((action) => (
                        <ActionRow key={action.id} action={action} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
