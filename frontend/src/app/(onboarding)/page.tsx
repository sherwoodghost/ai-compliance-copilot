'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Send, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import { onboardingApi, OnboardingMessage } from '@/lib/api/onboarding';
import { getSocket } from '@/lib/ws/socket';
import { useAuthStore } from '@/lib/stores/auth.store';
import Cookies from 'js-cookie';
import { cn } from '@/lib/utils';

// ─── Field clusters matching FIELD_CLUSTERS on the backend ───────────────────

const FIELD_CLUSTERS: Array<{
  label: string;
  emoji: string;
  fields: string[];
}> = [
  {
    label: 'Company Basics',
    emoji: '🏢',
    fields: ['companyName', 'industry', 'employeeCount', 'companyType'],
  },
  {
    label: 'Tech Stack',
    emoji: '⚙️',
    fields: ['infrastructure', 'cloudProviders', 'hostingModel', 'services'],
  },
  {
    label: 'Compliance Goals',
    emoji: '🎯',
    fields: ['targetFrameworks', 'certificationTimeline', 'auditType'],
  },
  {
    label: 'Data & Privacy',
    emoji: '🔒',
    fields: ['dataTypes', 'gdprRelevant', 'dataRetention', 'customerData'],
  },
  {
    label: 'Risk & Security',
    emoji: '🛡️',
    fields: ['riskLevel', 'existingControls', 'securityTools'],
  },
];

const ALL_FIELDS = FIELD_CLUSTERS.flatMap((c) => c.fields);

// ─── Profile Sidebar ──────────────────────────────────────────────────────────

function ProfileSidebar({
  profile,
  completenessScore,
}: {
  profile: Record<string, unknown> | null;
  completenessScore: number;
}) {
  const filled = useMemo(() => {
    if (!profile) return new Set<string>();
    return new Set(
      Object.entries(profile)
        .filter(([k, v]) => ALL_FIELDS.includes(k) && v != null && v !== '')
        .map(([k]) => k),
    );
  }, [profile]);

  const pct = Math.round(completenessScore * 100);

  return (
    <div className="hidden lg:flex flex-col w-72 border-l border-gray-200 bg-white">
      <div className="px-5 py-5 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-3">Profile Progress</p>

        {/* Completeness bar */}
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
              {/* Cluster header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{cluster.emoji}</span>
                  <p className="text-xs font-semibold text-gray-600">{cluster.label}</p>
                </div>
                <span className={cn(
                  'text-xs font-medium px-1.5 py-0.5 rounded-full',
                  allFilled
                    ? 'bg-green-100 text-green-700'
                    : clusterFilled > 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500',
                )}>
                  {clusterFilled}/{cluster.fields.length}
                </span>
              </div>

              {/* Field dots */}
              <div className="flex flex-wrap gap-1.5 pl-6">
                {cluster.fields.map((field) => {
                  const isFilled = filled.has(field);
                  const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                  return (
                    <div
                      key={field}
                      title={label}
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full border transition-all',
                        isFilled
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-400',
                      )}
                    >
                      {isFilled && '✓ '}
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA card */}
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

// ─── Completeness Progress Bar ────────────────────────────────────────────────

function CompletenessBar({ pct }: { pct: number }) {
  return (
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
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: OnboardingMessage }) {
  const isUser = msg.role === 'user';
  const [showTime, setShowTime] = useState(false);

  return (
    <div
      className={cn('flex group', isUser ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5 shrink-0">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      <div className="flex flex-col items-end gap-1 max-w-[85%]">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-brand-600 text-white rounded-tr-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm',
          )}
        >
          {msg.content}
        </div>
        {/* Timestamp on hover */}
        <span className={cn(
          'text-xs text-gray-400 transition-opacity duration-150',
          showTime ? 'opacity-100' : 'opacity-0',
        )}>
          {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<OnboardingMessage[]>([]);
  const [extractedProfile, setExtractedProfile] = useState<Record<string, unknown> | null>(null);
  const [completenessScore, setCompletenessScore] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: session } = useQuery({
    queryKey: ['onboarding-session'],
    queryFn: onboardingApi.getSession,
    refetchOnWindowFocus: false,
  });

  // Seed local state from server
  useEffect(() => {
    if (session?.messages?.length && localMessages.length === 0) {
      setLocalMessages(session.messages);
    }
    if (session?.businessProfile) {
      setExtractedProfile(session.businessProfile as Record<string, unknown>);
    }
    if (typeof session?.completeness_score === 'number') {
      setCompletenessScore(session.completeness_score);
    }
  }, [session]);

  // WebSocket
  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    const socket = getSocket();
    socket.on('onboarding:message', (data: {
      message: string;
      isComplete: boolean;
      extractedFields: Record<string, unknown>;
      completenessScore?: number;
    }) => {
      const agentMsg: OnboardingMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, agentMsg]);
      if (data.extractedFields && Object.keys(data.extractedFields).length > 0) {
        setExtractedProfile((prev) => ({ ...(prev ?? {}), ...data.extractedFields }));
      }
      if (typeof data.completenessScore === 'number') {
        setCompletenessScore(data.completenessScore);
      }
      if (data.isComplete) setIsComplete(true);
    });
    return () => { socket.off('onboarding:message'); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const userMsg: OnboardingMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    try {
      await onboardingApi.sendMessage(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const pct = Math.round(completenessScore * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto">
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

        {/* Completeness progress bar */}
        {pct > 0 && <CompletenessBar pct={pct} />}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {localMessages.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} />
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center mr-2 mt-0.5">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          {isComplete ? (
            <button
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => router.push('/overview')}
            >
              Go to dashboard <ChevronRight className="w-4 h-4" />
            </button>
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
                disabled={sending}
              />
              <button
                className="btn-primary px-4"
                onClick={send}
                disabled={sending || !input.trim()}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Profile sidebar ── */}
      <ProfileSidebar profile={extractedProfile} completenessScore={completenessScore} />
    </div>
  );
}
