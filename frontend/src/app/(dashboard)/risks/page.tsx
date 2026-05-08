'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  risksApi, Risk, RiskTreatment, PortfolioAnalysis as PortfolioResult,
} from '@/lib/api/risks';
import {
  AlertTriangle, Shield, CheckCircle, ChevronDown, ChevronRight,
  ArrowRightLeft, Ban, Zap, Clock, Plus, X, Sparkles, BarChart3, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PolicyEditor } from '@/components/editor/PolicyEditor';

const SEVERITY_CONFIG: Record<string, { label: string; rowCls: string; badge: string; icon: string }> = {
  critical: { label: 'Critical', rowCls: 'border-l-4 border-red-500', badge: 'bg-red-100 text-red-800', icon: 'text-red-500' },
  high:     { label: 'High',     rowCls: 'border-l-4 border-orange-400', badge: 'bg-orange-100 text-orange-800', icon: 'text-orange-400' },
  medium:   { label: 'Medium',   rowCls: 'border-l-4 border-yellow-400', badge: 'bg-yellow-100 text-yellow-800', icon: 'text-yellow-400' },
  low:      { label: 'Low',      rowCls: 'border-l-4 border-gray-300', badge: 'bg-gray-100 text-gray-600', icon: 'text-gray-400' },
};

const TREATMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  mitigate: { label: 'Mitigate', color: 'bg-blue-50 text-blue-700 border-blue-200',  icon: Zap },
  accept:   { label: 'Accept',   color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: CheckCircle },
  transfer: { label: 'Transfer', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: ArrowRightLeft },
  avoid:    { label: 'Avoid',    color: 'bg-gray-50 text-gray-700 border-gray-200',  icon: Ban },
};

// ─── Portfolio Analysis Panel ─────────────────────────────────────────────────

const RATING_CFG: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'bg-red-50',    text: 'text-red-800',    border: 'border-red-200' },
  High:     { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200' },
  Medium:   { bg: 'bg-yellow-50', text: 'text-yellow-800', border: 'border-yellow-200' },
  Low:      { bg: 'bg-green-50',  text: 'text-green-800',  border: 'border-green-200' },
};

function PortfolioPanel({ result, onClose }: { result: PortfolioResult; onClose: () => void }) {
  const rating  = result.overallRiskRating ?? 'High';
  const rCfg    = RATING_CFG[rating] ?? RATING_CFG.High;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-5">
      {/* Panel header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Risk Portfolio Analysis</p>
            <p className="text-xs text-gray-500">
              {result.stats.total} risks · Overall:{' '}
              <span className={cn('font-semibold', rCfg.text)}>{rating}</span>
            </p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Executive Summary */}
      <div className={cn('rounded-xl border p-4', rCfg.bg, rCfg.border)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Executive Summary</p>
        <p className="text-sm text-gray-800 leading-relaxed">{result.executiveSummary}</p>
      </div>

      {/* Two-column: Exposure areas + Systemic patterns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {result.topExposureAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top Exposure Areas</p>
            <div className="space-y-2">
              {result.topExposureAreas.map((ea, i) => (
                <div key={i} className="bg-white rounded-lg border border-gray-200 p-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center shrink-0">{ea.riskCount}</span>
                    <span className="text-xs font-semibold text-gray-800">{ea.area}</span>
                  </div>
                  <p className="text-xs text-gray-500 ml-7">{ea.concern}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-4">
          {result.systemicPatterns.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Systemic Patterns</p>
              <ul className="space-y-1">
                {result.systemicPatterns.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <span className="text-orange-400 mt-0.5 shrink-0">⚠</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.quickWins.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Wins</p>
              <ul className="space-y-1">
                {result.quickWins.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <Zap className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" /> {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Board Recommendations */}
      {result.boardRecommendations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Board Recommendations</p>
          <ol className="space-y-1.5">
            {result.boardRecommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-white rounded-lg border border-gray-100 p-2">
                <span className="w-4 h-4 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result.riskAppetiteAssessment && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-semibold text-blue-800 mb-1">Risk Appetite Assessment</p>
          <p className="text-xs text-blue-700">{result.riskAppetiteAssessment}</p>
        </div>
      )}
    </div>
  );
}

// ─── Add Risk Modal ──────────────────────────────────────────────────────────

