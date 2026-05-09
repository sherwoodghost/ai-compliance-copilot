'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface Measurement {
  value: number;
  measuredAt: string;
  note?: string;
}

interface QualityObjective {
  id: string;
  metric: string;
  target: number;
  unit: string;
  targetDirection: string; // above | below | equal
  currentValue?: number;
  measurementFrequency: string;
  measurements: Measurement[];
  createdAt: string;
}

function getStatus(obj: QualityObjective): 'on-track' | 'at-risk' | 'no-data' {
  if (obj.currentValue === null || obj.currentValue === undefined) return 'no-data';
  if (obj.targetDirection === 'above') return obj.currentValue >= obj.target ? 'on-track' : 'at-risk';
  if (obj.targetDirection === 'below') return obj.currentValue <= obj.target ? 'on-track' : 'at-risk';
  return Math.abs(obj.currentValue - obj.target) < 0.01 ? 'on-track' : 'at-risk';
}

const STATUS_CONFIG = {
  'on-track': { label: 'On Track', color: 'text-green-600', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
  'at-risk':  { label: 'At Risk',  color: 'text-red-600',   bg: 'bg-red-50 border-red-200',   badge: 'bg-red-100 text-red-700' },
  'no-data':  { label: 'No Data',  color: 'text-gray-400',  bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-600' },
};

function getProgressPct(obj: QualityObjective): number {
  if (obj.currentValue === null || obj.currentValue === undefined) return 0;
  if (obj.targetDirection === 'below') {
    if (obj.target === 0) return obj.currentValue <= 0 ? 100 : 0;
    return Math.min(100, Math.max(0, Math.round((1 - obj.currentValue / obj.target) * 100)));
  }
  if (obj.target === 0) return 100;
  return Math.min(100, Math.max(0, Math.round((obj.currentValue / obj.target) * 100)));
}

export default function QualityObjectivesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [measureTarget, setMeasureTarget] = useState<QualityObjective | null>(null);
  const [measureValue, setMeasureValue] = useState('');
  const [measureNote, setMeasureNote] = useState('');
  const [form, setForm] = useState({
    metric: '', target: '', unit: '', targetDirection: 'above', measurementFrequency: 'monthly',
  });

  const { data: objectives = [], isLoading } = useQuery<QualityObjective[]>({
    queryKey: ['quality-objectives'],
    queryFn: () => apiClient.get('/quality/objectives').then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (dto: any) => apiClient.post('/quality/objectives', dto).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality-objectives'] });
      setShowForm(false);
      setForm({ metric: '', target: '', unit: '', targetDirection: 'above', measurementFrequency: 'monthly' });
    },
  });

  const measureMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.post(`/quality/objectives/${id}/measurements`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quality-objectives'] });
      setMeasureTarget(null);
      setMeasureValue('');
      setMeasureNote('');
    },
  });

  const onTrack = objectives.filter(o => getStatus(o) === 'on-track').length;
  const atRisk  = objectives.filter(o => getStatus(o) === 'at-risk').length;
  const noData  = objectives.filter(o => getStatus(o) === 'no-data').length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <Target className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quality Objectives</h1>
            <p className="text-sm text-gray-500 mt-0.5">ISO 9001 Clause 6.2 — Measurable objectives with current vs. target tracking</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Objective
        </button>
      </div>

      {atRisk > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {atRisk} objective{atRisk !== 1 ? 's' : ''} not meeting target — review and take corrective action
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-2xl font-bold text-gray-900">{objectives.length}</div>
          <div className="text-sm text-gray-500">Total Objectives</div>
        </div>
        <div className={`border rounded-xl p-4 ${onTrack > 0 ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${onTrack > 0 ? 'text-green-600' : 'text-gray-900'}`}>{onTrack}</div>
          <div className={`text-sm ${onTrack > 0 ? 'text-green-500' : 'text-gray-500'}`}>On Track</div>
        </div>
        <div className={`border rounded-xl p-4 ${atRisk > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <div className={`text-2xl font-bold ${atRisk > 0 ? 'text-red-600' : 'text-gray-900'}`}>{atRisk}</div>
          <div className={`text-sm ${atRisk > 0 ? 'text-red-500' : 'text-gray-500'}`}>At Risk</div>
        </div>
      </div>

      {/* Create Objective Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Add Quality Objective</h2>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                createMutation.mutate({ ...form, target: parseFloat(form.target) });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Metric *</label>
                <input
                  required
                  value={form.metric}
                  onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                  placeholder="e.g. Customer satisfaction, Defect rate, On-time delivery"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Value *</label>
                  <input
                    required
                    type="number"
                    step="any"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    required
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="e.g. %, /5, days, ppm"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Direction *</label>
                  <select
                    required
                    value={form.targetDirection}
                    onChange={e => setForm(f => ({ ...f, targetDirection: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="above">Above or equal (↑)</option>
                    <option value="below">Below or equal (↓)</option>
                    <option value="equal">Equal to (=)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Measurement Frequency</label>
                  <select
                    value={form.measurementFrequency}
                    onChange={e => setForm(f => ({ ...f, measurementFrequency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['daily', 'weekly', 'monthly', 'quarterly', 'annual'].map(v => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">
                  {createMutation.isPending ? 'Adding…' : 'Add Objective'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Measurement Modal */}
      {measureTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold">Record Measurement</h2>
              <p className="text-sm text-gray-500 mt-0.5">{measureTarget.metric}</p>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                measureMutation.mutate({ id: measureTarget.id, data: { value: parseFloat(measureValue), note: measureNote || undefined } });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Value ({measureTarget.unit}) *
                </label>
                <input
                  required
                  type="number"
                  step="any"
                  value={measureValue}
                  onChange={e => setMeasureValue(e.target.value)}
                  placeholder={`Target: ${measureTarget.targetDirection === 'above' ? '≥' : measureTarget.targetDirection === 'below' ? '≤' : '='} ${measureTarget.target} ${measureTarget.unit}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <input
                  value={measureNote}
                  onChange={e => setMeasureNote(e.target.value)}
                  placeholder="Context for this measurement..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button" onClick={() => setMeasureTarget(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
                <button type="submit" disabled={measureMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50">
                  {measureMutation.isPending ? 'Recording…' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : objectives.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-gray-200 rounded-2xl">
          <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No quality objectives defined</p>
          <p className="text-sm text-gray-400 mt-1">
            ISO 9001 requires measurable quality objectives — add your first one to begin tracking
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map(obj => {
            const status = getStatus(obj);
            const cfg = STATUS_CONFIG[status];
            const pct = getProgressPct(obj);
            const latest = obj.measurements?.[obj.measurements.length - 1];
            const prev = obj.measurements?.[obj.measurements.length - 2];
            const trend = latest && prev
              ? latest.value > prev.value ? 'up' : latest.value < prev.value ? 'down' : 'flat'
              : null;

            return (
              <div key={obj.id} className={`bg-white border rounded-xl p-5 ${status === 'at-risk' ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-semibold text-gray-900">{obj.metric}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                      <span className="text-xs text-gray-400 capitalize">{obj.measurementFrequency}</span>
                    </div>

                    {/* Current vs Target display */}
                    <div className="flex items-end gap-4 mb-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Current</div>
                        <div className={`text-xl font-bold ${cfg.color}`}>
                          {obj.currentValue !== null && obj.currentValue !== undefined
                            ? `${obj.currentValue} ${obj.unit}`
                            : '—'}
                          {trend === 'up' && <TrendingUp className="inline h-4 w-4 ml-1" />}
                          {trend === 'down' && <TrendingDown className="inline h-4 w-4 ml-1" />}
                          {trend === 'flat' && <Minus className="inline h-4 w-4 ml-1" />}
                        </div>
                      </div>
                      <div className="text-gray-300 text-lg pb-0.5">
                        {obj.targetDirection === 'above' ? '≥' : obj.targetDirection === 'below' ? '≤' : '='}
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Target</div>
                        <div className="text-xl font-bold text-gray-600">{obj.target} {obj.unit}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {status !== 'no-data' && (
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${status === 'on-track' ? 'bg-green-500' : 'bg-red-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}

                    {latest && (
                      <p className="text-xs text-gray-400">
                        Last measured {new Date(latest.measuredAt).toLocaleDateString()}
                        {latest.note && ` · ${latest.note}`}
                        {obj.measurements.length > 1 && ` · ${obj.measurements.length} measurements`}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => { setMeasureTarget(obj); setMeasureValue(''); setMeasureNote(''); }}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-100 hover:bg-teal-200 rounded-lg"
                  >
                    Record
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {noData > 0 && objectives.length > 0 && (
        <p className="text-xs text-gray-400 text-center mt-4">
          {noData} objective{noData !== 1 ? 's' : ''} with no measurements yet — click "Record" to add the first data point
        </p>
      )}
    </div>
  );
}
