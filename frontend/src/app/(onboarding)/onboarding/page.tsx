'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Send, CheckCircle, ChevronRight, Sparkles, Bot } from 'lucide-react';
import { onboardingApi, OnboardingMessage, ChatResponse } from '@/lib/api/onboarding';
import { cn } from '@/lib/utils';

// ─── Quick-reply chip suggestions per topic ───────────────────────────────────

const QUICK_REPLIES: Record<string, string[]> = {
  companyType:      ['Startup', 'SMB', 'Enterprise', 'Nonprofit'],
  industry:         ['SaaS', 'FinTech', 'Healthcare', 'eCommerce', 'Real Estate', 'Professional Services'],
  cloudProviders:   ['AWS', 'GCP', 'Azure', 'Self-hosted', 'Multiple'],
  dataTypes:        ['PII (Personal data)', 'PHI (Health data)', 'PCI (Payment data)', 'IP / Source code', 'Public only'],
  targetFrameworks: ['SOC 2', 'ISO 27001', 'HIPAA', 'GDPR', 'PCI-DSS'],
  complianceDriver: ['Customer requirement', 'Investor due diligence', 'Internal policy', 'Regulatory mandate'],
  employeeCount:    ['1–10', '11–50', '51–200', '201–1000', '1000+'],
};

/** Detect which chips to surface based on the last assistant message */
function detectChipContext(message: string): string[] | null {
  const lower = message.toLowerCase();
  if (/startup|smb|enterprise|company type/i.test(lower)) return QUICK_REPLIES.companyType;
  if (/industry|sector|type of business/i.test(lower))     return QUICK_REPLIES.industry;
  if (/cloud|aws|gcp|azure|infrastructure/i.test(lower))   return QUICK_REPLIES.cloudProviders;
  if (/data.*handle|store|process.*data|data type/i.test(lower)) return QUICK_REPLIES.dataTypes;
  if (/framework|soc|iso|hipaa|gdpr|pci/i.test(lower))    return QUICK_REPLIES.targetFrameworks;
  if (/why|driver|reason.*compliance|compliance.*reason/i.test(lower)) return QUICK_REPLIES.complianceDriver;
  if (/employee|team size|how many people/i.test(lower))   return QUICK_REPLIES.employeeCount;
  return null;
}

// ─── Field clusters for sidebar ───────────────────────────────────────────────

const FIELD_CLUSTERS = [
  { label: 'Company Basics',   emoji: '🏢', fields: ['companyName', 'industry', 'employeeCount', 'companyType'] },
  { label: 'Tech Stack',       emoji: '⚙️', fields: ['cloudProviders', 'infrastructure'] },
  { label: 'Compliance Goals', emoji: '🎯', fields: ['targetFrameworks', 'complianceDriver', 'targetDate'] },
  { label: 'Data & Privacy',   emoji: '🔒', fields: ['dataTypes'] },
];

const ALL_FIELDS = FIELD_CLUSTERS.flatMap((c) => c.fields);

// ─── Profile Sidebar ──────────────────────────────────────────────────────────

function ProfileSidebar({
  profile,
  completionScore,
}: {
  profile: Record<string, unknown>;
  completionScore: number;
}) {
  const filled = useMemo(() => {
    return new Set(
      Object.entries(profile)
        .filter(([k, v]) => ALL_FIELDS.includes(k) && v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
        .map(([k]) => k),
    );
  }, [profile]);

  const pct = Math.round(completionScore * 100);

  return (
    <div className="hidden lg:flex flex-col w-72 border-l border-gray-200 bg-white">
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
                  const displayVal = Array.isArray(val) ? (val as string[]).join(', ') : String(val ?? '');
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
                      {isFilled && '✓ '}{label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {pct >= 85 ? (
        <div className="px-4 py-4 border-t border-gray-100 bg-green-50">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-green-800">Profile Complete!</p>
              <p className="text-xs text-green-700 mt-0.5">
                You can now finalize and start your compliance assessment.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{100 - pct}% remaining</span> — keep
            answering questions to complete your profile.
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

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
        <Shield className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
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
  const [loadingGreeting, setLoadingGreeting] = useState(true);
  const [profile, setProfile]           = useState<Record<string, unknown>>({});
  const [completionScore, setCompletionScore] = useState(0);
  const [isComplete, setIsComplete]     = useState(false);
  const [chips, setChips]               = useState<string[] | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // ── On mount: fetch greeting from the sync endpoint ────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: ChatResponse = await onboardingApi.chat(null);
        if (cancelled) return;
        // Add greeting message
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.message,
          createdAt: new Date().toISOString(),
        }]);
        if (res.extractedFields) setProfile(res.extractedFields);
        setCompletionScore(res.completionScore / 100);
        setIsComplete(res.isComplete);
        setChips(detectChipContext(res.message));
      } catch {
        if (cancelled) return;
        // Fallback greeting if network/LLM fails
        setMessages([{
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Hi! I'm your Compliance Copilot 👋 I'll guide you through a quick setup to build your compliance profile. Let's start — what's your company name?",
          createdAt: new Date().toISOString(),
        }]);
      } finally {
        if (!cancelled) setLoadingGreeting(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // ── Send a message ─────────────────────────────────────────────────────────
  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;

    setChips(null);
    setInput('');
    setSending(true);

    // Optimistic user bubble
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      createdAt: new Date().toISOString(),
    }]);

    try {
      const res: ChatResponse = await onboardingApi.chat(msg);

      // Add assistant response
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.message,
        createdAt: new Date().toISOString(),
      }]);

      // Update profile state
      if (res.extractedFields && Object.keys(res.extractedFields).length > 0) {
        setProfile((prev) => ({ ...prev, ...res.extractedFields }));
      }
      setCompletionScore(res.completionScore / 100);
      setIsComplete(res.isComplete);
      setChips(detectChipContext(res.message));
    } catch {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: "Sorry, I had a hiccup. Could you try again?",
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const pct = Math.round(completionScore * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Chat area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Compliance Copilot</p>
            <p className="text-xs text-gray-500">Setting up your compliance workspace</p>
          </div>
          {isComplete && (
            <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
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
          {/* Loading greeting skeleton */}
          {loadingGreeting && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-48 mb-1.5" />
                <div className="h-3 bg-gray-200 rounded w-32" />
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}

          {sending && <TypingBubble />}

          <div ref={bottomRef} />
        </div>

        {/* Quick-reply chips */}
        {chips && chips.length > 0 && !sending && !isComplete && (
          <div className="px-6 pb-2 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => send(chip)}
                className="text-xs px-3 py-1.5 rounded-full border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isComplete ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                <CheckCircle className="w-4 h-4" />
                Your compliance profile is ready!
              </div>
              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={() => router.push('/overview')}
              >
                Go to your dashboard <ChevronRight className="w-4 h-4" />
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
                disabled={sending || loadingGreeting}
                autoFocus
              />
              <button
                className="btn-primary px-4"
                onClick={() => send()}
                disabled={sending || loadingGreeting || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile sidebar ───────────────────────────────────────────────── */}
      <ProfileSidebar profile={profile} completionScore={completionScore} />
    </div>
  );
}
