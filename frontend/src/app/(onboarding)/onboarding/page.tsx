'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield, Send, CheckCircle, ChevronRight, Sparkles, Loader2, RotateCcw, Check,
  AlertTriangle, Zap, ChevronDown, ChevronUp, Activity, Lock, Database,
  Target, Users, FileText, Globe, Building2, ShieldAlert,
} from 'lucide-react';
import {
  onboardingApi, OnboardingMessage, ChatResponse, OnboardingStatus,
  RiskObservation, IntegrationRecommendation,
} from '@/lib/api/onboarding';
import { cn } from '@/lib/utils';

// ─── Discovery phases ─────────────────────────────────────────────────────────

const DISCOVERY_PHASES = [
  {
    id: 'foundation',
    label: 'Foundation',
    icon: Building2,
    fields: ['companyName', 'companyType', 'industry', 'employeeCount', 'regions', 'workforceModel'],
    required: ['companyName', 'companyType', 'industry', 'employeeCount'],
  },
  {
    id: 'compliance_goals',
    label: 'Compliance Goals',
    icon: Target,
    fields: ['targetFrameworks', 'auditType', 'targetDate', 'complianceDriver', 'existingCertifications'],
    required: ['targetFrameworks', 'complianceDriver'],
  },
  {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: Database,
    fields: ['cloudProviders', 'keyDatabases', 'cicdTools', 'sourceControl', 'saasTools', 'internetFacing'],
    required: ['cloudProviders'],
  },
  {
    id: 'security_ops',
    label: 'Security Ops',
    icon: Lock,
    fields: ['mfaStatus', 'identityProvider', 'loggingMaturity', 'siemTool', 'endpointManagement', 'vulnerabilityScanning', 'patchManagement', 'incidentResponsePlan', 'backupStatus'],
    required: ['mfaStatus'],
  },
  {
    id: 'data_privacy',
    label: 'Data & Privacy',
    icon: ShieldAlert,
    fields: ['dataTypes', 'gdprExposure', 'ccpaExposure', 'hipaaScope', 'dataRetentionPolicy', 'subprocessorCount', 'crossBorderTransfers'],
    required: ['dataTypes'],
  },
  {
    id: 'ownership',
    label: 'Ownership',
    icon: Users,
    fields: ['ownerAccess', 'ownerInfrastructure', 'ownerIncidentResponse', 'ownerCompliance', 'ownerPolicies', 'ownerVendors', 'teamStructure'],
    required: [],
  },
  {
    id: 'readiness',
    label: 'Readiness',
    icon: FileText,
    fields: ['documentationMaturity', 'accessReviewCadence', 'vendorReviewCadence', 'existingGRCTooling'],
    required: [],
  },
] as const;

// All fields tracked in progress
const ALL_FIELDS = DISCOVERY_PHASES.flatMap((p) => [...p.fields]);

// ─── Chip config ──────────────────────────────────────────────────────────────

interface ChipGroup {
  chips: string[];
  multiSelect: boolean;
}

