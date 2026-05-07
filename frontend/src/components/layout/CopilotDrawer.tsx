'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Sparkles, X, Send, Bot, User, RotateCcw,
  Shield, AlertTriangle, BarChart3, FileText, CheckSquare, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
};

// ─── Suggested prompts ────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'What controls need attention?',    icon: AlertTriangle },
  { label: 'Summarize my compliance status',   icon: BarChart3 },
  { label: 'Show expiring evidence',           icon: FileText },
  { label: 'What are my biggest risks?',       icon: Shield },
  { label: 'Which tasks are overdue?',         icon: CheckSquare },
  { label: 'Draft a weekly status email',      icon: Zap },
];

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-indigo-700 rounded px-0.5 text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<p class="font-semibold text-gray-900 mt-2 mb-0.5">$1</p>')
    .replace(/^## (.+)$/gm, '<p class="font-bold text-gray-900 mt-2 mb-1">$1</p>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="my-1 space-y-0.5">$1</ul>')
    .replace(/\n\n/g, '</p><p class="mt-1.5">')
    .replace(/\n/g, '<br/>');
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';

  if (isUser) {
    return (
      <div className="flex gap-2 flex-row-reverse">
        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-gray-600" />
        </div>
        <div className="bg-brand-600 text-white rounded-2xl rounded-tr-sm px-3 py-2.5 text-sm max-w-[calc(100%-3.5rem)] whitespace-pre-wrap">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-brand-600" />
      </div>
      <div className="max-w-[calc(100%-3.5rem)]">
        {msg.pending ? (
          <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <div
            className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdown(msg.content)}</p>` }}
          />
        )}
      </div>
    </div>
  );
}

// ─── CopilotDrawer ────────────────────────────────────────────────────────────

export function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [context, setContext] = useState<{ controlsTotal?: number; readinessScore?: number }>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: trimmed };

    setMessages((prev) => [
      ...prev,
      userMsg,
      { role: 'assistant', content: '', pending: true },
    ]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => !m.pending && m.content)
        .slice(-8)
        .map(({ role, content }) => ({ role, content }));

      const { data } = await api.post('/copilot/chat', { message: trimmed, history });
      if (data.context) setContext(data.context);

      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: data.message },
      ]);
    } catch (err: any) {
      const status = err?.response?.status;
      let errMsg = "Sorry, I couldn't reach the AI backend.";
      if (status === 502 || status === 503) {
        errMsg = "The backend is restarting — please try again in a moment.";
      } else if (status === 401 || status === 403) {
        errMsg = "Authentication error. Please refresh the page and try again.";
      } else if (err?.response?.data?.message?.includes('LLM') || err?.response?.data?.message?.includes('API key')) {
        errMsg = "No OpenRouter API key configured. Go to **Settings → LLM Settings** and add your key to enable the Copilot.";
      }
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: errMsg },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function reset() {
    setMessages([]);
    setContext({});
    setInput('');
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg',
          'hover:bg-brand-700 transition-all hover:scale-105 flex items-center justify-center',
          open && 'opacity-0 pointer-events-none scale-90',
        )}
        aria-label="Open Compliance Copilot"
        title="AI Compliance Copilot"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white shadow-2xl border-l border-gray-200',
          'transition-transform duration-300 ease-out w-[400px]',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-brand-600 to-indigo-700 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Compliance Copilot</p>
              {context.readinessScore !== undefined ? (
                <p className="text-xs text-white/70">
                  Readiness: <span className="font-medium text-white">{context.readinessScore}%</span>
                  {context.controlsTotal !== undefined && (
                    <> · <span className="font-medium text-white">{context.controlsTotal}</span> controls</>
                  )}
                </p>
              ) : (
                <p className="text-xs text-white/70">Backed by live compliance data</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                title="Clear conversation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3">
              {/* Welcome message */}
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-gray-700 max-w-[calc(100%-3rem)]">
                  <p>Hi! I&apos;m your Compliance Copilot. I have access to live data on your controls, evidence, risks, policies, and readiness score.</p>
                  <p className="mt-1.5">What would you like to know?</p>
                </div>
              </div>

              {/* Quick prompts */}
              <p className="text-xs text-gray-400 text-center pt-1">Quick prompts</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PROMPTS.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    onClick={() => sendMessage(label)}
                    className="flex items-start gap-1.5 p-2.5 rounded-xl border border-gray-200 hover:border-brand-300 hover:bg-brand-50 text-left transition-colors group"
                  >
                    <Icon className="w-3.5 h-3.5 text-brand-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-600 group-hover:text-brand-700 leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} />
          ))}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-3 py-3 shrink-0">
          <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your compliance…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none min-h-[1.5rem] max-h-24 overflow-y-auto"
              style={{ lineHeight: '1.5rem' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 mb-0.5',
                input.trim() && !loading
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed',
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </>
  );
}