const LIKELIHOOD_OPTIONS = [
  { value: 'rare', label: 'Rare', desc: 'Unlikely to occur in most circumstances' },
  { value: 'unlikely', label: 'Unlikely', desc: 'Could occur at some time' },
  { value: 'possible', label: 'Possible', desc: 'Might occur at some time' },
  { value: 'likely', label: 'Likely', desc: 'Will probably occur' },
  { value: 'almost_certain', label: 'Almost Certain', desc: 'Expected to occur' },
];

const IMPACT_OPTIONS = [
  { value: 'negligible', label: 'Negligible', desc: 'Minimal effect' },
  { value: 'minor', label: 'Minor', desc: 'Minor disruption' },
  { value: 'moderate', label: 'Moderate', desc: 'Significant disruption' },
  { value: 'major', label: 'Major', desc: 'Major operational impact' },
  { value: 'catastrophic', label: 'Catastrophic', desc: 'Business-threatening' },
];

const LIKELIHOOD_SCORES: Record<string, number> = {
  rare: 1, unlikely: 2, possible: 3, likely: 4, almost_certain: 5,
};
const IMPACT_SCORES: Record<string, number> = {
  negligible: 1, minor: 2, moderate: 3, major: 4, catastrophic: 5,
};

function deriveScore(l: string, i: string) {
  return (LIKELIHOOD_SCORES[l] ?? 1) * (IMPACT_SCORES[i] ?? 1);
}
function deriveSeverityLabel(score: number) {
  if (score >= 17) return { label: 'Critical', cls: 'bg-red-100 text-red-700' };
  if (score >= 10) return { label: 'High',     cls: 'bg-orange-100 text-orange-700' };
  if (score >= 5)  return { label: 'Medium',   cls: 'bg-yellow-100 text-yellow-700' };
  return                  { label: 'Low',      cls: 'bg-gray-100 text-gray-600' };
}

function RiskModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [likelihood, setLikelihood] = useState('possible');
  const [impact, setImpact] = useState('moderate');
  const [owner, setOwner] = useState('');
  const [mitigationAdvice, setMitigationAdvice] = useState('');

  const score = deriveScore(likelihood, impact);
  const severity = deriveSeverityLabel(score);

  const create = useMutation({
    mutationFn: () =>
      risksApi.create({
        title,
        description: description || undefined,
        likelihood: likelihood as Risk['likelihood'],
        impact: impact as Risk['impact'],
        owner: owner || undefined,
        mitigationAdvice: mitigationAdvice || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risks'] });
      qc.invalidateQueries({ queryKey: ['risk-stats'] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-semibold text-gray-900">Add Risk Item</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Risk Title *</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Privileged access not regularly reviewed"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <PolicyEditor
              content={description}
              onChange={setDescription}
              placeholder="Describe the risk scenario and potential consequences…"
              minHeight={80}
              showWordCount={false}
            />
          </div>

          {/* Likelihood */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Likelihood</label>
            <div className="flex gap-1.5 flex-wrap">
              {LIKELIHOOD_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setLikelihood(o.value)}
                  title={o.desc}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                    likelihood === o.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Impact */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Impact</label>
            <div className="flex gap-1.5 flex-wrap">
              {IMPACT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setImpact(o.value)}
                  title={o.desc}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors',
                    impact === o.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk Score Preview */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-xs text-gray-500">Calculated risk score:</div>
            <div className="text-lg font-bold text-gray-900">{score}</div>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', severity.cls)}>
              {severity.label}
            </span>
            <div className="text-xs text-gray-400 ml-auto">Likelihood × Impact</div>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Risk Owner (optional)</label>
            <input
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Name or role responsible for this risk"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>

          {/* Mitigation Advice */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Initial Mitigation Notes (optional)</label>
            <PolicyEditor
              content={mitigationAdvice}
              onChange={setMitigationAdvice}
              placeholder="Initial thoughts on how to mitigate this risk…"
              minHeight={80}
              showWordCount={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 py-4 border-t border-gray-100">
          <button className="btn-secondary text-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary text-sm"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Adding…' : 'Add Risk'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Treatment Form ───────────────────────────────────────────────────────────

function TreatmentForm({ riskId, onClose }: { riskId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<'mitigate' | 'accept' | 'transfer' | 'avoid'>('mitigate');
  const [description, setDescription] = useState('');
  const [residual, setResidual] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const create = useMutation({
    mutationFn: () => risksApi.addTreatment(riskId, {
      treatmentType: type,
      treatmentDescription: description,
      residualRiskAfter: residual || undefined,
      targetCompletionDate: targetDate || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['risks'] });
      onClose();
    },
  });

  return (
    <div className="mt-3 p-4 bg-white border border-gray-200 rounded-lg space-y-3">
      <p className="text-xs font-semibold text-gray-700">Add Treatment Decision</p>
      <div className="flex gap-2">
        {(['mitigate', 'accept', 'transfer', 'avoid'] as const).map((t) => {
          const cfg = TREATMENT_CONFIG[t];
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors',
                type === t ? cfg.color : 'border-gray-200 text-gray-500 hover:bg-gray-50',
              )}
            >
              <Icon className="w-3 h-3" />
              {cfg.label}
            </button>
          );
        })}
      </div>
      <PolicyEditor
        content={description}
        onChange={setDescription}
        placeholder="Describe the treatment plan, rationale, or acceptance rationale…"
        minHeight={100}
        showWordCount={false}
      />
      <div className="flex gap-3">
        <div className="flex-1">
          <input
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Residual risk (low/medium/high)"
            value={residual}
            onChange={(e) => setResidual(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <input
            type="date"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button className="btn-secondary text-xs" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary text-xs"
          disabled={!description.trim() || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Saving…' : 'Save Treatment'}
        </button>
      </div>
    </div>
  );
}

function RiskRow({ risk }: { risk: Risk }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<any>(null);
  const cfg = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.low;
  const latestTreatment = risk.riskTreatments?.[0];

  const getAiAdvice = useMutation({
    mutationFn: () => risksApi.getAiAdvice(risk.id),
    onSuccess: (data) => {
      setAiAdvice(data);
      qc.invalidateQueries({ queryKey: ['risks'] });
    },
  });

  const acceptTreatment = useMutation({
    mutationFn: (treatmentId: string) => risksApi.acceptTreatment(risk.id, treatmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks'] }),
  });

  const completeTreatment = useMutation({
    mutationFn: (treatmentId: string) => risksApi.completeTreatment(risk.id, treatmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['risks'] }),
  });

  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', cfg.rowCls)}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        <AlertTriangle className={cn('w-4 h-4 shrink-0', cfg.icon)} />
        <span className="text-sm font-medium text-gray-900 flex-1 truncate">{risk.title}</span>
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium shrink-0', cfg.badge)}>{cfg.label}</span>
        {latestTreatment && (
          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium shrink-0', TREATMENT_CONFIG[latestTreatment.treatmentType]?.color ?? '')}>
            {TREATMENT_CONFIG[latestTreatment.treatmentType]?.label}
          </span>
        )}
        <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0',
          risk.status === 'open' ? 'bg-red-50 text-red-700' :
          risk.status === 'mitigated' ? 'bg-green-50 text-green-700' :
          risk.status === 'accepted' ? 'bg-yellow-50 text-yellow-700' :
          'bg-gray-100 text-gray-500')}>
          {risk.status}
        </span>
        <span className="text-xs text-gray-400 font-mono shrink-0">Score: {risk.riskScore}</span>
      </button>

      {expanded && (
        <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
          {/* Risk details */}
          <div className="grid grid-cols-3 gap-4 text-xs">
            <div><p className="text-gray-400">Likelihood</p><p className="font-medium capitalize">{risk.likelihood}</p></div>
            <div><p className="text-gray-400">Impact</p><p className="font-medium capitalize">{risk.impact}</p></div>
            <div><p className="text-gray-400">Risk Score</p><p className="font-bold text-gray-900">{risk.riskScore}</p></div>
          </div>

          {risk.description && (
            <div
              className="text-sm text-gray-600 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: risk.description }}
            />
          )}

          {risk.mitigationAdvice && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-800 mb-1">AI Mitigation Advice</p>
              <div
                className="text-xs text-blue-700 prose prose-xs max-w-none"
                dangerouslySetInnerHTML={{ __html: risk.mitigationAdvice }}
              />
            </div>
          )}

          {/* AI Advice panel */}
          {aiAdvice && (
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <p className="text-xs font-semibold text-purple-800">AI Risk Analysis</p>
              </div>
              {aiAdvice.executiveSummary && (
                <p className="text-xs text-purple-700">{aiAdvice.executiveSummary}</p>
              )}
              {aiAdvice.quickWin && (
                <div className="bg-white rounded-lg px-3 py-2 border border-purple-100">
                  <p className="text-xs font-semibold text-purple-700 mb-0.5">⚡ Quick Win</p>
                  <p className="text-xs text-gray-700">{aiAdvice.quickWin}</p>
                </div>
              )}
              {aiAdvice.mitigationStrategies?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-purple-700">Strategies</p>
                  {aiAdvice.mitigationStrategies.slice(0, 3).map((s: any, i: number) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 border border-purple-100">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-medium text-gray-800">{s.title}</p>
                        <div className="flex gap-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 capitalize">{s.type}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 capitalize">{s.effort} effort</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600">{s.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Get AI advice button (only if no advice yet) */}
          {!aiAdvice && risk.status === 'open' && (
            <button
              onClick={() => getAiAdvice.mutate()}
              disabled={getAiAdvice.isPending}
              className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50 transition-colors"
            >
              {getAiAdvice.isPending ? (
                <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {getAiAdvice.isPending ? 'Generating AI advice…' : 'Get AI Mitigation Advice'}
            </button>
          )}

          {/* Treatment history */}
          {(risk.riskTreatments?.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Treatment History</p>
              <div className="space-y-2">
                {risk.riskTreatments.map((t) => {
                  const tcfg = TREATMENT_CONFIG[t.treatmentType];
                  const TIcon = tcfg?.icon ?? Zap;
                  return (
                    <div key={t.id} className={cn('border rounded-lg p-3', tcfg?.color ?? 'border-gray-200')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2">
                          <TIcon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold">{tcfg?.label} — {t.status}</p>
                            <p className="text-xs mt-0.5 opacity-80">{t.treatmentDescription}</p>
                            {t.residualRiskAfter && (
                              <p className="text-xs mt-1 opacity-70">Residual risk: {t.residualRiskAfter}</p>
                            )}
                            {t.targetCompletionDate && (
                              <p className="text-xs mt-0.5 opacity-70 flex items-center gap-1">
                                <Clock className="w-3 h-3" />Target: {new Date(t.targetCompletionDate).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {t.status === 'open' && t.treatmentType === 'accept' && (
                            <button
                              className="text-xs px-2 py-0.5 rounded bg-white border border-current font-medium hover:opacity-80 transition-opacity"
                              onClick={() => acceptTreatment.mutate(t.id)}
                              disabled={acceptTreatment.isPending}
                            >
                              Sign Off
                            </button>
                          )}
                          {t.status === 'open' && t.treatmentType === 'mitigate' && (
                            <button
                              className="text-xs px-2 py-0.5 rounded bg-white border border-current font-medium hover:opacity-80 transition-opacity"
                              onClick={() => completeTreatment.mutate(t.id)}
                              disabled={completeTreatment.isPending}
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add treatment form */}
          {showForm ? (
            <TreatmentForm riskId={risk.id} onClose={() => setShowForm(false)} />
          ) : (
            risk.status === 'open' && (
              <button
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
                onClick={() => setShowForm(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                Add Treatment Decision
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

export default function RisksPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'mitigated' | 'accepted'>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [aiResult, setAiResult] = useState<{ created: number } | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResult | null>(null);

  const portfolioMutation = useMutation({
    mutationFn: () => risksApi.portfolioAnalysis(),
    onSuccess: (result) => setPortfolio(result),
  });

  const { data = [], isLoading } = useQuery<Risk[]>({
    queryKey: ['risks'],
    queryFn: () => risksApi.list(),
  });

  const { data: stats } = useQuery({
    queryKey: ['risk-stats'],
    queryFn: () => risksApi.getStats(),
  });

  const generateRisks = useMutation({
    mutationFn: () => risksApi.generateFromGaps(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['risks'] });
      qc.invalidateQueries({ queryKey: ['risk-stats'] });
      setAiResult({ created: result.created });
      setTimeout(() => setAiResult(null), 5000);
    },
  });

  const filtered = (data as Risk[]).filter((r) => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterSeverity !== 'all' && r.severity !== filterSeverity) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {showAddModal && <RiskModal onClose={() => setShowAddModal(false)} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Risk Register</h1>
            <p className="text-sm text-gray-500">Identify, score, treat, and track all compliance risks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => portfolioMutation.mutate()}
            disabled={portfolioMutation.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200
                       bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {portfolioMutation.isPending
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <BarChart3 className="w-4 h-4" />}
            {portfolioMutation.isPending ? 'Analyzing…' : 'Portfolio Analysis'}
          </button>
          <button
            onClick={() => generateRisks.mutate()}
            disabled={generateRisks.isPending}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-purple-200
                       bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors disabled:opacity-60"
          >
            {generateRisks.isPending ? (
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {generateRisks.isPending ? 'Scanning…' : 'AI Scan Gaps'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Risk
          </button>
        </div>
      </div>

      {/* AI result banner */}
      {aiResult !== null && (
        <div className="flex items-center gap-2 px-4 py-3 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
          <Sparkles className="w-4 h-4 text-purple-500 shrink-0" />
          {aiResult.created === 0
            ? 'All control gaps already have associated risks — nothing new identified.'
            : `✓ ${aiResult.created} risk${aiResult.created !== 1 ? 's' : ''} identified from your control gaps and added to the register.`}
        </div>
      )}

      {/* Portfolio Analysis panel */}
      {portfolio && (
        <PortfolioPanel result={portfolio} onClose={() => setPortfolio(null)} />
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, cls: 'text-gray-900' },
            { label: 'Open', value: stats.open, cls: 'text-red-700' },
            { label: 'High+', value: stats.highRisks, cls: 'text-orange-700' },
            { label: 'Mitigated', value: stats.mitigated, cls: 'text-green-700' },
            { label: 'Accepted', value: stats.accepted, cls: 'text-yellow-700' },
          ].map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-1', s.cls)}>{s.value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {/* 5×5 Risk Matrix */}
      {(data as Risk[]).length > 0 && (
        <div className="card p-5">
          <p className="text-sm font-semibold text-gray-900 mb-4">Risk Matrix</p>
          <div className="flex gap-2">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center gap-1 shrink-0" style={{ width: 16 }}>
              <span className="text-[9px] text-gray-400 rotate-[-90deg] whitespace-nowrap" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', transformOrigin: 'center' }}>
                IMPACT ↑
              </span>
            </div>
            <div className="flex-1">
              {/* Matrix cells — impact on Y (high→low), likelihood on X (low→high) */}
              {(['catastrophic', 'major', 'moderate', 'minor', 'negligible'] as const).map((imp) => (
                <div key={imp} className="flex gap-1 mb-1">
                  <div className="w-16 text-[10px] text-gray-400 flex items-center justify-end pr-1.5 shrink-0 capitalize">{imp}</div>
                  {(['rare', 'unlikely', 'possible', 'likely', 'almost_certain'] as const).map((lik) => {
                    const cellRisks = (data as Risk[]).filter(
                      (r: Risk) => r.likelihood === lik && r.impact === imp && r.status !== 'mitigated',
                    );
                    const score = LIKELIHOOD_SCORES[lik] * IMPACT_SCORES[imp];
                    const cellColor =
                      score >= 17 ? 'bg-red-100 border-red-200'
                      : score >= 10 ? 'bg-orange-100 border-orange-200'
                      : score >= 5  ? 'bg-yellow-100 border-yellow-200'
                      : 'bg-gray-50 border-gray-200';
                    const dotColor =
                      score >= 17 ? 'bg-red-500'
                      : score >= 10 ? 'bg-orange-500'
                      : score >= 5  ? 'bg-yellow-500'
                      : 'bg-gray-400';
                    return (
                      <div
                        key={lik}
                        className={cn('flex-1 h-10 rounded border flex items-center justify-center gap-0.5 flex-wrap p-0.5', cellColor)}
                        title={cellRisks.map((r: Risk) => r.title).join('\n') || `${imp} × ${lik}`}
                      >
                        {cellRisks.slice(0, 4).map((r: Risk) => (
                          <span key={r.id} className={cn('w-2 h-2 rounded-full', dotColor)} />
                        ))}
                        {cellRisks.length > 4 && <span className="text-[9px] font-bold text-gray-600">+{cellRisks.length - 4}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
              {/* X-axis labels */}
              <div className="flex gap-1 mt-1">
                <div className="w-16 shrink-0" />
                {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'].map((l) => (
                  <div key={l} className="flex-1 text-center text-[9px] text-gray-400">{l}</div>
                ))}
              </div>
              <p className="text-center text-[9px] text-gray-400 mt-1">LIKELIHOOD →</p>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">Dots = open/accepted risks. Mitigated risks not shown.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'open', 'mitigated', 'accepted'] as const).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                filterStatus === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(['all', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
            <button key={s} onClick={() => setFilterSeverity(s)}
              className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                filterSeverity === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
              {s}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 self-center">{sorted.length} risks</p>
      </div>

      {/* Risk list */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="card p-12 text-center">
          <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No risks match the current filter</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((r) => <RiskRow key={r.id} risk={r} />)}
        </div>
      )}
    </div>
  );
}