const CHIP_GROUPS: Record<string, ChipGroup> = {
  companyType:          { chips: ['Startup', 'SMB', 'Enterprise', 'Nonprofit', 'Government'], multiSelect: false },
  industry:             { chips: ['SaaS', 'FinTech', 'Healthcare', 'eCommerce', 'EdTech', 'Legal', 'Manufacturing', 'Logistics', 'Real Estate', 'Media', 'Professional Services'], multiSelect: false },
  employeeCount:        { chips: ['1–10', '11–50', '51–200', '201–1000', '1000+'], multiSelect: false },
  regions:              { chips: ['US', 'EU', 'UK', 'Canada', 'APAC', 'Global'], multiSelect: true },
  workforceModel:       { chips: ['Fully remote', 'Hybrid', 'On-premise', 'Distributed global'], multiSelect: false },
  cloudProviders:       { chips: ['AWS', 'GCP', 'Azure', 'Self-hosted', 'On-premise', 'Multi-cloud'], multiSelect: true },
  dataTypes:            { chips: ['PII (Personal data)', 'PHI (Health data)', 'PCI (Payment data)', 'Financial data', 'IP / Source code', 'Public only'], multiSelect: true },
  targetFrameworks:     { chips: ['SOC 2 Type 1', 'SOC 2 Type 2', 'ISO 27001', 'HIPAA', 'GDPR', 'PCI-DSS', 'NIST', 'CCPA'], multiSelect: true },
  auditType:            { chips: ['Type 1 (point-in-time)', 'Type 2 (period of time)', 'Gap assessment', 'Renewal'], multiSelect: false },
  complianceDriver:     { chips: ['Customer requirement', 'Investor due diligence', 'Regulatory mandate', 'Internal policy', 'IPO prep', 'M&A', 'Government contract'], multiSelect: false },
  mfaStatus:            { chips: ['No MFA yet', 'Partial (some users)', 'All users', 'All users — phishing-resistant'], multiSelect: false },
  identityProvider:     { chips: ['Okta', 'Azure AD', 'Google Workspace', 'JumpCloud', 'Active Directory', 'None yet'], multiSelect: false },
  loggingMaturity:      { chips: ['No logging', 'Basic (app logs)', 'Centralized (log aggregation)', 'SIEM integrated'], multiSelect: false },
  endpointManagement:   { chips: ['None', 'Basic AV', 'MDM', 'EDR', 'Full EDR + MDM'], multiSelect: false },
  vulnerabilityScanning: { chips: ['None', 'Manual scans', 'Automated (basic)', 'Automated (continuous)'], multiSelect: false },
  incidentResponsePlan: { chips: ['No IR plan', 'Informal (ad hoc)', 'Documented', 'Documented + tested'], multiSelect: false },
  backupStatus:         { chips: ['No backups', 'Basic backups', 'Tested backups', 'Automated + tested'], multiSelect: false },
  teamStructure:        { chips: ['Dedicated security team', 'Security as a hat role', 'No security owner', 'Outsourced MSSP'], multiSelect: false },
  documentationMaturity: { chips: ['None', 'Scattered notes', 'Partial policies', 'Documented policies', 'Automated / GRC tool'], multiSelect: false },
  accessReviewCadence:  { chips: ['Never', 'Ad hoc', 'Quarterly', 'Monthly', 'Continuous'], multiSelect: false },
  vendorReviewCadence:  { chips: ['Never', 'Ad hoc', 'Annual', 'Semi-annual', 'Quarterly'], multiSelect: false },
  gdprExposure:         { chips: ['No EU users', 'Minimal EU exposure', 'Moderate EU exposure', 'Significant EU exposure'], multiSelect: false },
  subprocessorCount:    { chips: ['0', '1–5 vendors', '6–20 vendors', '20+ vendors'], multiSelect: false },
};

