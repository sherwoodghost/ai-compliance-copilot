'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Send, CheckCircle, ChevronRight, Sparkles, Loader2, RotateCcw, Check, X } from 'lucide-react';
import { onboardingApi, OnboardingMessage, ChatResponse, OnboardingStatus } from '@/lib/api/onboarding';
import { cn } from '@/lib/utils';

// ─── Chip config — multi-select for array fields ──────────────────────────────

interface ChipGroup {
  chips: string[];
  multiSelect: boolean;
}

const CHIP_GROUPS: Record<string, ChipGroup> = {
  companyType:      { chips: ['Startup', 'SMB', 'Enterprise', 'Nonprofit'],                          multiSelect: false },
  industry:         { chips: ['SaaS', 'FinTech', 'Healthcare', 'eCommerce', 'Real Estate', 'Professional Services'], multiSelect: false },
  cloudProviders:   { chips: ['AWS', 'GCP', 'Azure', 'Self-hosted', 'On-premise'],                  multiSelect: true  },
  dataTypes:        { chips: ['PII (Personal data)', 'PHI (Health data)', 'PCI (Payment data)', 'IP / Source code', 'Public only'], multiSelect: true },
  targetFrameworks: { chips: ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'PCI-DSS'],                    multiSelect: true  },
  complianceDriver: { chips: ['Customer requirement', 'Investor due diligence', 'Internal policy', 'Regulatory mandate'], multiSelect: false },
  employeeCount:    { chips: ['1–10', '11–50', '51–200', '201–1000', '1000+'],                       multiSelect: false },
};

function detectChipGroup(message: string): ChipGroup | null {
  if (/startup|smb|enterprise|company type/i.test(message))      return CHIP_GROUPS.companyType;
  if (/industry|sector|type of business/i.test(message))          return CHIP_GROUPS.industry;
  if (/cloud|aws|gcp|azure|infrastructure|hosting/i.test(message)) return CHIP_GROUPS.cloudProviders;
  if (/data.*handle|store|process.*data|data type/i.test(message)) return CHIP_GROUPS.dataTypes;
  if (/framework|soc|iso|hipaa|gdpr|pci/i.test(message))          return CHIP_GROUPS.targetFrameworks;
  if (/why.*compliance|compliance.*reason|driver|motivated/i.test(message)) return CHIP_GROUPS.complianceDriver;
  if (/employee|team size|how many people|staff/i.test(message))   return CHIP_GROUPS.employeeCount;
  return null;
}

// ─── Field clusters (must match what the LLM system prompt extracts) ──────────

const FIELD_CLUSTERS = [
  { label: 'Company Basics',   emoji: '🏢', fields: ['companyName', 'companyType', 'industry', 'employeeCount'] },
  { label: 'Tech Stack',       emoji: '⚙️', fields: ['cloudProviders'] },
  { label: 'Data & Privacy',   emoji: '🔒', fields: ['dataTypes'] },
  { label: 'Compliance Goals', emoji: '🎯', fields: ['targetFrameworks', 'complianceDriver', 'targetDate'] },
];

const ALL_FIELDS = FIELD_CLUSTERS.flatMap((c) => c.fields);

// ─── Profile Sidebar ──────────────────────────────────────────────────────────

