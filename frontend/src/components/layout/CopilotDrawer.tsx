'use client';

import { useState, useRef, useEffect } from 'react';
import { apiClient as api } from '@/lib/api/client';
import {
  Sparkles, X, Send, Bot, User, Loader2, ChevronRight,
  Shield, AlertTriangle, BarChart3, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Message = { role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  { label: 'What controls need attention?', icon: AlertTriangle },
  { label: 'Summarize my compliance status', icon: BarChart3 },
  { label: 'Show expiring evidence', icon: FileText },
  { label: 'What are my biggest risks?', icon: Shield },
];

export function CopilotDrawer() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data } = await api.post('/copilot/chat', {
        message: text.trim(),
        history: messages.slice(-8),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't reach the backend. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg',
          'hover:bg-brand-700 transition-all hover:scale-105 flex items-center justify-center',
          open && 'hidden',
        )}
        aria-label="Open Compliance Copilot"
      >
        <Sparkles className="w-5 h-5" />
      </button>

      {/* Drawer */}
      <div
        className={cn(
          'fixed bottom-0 right-0 z-50 flex flex-col bg-white border-l border-gray-200 shadow-2xl',
          'transition-all duration-300 ease-in-out',
          open ? 'w-96 h-[calc(100vh-2rem)] rounded-tl-2xl' : 'w-0 h-0 overflow-hidden',
        )}
        style={{ bottom: '1rem', right: '1rem', maxHeight: 'calc(100vh - 2rem)' }}
      >
        {open && (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-brand-600 to-indigo-700 rounded-tl-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Compliance Copilot</p>
                  <p className="text-xs text-white/70">Backed by live data</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5 text-sm text-gray-700 max-w-[calc(100%-3rem)]">
                      <p>Hi! I'm your Compliance Copilot. I can answer questions about your controls, evidence, risks, policies, and readiness score.</p>
                      <p className="mt-1.5">What would you like to know?</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 text-center mt-2">Quick prompts</p>
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
                <div
                  key={i}
                  className={cn('flex gap-2.5', msg.role === 'user' && 'flex-row-reverse')}
                >
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                    msg.role === 'assistant' ? 'bg-brand-100' : 'bg-gray-200',
                  )}>
                    {msg.role === 'assistant'
                      ? <Bot className="w-3.5 h-3.5 text-brand-600" />
                      : <User className="w-3.5 h-3.5 text-gray-600" />
                    }
                  </div>
                  <div className={cn(
                    'rounded-2xl px-3 py-2.5 text-sm max-w-[calc(100%-3.5rem)] whitespace-pre-wrap',
                    msg.role === 'assistant'
                      ? 'bg-gray-100 text-gray-700 rounded-tl-sm'
                      : 'bg-brand-600 text-white rounded-tr-sm',
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-brand-600" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2.5">
                    <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-100 px-3 py-3">
              <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
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
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0',
                    input.trim() && !loading
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                  )}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-1.5">Press Enter to send · Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