function detectChipGroup(message: string): ChipGroup | null {
  const m = message.toLowerCase();
  // Company name question — never show chips (avoid false positives)
  if (/what.*(?:company|organization).*name|name.*(?:company|org)|what.*your.*company|what's.*name/i.test(m)) return null;
  // Phase-specific chips — ordered from most specific to least
  if (/startup|smb|enterprise|company type|type of company/i.test(m))            return CHIP_GROUPS.companyType;
  if (/industry|sector|type of business|what.*do you do/i.test(m))                return CHIP_GROUPS.industry;
  if (/employee|team size|how many people|staff|headcount/i.test(m))              return CHIP_GROUPS.employeeCount;
  if (/region|geograph|where.*operat|which countries|users.*based|based out of/i.test(m)) return CHIP_GROUPS.regions;
  if (/remote|hybrid|on-site|workforce model|work model|work.*arrangement/i.test(m)) return CHIP_GROUPS.workforceModel;
  if (/which cloud|what cloud|cloud provider|aws|gcp|azure|how.*hosted|where.*hosted|which.*hosting/i.test(m)) return CHIP_GROUPS.cloudProviders;
  if (/data.*handle|data.*store|process.*data|data type|sensitive data|what.*data/i.test(m)) return CHIP_GROUPS.dataTypes;
  if (/framework|soc 2|iso 27001|hipaa|gdpr|pci.dss|compliance.*target|which.*framework/i.test(m)) return CHIP_GROUPS.targetFrameworks;
  if (/type 1|type 2|audit type|gap assessment|period of time|point.in.time/i.test(m)) return CHIP_GROUPS.auditType;
  if (/why.*compliance|driving.*compliance|compliance.*reason|what.*motivat|what.*driving/i.test(m)) return CHIP_GROUPS.complianceDriver;
  if (/mfa|multi.factor|two.factor|2fa|authenticat/i.test(m))                    return CHIP_GROUPS.mfaStatus;
  if (/identity provider|which.*sso|okta|azure ad|jumpcloud|idp\b/i.test(m))     return CHIP_GROUPS.identityProvider;
  if (/logging|log management|centralized.*log|siem\b/i.test(m))                 return CHIP_GROUPS.loggingMaturity;
  if (/endpoint.*manag|edr\b|mdm\b|device management/i.test(m))                  return CHIP_GROUPS.endpointManagement;
  if (/vulnerability.*scan|vuln.*scan|pentest/i.test(m))                          return CHIP_GROUPS.vulnerabilityScanning;
  if (/incident response|ir plan|incident.*plan/i.test(m))                        return CHIP_GROUPS.incidentResponsePlan;
  if (/backup|disaster recovery|data recovery/i.test(m))                          return CHIP_GROUPS.backupStatus;
  if (/security.*team|dedicated.*security|ciso|who.*owns.*security/i.test(m))     return CHIP_GROUPS.teamStructure;
  if (/documentation|policies.*written|policy.*maturity|how.*documented/i.test(m)) return CHIP_GROUPS.documentationMaturity;
  if (/access review|user.*review|periodic.*review|who.*has access/i.test(m))     return CHIP_GROUPS.accessReviewCadence;
  if (/vendor review|third.party.*review|supplier.*review/i.test(m))              return CHIP_GROUPS.vendorReviewCadence;
  if (/gdpr|eu.*user|european.*user|eu.*data/i.test(m))                           return CHIP_GROUPS.gdprExposure;
  if (/how many.*vendor|how many.*subprocessor|third.party.*receiv/i.test(m))     return CHIP_GROUPS.subprocessorCount;
  return null;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  high:   { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'High' },
  medium: { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500',  label: 'Med'  },
  low:    { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-400',   label: 'Low'  },
} as const;

// ─── Profile Sidebar ──────────────────────────────────────────────────────────

function ProfileSidebar({
  profile,
  pct,
  onFinalize,
  finalizing,
  canFinalize,
  riskObservations,
  integrationRecs,
  phaseCompletion,
  currentPhase,
}: {
  profile: Record<string, unknown>;
  pct: number;
  onFinalize: () => void;
  finalizing: boolean;
  canFinalize: boolean;
  riskObservations: RiskObservation[];
  integrationRecs: IntegrationRecommendation[];
  phaseCompletion: Record<string, number>;
  currentPhase: string;
}) {
  const [risksExpanded, setRisksExpanded] = useState(true);
  const [integrationsExpanded, setIntegrationsExpanded] = useState(true);

  // Compute per-phase completion from profile fields (client-side fallback)
  const computedPhaseCompletion = useMemo(() => {
    const result: Record<string, number> = {};
    for (const phase of DISCOVERY_PHASES) {
      const collected = phase.fields.filter((f) => {
        const v = profile[f];
        if (v == null || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      }).length;
      result[phase.id] = Math.round((collected / phase.fields.length) * 100);
    }
    return result;
  }, [profile]);

  const effectivePhaseCompletion = Object.keys(phaseCompletion).length > 0 ? phaseCompletion : computedPhaseCompletion;

  // Compute total automation potential from integrations
  const totalAutomation = useMemo(
    () => integrationRecs.reduce((sum, i) => sum + (i.automatesControls ?? 0), 0),
    [integrationRecs],
  );

  const highRisks = riskObservations.filter((r) => r.severity === 'high').length;

  return (
    <div className="hidden lg:flex flex-col w-80 border-l border-gray-200 bg-white overflow-hidden">

      {/* ── Overall progress ── */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Discovery Progress</p>
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            pct >= 85 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-brand-100 text-brand-700' : 'bg-orange-100 text-orange-700',
          )}>{pct}%</span>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              pct >= 85 ? 'bg-green-500' : pct >= 50 ? 'bg-brand-500' : 'bg-orange-400',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Quick stats row */}
        {(highRisks > 0 || totalAutomation > 0) && (
          <div className="flex items-center gap-3 mt-2.5">
            {highRisks > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="w-3 h-3" />
                <span className="font-medium">{highRisks} high risk{highRisks > 1 ? 's' : ''}</span>
              </div>
            )}
            {totalAutomation > 0 && (
              <div className="flex items-center gap-1 text-xs text-brand-600">
                <Zap className="w-3 h-3" />
                <span className="font-medium">~{totalAutomation} controls automatable</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── 7 Discovery Phase cards ── */}
        <div className="px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Discovery Phases</p>
          {DISCOVERY_PHASES.map((phase) => {
            const completion = effectivePhaseCompletion[phase.id] ?? 0;
            const isActive = currentPhase === phase.id;
            const isDone = completion === 100;
            const Icon = phase.icon;
            return (
              <div
                key={phase.id}
                className={cn(
                  'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors',
                  isActive ? 'bg-brand-50 border border-brand-200' : 'bg-gray-50 border border-transparent',
                )}
              >
                <div className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                  isDone ? 'bg-green-100' : isActive ? 'bg-brand-100' : 'bg-gray-200',
                )}>
                  {isDone
                    ? <Check className="w-3.5 h-3.5 text-green-600" />
                    : <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-brand-600' : 'text-gray-400')} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={cn(
                      'text-xs font-medium truncate',
                      isActive ? 'text-brand-700' : isDone ? 'text-green-700' : 'text-gray-600',
                    )}>
                      {phase.label}
                    </p>
                    <span className={cn(
                      'text-xs font-semibold ml-1 shrink-0',
                      isDone ? 'text-green-600' : isActive ? 'text-brand-600' : 'text-gray-400',
                    )}>
                      {completion}%
                    </span>
                  </div>
                  <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        isDone ? 'bg-green-500' : isActive ? 'bg-brand-500' : 'bg-gray-300',
                      )}
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Risk Intelligence panel ── */}
        {riskObservations.length > 0 && (
          <div className="mx-4 mt-2 mb-1 rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setRisksExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <AlertTriangle className={cn('w-3.5 h-3.5', highRisks > 0 ? 'text-red-500' : 'text-amber-500')} />
                <p className="text-xs font-semibold text-gray-700">Risk Intelligence</p>
                <span className={cn(
                  'text-xs font-bold px-1.5 py-0.5 rounded-full',
                  highRisks > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {riskObservations.length}
                </span>
              </div>
              {risksExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              }
            </button>
            {risksExpanded && (
              <div className="divide-y divide-gray-100">
                {riskObservations.map((risk, i) => {
                  const cfg = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.low;
                  return (
                    <div key={i} className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', cfg.dot)} />
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                            <span className="text-xs text-gray-500 font-medium">{risk.area}</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">{risk.observation}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Integration Intelligence panel ── */}
        {integrationRecs.length > 0 && (
          <div className="mx-4 mt-2 mb-3 rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setIntegrationsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-brand-500" />
                <p className="text-xs font-semibold text-gray-700">Integration Opportunities</p>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700">
                  {integrationRecs.length}
                </span>
              </div>
              {integrationsExpanded
                ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              }
            </button>
            {integrationsExpanded && (
              <div className="divide-y divide-gray-100">
                {integrationRecs.map((rec, i) => (
                  <div key={i} className="px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">{rec.tool}</span>
                      <span className="text-xs font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                        ~{rec.automatesControls} controls
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{rec.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer CTA ── */}
      {canFinalize ? (
        <div className="px-4 py-4 border-t border-gray-100 bg-green-50 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-800">Profile Ready!</p>
              <p className="text-xs text-green-700 mt-0.5">
                {totalAutomation > 0
                  ? `Your tech stack can automate ~${totalAutomation} controls.`
                  : 'Ready to start your compliance assessment.'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onFinalize}
            disabled={finalizing}
            className="w-full btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
          >
            {finalizing ? (
              <><Loader2 className="w-3 h-3 animate-spin" /> Starting assessment…</>
            ) : (
              <><Sparkles className="w-3 h-3" /> Finalize & Start Assessment</>
            )}
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{100 - pct}% remaining</span> — the Copilot will guide you through all 7 discovery phases.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: OnboardingMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm',
        )}
      >
        {msg.content}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
        <Shield className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ─── Chip Tray ────────────────────────────────────────────────────────────────

function ChipTray({
  group,
  onSend,
  disabled,
}: {
  group: ChipGroup;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(chip: string) {
    if (!group.multiSelect) { onSend(chip); return; }
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(chip) ? next.delete(chip) : next.add(chip);
      return next;
    });
  }

  function confirm() {
    if (selected.size === 0) return;
    onSend(Array.from(selected).join(', '));
    setSelected(new Set());
  }

  return (
    <div className="px-6 pb-3 space-y-2">
      {group.multiSelect && (
        <p className="text-xs text-gray-400">Select all that apply, then confirm ↓</p>
      )}
      <div className="flex flex-wrap gap-2">
        {group.chips.map((chip) => {
          const isSelected = selected.has(chip);
          return (
            <button
              key={chip}
              onClick={() => toggle(chip)}
              disabled={disabled}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-all',
                group.multiSelect
                  ? isSelected
                    ? 'bg-brand-600 border-brand-600 text-white font-medium'
                    : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100'
                  : 'bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-600 hover:text-white hover:border-brand-600',
              )}
            >
              {group.multiSelect && isSelected && <Check className="w-3 h-3 inline mr-1" />}
              {chip}
            </button>
          );
        })}
        {group.multiSelect && selected.size > 0 && (
          <button
            onClick={confirm}
            disabled={disabled}
            className="text-xs px-3 py-1.5 rounded-full bg-green-600 text-white border border-green-600 font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Done ({selected.size})
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Phase badge (shown in header when active) ────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  foundation:      '🏢 Foundation',
  compliance_goals: '🎯 Compliance Goals',
  infrastructure:  '⚙️ Infrastructure',
  security_ops:    '🔐 Security Ops',
  data_privacy:    '🛡️ Data & Privacy',
  ownership:       '👥 Ownership',
  readiness:       '📋 Readiness',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [messages, setMessages]               = useState<OnboardingMessage[]>([]);
  const [input, setInput]                     = useState('');
  const [sending, setSending]                 = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [loadError, setLoadError]             = useState(false);
  const [profile, setProfile]                 = useState<Record<string, unknown>>({});
  const [completionScore, setCompletionScore] = useState(0);
  const [isComplete, setIsComplete]           = useState(false);
  const [finalizing, setFinalizing]           = useState(false);
  const [resetting, setResetting]             = useState(false);
  const [chipGroup, setChipGroup]             = useState<ChipGroup | null>(null);

  // ─── Discovery intelligence state ─────────────────────────────────────────
  const [riskObservations, setRiskObservations]   = useState<RiskObservation[]>([]);
  const [integrationRecs, setIntegrationRecs]     = useState<IntegrationRecommendation[]>([]);
  const [phaseCompletion, setPhaseCompletion]     = useState<Record<string, number>>({});
  const [currentPhase, setCurrentPhase]           = useState<string>('foundation');

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Compute pct from fields in profile ──────────────────────────────────────
  const filledCount = useMemo(() => {
    return Object.entries(profile).filter(([k, v]) => {
      if (k.startsWith('_')) return false;
      if (!ALL_FIELDS.includes(k as any)) return false;
      if (v == null || v === '') return false;
      if (Array.isArray(v) && (v as unknown[]).length === 0) return false;
      return true;
    }).length;
  }, [profile]);

  const pct = Math.max(
    Math.round(completionScore),
    Math.round((filledCount / ALL_FIELDS.length) * 100),
  );
  const canFinalize = pct >= 85;

  // ── On mount: resume existing session or request greeting ───────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const status: OnboardingStatus = await onboardingApi.getStatus();
        if (cancelled) return;

        if (status.hasSession && (status.messages?.length ?? 0) > 0) {
          setMessages(status.messages ?? []);
          setProfile(status.extractedData ?? {});
          setIsComplete(status.isComplete || status.status === 'completed');
          setRiskObservations(status.riskObservations ?? []);
          setIntegrationRecs(status.integrationRecommendations ?? []);
          setPhaseCompletion(status.phaseCompletion ?? {});
          setCurrentPhase(status.currentPhase ?? 'foundation');
          setChipGroup(null);
          setLoading(false);
          return;
        }

        // No existing session → request greeting
        const res: ChatResponse = await onboardingApi.chat(null);
        if (cancelled) return;

        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.message,
          createdAt: new Date().toISOString(),
        }]);
        setProfile(res.extractedFields ?? {});
        setCompletionScore(res.completionScore ?? 0);
        setIsComplete(res.isComplete ?? false);
        setRiskObservations(res.riskObservations ?? []);
        setIntegrationRecs(res.integrationRecommendations ?? []);
        setPhaseCompletion(res.phaseCompletion ?? {});
        setCurrentPhase(res.currentPhase ?? 'foundation');
        setChipGroup(detectChipGroup(res.message));

      } catch (err) {
        if (cancelled) return;
        console.error('Onboarding init error:', err);
        setLoadError(true);
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Hi! I'm your Compliance Copilot 👋 I'll run a deep discovery session to map your entire compliance infrastructure — from your tech stack and security posture to data flows and governance. Let's start — what's your company name?",
          createdAt: new Date().toISOString(),
        }]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── Send a message ───────────────────────────────────────────────────────────
  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setChipGroup(null);
    setInput('');
    setSending(true);

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      createdAt: new Date().toISOString(),
    }]);

    try {
      const res: ChatResponse = await onboardingApi.chat(msg);

      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.message,
        createdAt: new Date().toISOString(),
      }]);

      if (res.extractedFields && Object.keys(res.extractedFields).length > 0) {
        setProfile((prev) => ({ ...prev, ...res.extractedFields }));
      }
      setCompletionScore(res.completionScore ?? 0);
      setIsComplete(res.isComplete ?? false);
      if (res.currentPhase) setCurrentPhase(res.currentPhase);
      if (res.riskObservations?.length) setRiskObservations(res.riskObservations);
      if (res.integrationRecommendations?.length) setIntegrationRecs(res.integrationRecommendations);
      if (res.phaseCompletion && Object.keys(res.phaseCompletion).length > 0) setPhaseCompletion(res.phaseCompletion);
      setChipGroup(detectChipGroup(res.message));

    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I had a connection issue. Please try again.",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending]);

  // ── Finalize onboarding ──────────────────────────────────────────────────────
  async function handleFinalize() {
    if (finalizing) return;
    setFinalizing(true);
    try {
      await onboardingApi.finalize();
      router.push('/overview');
    } catch (err: any) {
      console.error('Finalize error:', err);
      const detail = err?.response?.data?.message ?? 'Could not finalize. Please try again.';
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ ${detail}`,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setFinalizing(false);
    }
  }

  // ── Reset session ────────────────────────────────────────────────────────────
  async function handleReset() {
    if (resetting) return;
    setResetting(true);
    try {
      await onboardingApi.reset();
      setMessages([]);
      setProfile({});
      setCompletionScore(0);
      setIsComplete(false);
      setChipGroup(null);
      setRiskObservations([]);
      setIntegrationRecs([]);
      setPhaseCompletion({});
      setCurrentPhase('foundation');
      setLoading(true);
      const res: ChatResponse = await onboardingApi.chat(null);
      setMessages([{
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.message,
        createdAt: new Date().toISOString(),
      }]);
      setProfile(res.extractedFields ?? {});
      setCompletionScore(res.completionScore ?? 0);
      setIsComplete(res.isComplete ?? false);
      setRiskObservations(res.riskObservations ?? []);
      setIntegrationRecs(res.integrationRecommendations ?? []);
      setPhaseCompletion(res.phaseCompletion ?? {});
      setCurrentPhase(res.currentPhase ?? 'foundation');
      setChipGroup(detectChipGroup(res.message));
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setResetting(false);
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Chat area */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Compliance Copilot</p>
            <p className="text-xs text-gray-500">
              {isComplete
                ? 'Discovery complete — your Compliance Digital Twin is ready'
                : PHASE_LABELS[currentPhase]
                  ? `Exploring: ${PHASE_LABELS[currentPhase]}`
                  : 'Infrastructure Discovery Engine'
              }
            </p>
          </div>
          {isComplete && (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Discovery complete
            </div>
          )}
          {riskObservations.filter((r) => r.severity === 'high').length > 0 && !isComplete && (
            <div className="flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-full border border-red-200">
              <AlertTriangle className="w-3 h-3" />
              {riskObservations.filter((r) => r.severity === 'high').length} high risk
            </div>
          )}
          {messages.length > 0 && (
            <button
              onClick={handleReset}
              disabled={resetting || sending}
              title="Start a new discovery session"
              className="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            >
              {resetting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <RotateCcw className="w-4 h-4" />
              }
            </button>
          )}
        </div>

        {/* Progress bar */}
        {pct > 0 && (
          <div className="flex items-center gap-3 px-6 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  pct >= 85 ? 'bg-green-500' : pct >= 50 ? 'bg-brand-500' : 'bg-orange-400',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-600 shrink-0">{pct}%</span>
            {currentPhase && PHASE_LABELS[currentPhase] && (
              <span className="text-xs text-gray-400 hidden sm:block">{PHASE_LABELS[currentPhase]}</span>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

          {loading && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm animate-pulse w-64">
                <div className="h-3 bg-gray-200 rounded w-48 mb-1.5" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}

          {sending && <TypingBubble />}

          {loadError && (
            <div className="flex justify-center">
              <button
                onClick={() => window.location.reload()}
                className="text-xs text-gray-500 hover:text-brand-600 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Connection issue — tap to retry
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Chip tray */}
        {chipGroup && !sending && !isComplete && (
          <ChipTray group={chipGroup} onSend={(t) => send(t)} disabled={sending} />
        )}

        {/* Input / finalize area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                Compliance Digital Twin built! Ready to start your assessment.
              </div>
              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={handleFinalize}
                disabled={finalizing}
              >
                {finalizing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting your assessment…</>
                  : <>Go to your compliance dashboard <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          ) : canFinalize ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  className="input flex-1"
                  placeholder="Type your answer…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  disabled={sending || loading}
                />
                <button
                  className="btn-primary px-4"
                  onClick={() => send()}
                  disabled={sending || loading || !input.trim()}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <button
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors"
                onClick={handleFinalize}
                disabled={finalizing}
              >
                {finalizing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting assessment…</>
                  : <><Sparkles className="w-4 h-4" /> Finalize & Start Compliance Assessment</>}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                className="input flex-1"
                placeholder="Type your answer…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={sending || loading}
                autoFocus
              />
              <button
                className="btn-primary px-4"
                onClick={() => send()}
                disabled={sending || loading || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile sidebar */}
      <ProfileSidebar
        profile={profile}
        pct={pct}
        onFinalize={handleFinalize}
        finalizing={finalizing}
        canFinalize={canFinalize}
        riskObservations={riskObservations}
        integrationRecs={integrationRecs}
        phaseCompletion={phaseCompletion}
        currentPhase={currentPhase}
      />
    </div>
  );
}