function ProfileSidebar({
  profile,
  pct,
  onFinalize,
  finalizing,
  canFinalize,
}: {
  profile: Record<string, unknown>;
  pct: number;
  onFinalize: () => void;
  finalizing: boolean;
  canFinalize: boolean;
}) {
  const filled = useMemo(() => {
    return new Set(
      Object.entries(profile)
        .filter(([k, v]) => {
          if (!ALL_FIELDS.includes(k)) return false;
          if (v == null || v === '') return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        })
        .map(([k]) => k),
    );
  }, [profile]);

  return (
    <div className="hidden lg:flex flex-col w-72 border-l border-gray-200 bg-white">
      {/* Progress header */}
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-3">Profile Progress</p>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">{pct}% complete</span>
          <span className="text-xs font-semibold text-gray-700">{filled.size}/{ALL_FIELDS.length} fields</span>
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
      </div>

      {/* Field clusters */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {FIELD_CLUSTERS.map((cluster) => {
          const clusterFilled = cluster.fields.filter((f) => filled.has(f)).length;
          const allFilled = clusterFilled === cluster.fields.length;
          return (
            <div key={cluster.label} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cluster.emoji}</span>
                  <p className="text-xs font-semibold text-gray-600">{cluster.label}</p>
                </div>
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-full',
                  allFilled      ? 'bg-green-100 text-green-700'
                  : clusterFilled > 0 ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500',
                )}>
                  {clusterFilled}/{cluster.fields.length}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {cluster.fields.map((field) => {
                  const isFilled = filled.has(field);
                  const val = profile[field];
                  const displayVal = Array.isArray(val)
                    ? (val as string[]).join(', ')
                    : val != null ? String(val) : '';
                  const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                  return (
                    <div
                      key={field}
                      title={isFilled ? `${label}: ${displayVal}` : label}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-all',
                        isFilled
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400',
                      )}
                    >
                      {isFilled ? `✓ ${label}` : label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      {canFinalize ? (
        <div className="px-4 py-4 border-t border-gray-100 bg-green-50 space-y-3">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-800">Profile Complete!</p>
              <p className="text-xs text-green-700 mt-0.5">
                Ready to start your compliance assessment.
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
            <span className="font-semibold text-gray-700">{100 - pct}% remaining</span> — keep
            answering questions to build your profile.
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

// ─── Chip Tray — handles both single and multi-select ────────────────────────

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
    if (!group.multiSelect) {
      // Single-select: immediately send
      onSend(chip);
      return;
    }
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  const [messages, setMessages]         = useState<OnboardingMessage[]>([]);
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [loading, setLoading]           = useState(true);   // loading session/greeting
  const [loadError, setLoadError]       = useState(false);
  const [profile, setProfile]           = useState<Record<string, unknown>>({});
  const [completionScore, setCompletionScore] = useState(0); // 0–100
  const [isComplete, setIsComplete]     = useState(false);
  const [finalizing, setFinalizing]     = useState(false);
  const [chipGroup, setChipGroup]       = useState<ChipGroup | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Compute pct from both LLM score and filled field count ──────────────────
  const filledCount = useMemo(() => {
    return Object.entries(profile).filter(([k, v]) => {
      if (!ALL_FIELDS.includes(k)) return false;
      if (v == null || v === '') return false;
      if (Array.isArray(v) && (v as unknown[]).length === 0) return false;
      return true;
    }).length;
  }, [profile]);

  // Use whichever is higher: LLM's score or field-count ratio
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
        // 1. Try to restore an existing session
        const status: OnboardingStatus = await onboardingApi.getStatus();

        if (cancelled) return;

        if (status.hasSession && (status.messages?.length ?? 0) > 0) {
          // Resume existing session — no need to re-fetch greeting
          setMessages(status.messages ?? []);
          setProfile(status.extractedData ?? {});
          setIsComplete(status.isComplete || status.status === 'completed');
          setChipGroup(null);
          setLoading(false);
          return;
        }

        // 2. No existing messages → ask for greeting
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
        setChipGroup(detectChipGroup(res.message));

      } catch (err) {
        if (cancelled) return;
        console.error('Onboarding init error:', err);
        setLoadError(true);
        // Show fallback greeting so the user isn't stuck on a blank screen
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Hi! I'm your Compliance Copilot 👋 I'll help you set up your compliance profile. Let's start — what's your company name?",
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

    // Optimistic bubble
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
              {isComplete ? 'Your compliance profile is ready!' : 'Setting up your compliance workspace'}
            </p>
          </div>
          {isComplete && (
            <div className="flex items-center gap-1.5 text-green-700 text-xs font-medium bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
              <CheckCircle className="w-3.5 h-3.5" />
              Profile complete
            </div>
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
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">

          {/* Loading skeleton for initial greeting */}
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

          {/* Retry button after load error */}
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

        {/* Chip tray (above input) */}
        {chipGroup && !sending && !isComplete && (
          <ChipTray group={chipGroup} onSend={(t) => send(t)} disabled={sending} />
        )}

        {/* Input / finalize area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                Your compliance profile is ready to go!
              </div>
              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={handleFinalize}
                disabled={finalizing}
              >
                {finalizing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting your assessment…</>
                  : <>Go to your dashboard <ChevronRight className="w-4 h-4" /></>}
              </button>
            </div>
          ) : canFinalize ? (
            // Profile ready but not LLM-flagged complete — show both input and finalize
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
      />
    </div>
  );
}
