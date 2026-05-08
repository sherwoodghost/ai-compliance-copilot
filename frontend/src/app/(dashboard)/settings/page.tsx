'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/lib/api/settings';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { User, Building, Lock, LogOut, Bot, Key, CheckCircle2, XCircle, Loader2, Bell, Webhook, RotateCcw, AlertTriangle } from 'lucide-react';

function Section({ title, icon: Icon, children }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5 mb-5">
        <Icon className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({ fullName: user?.fullName ?? '' });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () => settingsApi.updateProfile(form),
    onSuccess: (data) => {
      setUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <Section title="Profile" icon={User}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
          <input
            type="text"
            className="input max-w-sm"
            value={form.fullName}
            onChange={(e) => setForm({ fullName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input type="email" className="input max-w-sm bg-gray-50" value={user?.email ?? ''} disabled />
        </div>
        <button
          className="btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending || !form.fullName.trim()}
        >
          {saved ? 'Saved!' : save.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </Section>
  );
}

function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const change = useMutation({
    mutationFn: () => settingsApi.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
    onSuccess: () => {
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Failed to change password'),
  });

  function submit() {
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    change.mutate();
  }

  function field(name: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [name]: e.target.value }));
  }

  return (
    <Section title="Change Password" icon={Lock}>
      <div className="space-y-4 max-w-sm">
        {error && (
          <div className="rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-success-50 border border-success-200 px-4 py-3 text-sm text-success-700">
            Password changed. All other sessions have been signed out.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
          <input type="password" className="input" value={form.currentPassword} onChange={field('currentPassword')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
          <input type="password" className="input" value={form.newPassword} onChange={field('newPassword')} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
          <input type="password" className="input" value={form.confirmPassword} onChange={field('confirmPassword')} />
        </div>
        <button className="btn-primary" onClick={submit} disabled={change.isPending}>
          {change.isPending ? 'Updating…' : 'Update password'}
        </button>
      </div>
    </Section>
  );
}

function OrgSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['org'],
    queryFn: () => settingsApi.getOrg(),
  });

  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: () => settingsApi.updateOrg({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <Section title="Organization" icon={Building}>
      <div className="space-y-4 max-w-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Organization name</label>
          <input
            type="text"
            className="input"
            defaultValue={data?.name ?? ''}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <button
          className="btn-primary"
          onClick={() => update.mutate()}
          disabled={update.isPending || !name.trim()}
        >
          {saved ? 'Saved!' : update.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </Section>
  );
}

function AIConfigSection() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; model?: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: llmSettings } = useQuery({
    queryKey: ['llm-settings'],
    queryFn: () => settingsApi.getLlmSettings(),
  });

  const save = useMutation({
    mutationFn: () => settingsApi.saveLlmSettings(apiKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-settings'] });
      setSaved(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 2500);
    },
  });

  async function testKey() {
    const keyToTest = apiKey || (llmSettings?.hasKey ? '(stored key)' : '');
    if (!keyToTest) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await settingsApi.testLlmConnection();
      setTestResult({ success: r.ok, error: r.error, model: r.model });
    } catch {
      setTestResult({ success: false, error: 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Section title="AI Configuration" icon={Bot}>
      <div className="space-y-5">
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-900 mb-1">Bring Your Own OpenRouter Key</p>
          <p className="text-xs text-indigo-700">
            Connect your own <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="underline font-medium">OpenRouter API key</a> to power all AI features.
            OpenRouter provides access to Claude, GPT-4o, Gemini, and more. Free tier on OpenRouter includes generous credits.
          </p>
        </div>

        {llmSettings?.hasKey && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>API key configured <span className="font-mono text-xs">{llmSettings.keyMasked}</span></span>
          </div>
        )}

        <div className="space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">OpenRouter API Key</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showKey ? 'text' : 'password'}
                className="input pl-9 pr-20 font-mono text-sm"
                placeholder={llmSettings?.hasKey ? '••••••••••••••••' : 'sk-or-v1-...'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <button
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Get your key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">openrouter.ai/keys</a>
            </p>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${testResult.success ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testResult.success ? `Connection successful! Using ${testResult.model}` : testResult.error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              onClick={testKey}
              disabled={testing || (!apiKey && !llmSettings?.hasKey)}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
            <button
              className="btn-primary text-sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !apiKey.trim()}
            >
              {saved ? 'Saved!' : save.isPending ? 'Saving…' : 'Save Key'}
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function NotificationsSection() {
  const [slackWebhook, setSlackWebhook] = useState('');
  const [prefs, setPrefs] = useState({
    evidenceExpiry: true,
    testFailures: true,
    taskAssignments: true,
    weeklyDigest: true,
    auditorRfis: true,
  });
  const [saved, setSaved] = useState(false);

  const { data: orgData } = useQuery({
    queryKey: ['org'],
    queryFn: () => settingsApi.getOrg(),
  });

  useEffect(() => {
    const s = (orgData?.settings ?? {}) as Record<string, any>;
    if (s.slackWebhook) setSlackWebhook(s.slackWebhook as string);
    if (s.notificationPrefs) setPrefs(p => ({ ...p, ...(s.notificationPrefs as typeof p) }));
  }, [orgData]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateOrg({
      settings: { ...(orgData as any)?.settings ?? {}, slackWebhook, notificationPrefs: prefs }
    } as any),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const PREF_LABELS: Record<keyof typeof prefs, string> = {
    evidenceExpiry: 'Evidence expiry alerts (30 days before)',
    testFailures: 'Control test failure alerts',
    taskAssignments: 'Task assignment notifications',
    weeklyDigest: 'Weekly compliance digest (Mondays)',
    auditorRfis: 'Auditor RFI notifications',
  };

  return (
    <Section title="Notifications" icon={Bell}>
      <div className="space-y-5 max-w-md">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Email Notifications</p>
          <div className="space-y-2.5">
            {(Object.entries(PREF_LABELS) as [keyof typeof prefs, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={e => setPrefs(p => ({ ...p, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Webhook className="w-3.5 h-3.5 text-gray-400" /> Slack Webhook URL (optional)</span>
          </label>
          <input
            type="url"
            className="input text-sm font-mono"
            placeholder="https://hooks.slack.com/services/..."
            value={slackWebhook}
            onChange={e => setSlackWebhook(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Get this from your Slack app's Incoming Webhooks settings.</p>
        </div>

        <button className="btn-primary text-sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {saved ? 'Saved!' : save.isPending ? 'Saving…' : 'Save preferences'}
        </button>
      </div>
    </Section>
  );
}

function RetentionSection() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ documentRetentionDays: 2555, evidenceRetentionDays: 2555 });
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({
    queryKey: ['retention-settings'],
    queryFn: () => settingsApi.getRetentionSettings(),
  });

  useEffect(() => {
    if (data) setForm({
      documentRetentionDays: data.documentRetentionDays ?? 2555,
      evidenceRetentionDays: data.evidenceRetentionDays ?? 2555,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () => settingsApi.updateRetentionSettings(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  const PRESETS = [
    { label: '1 year',   days: 365 },
    { label: '3 years',  days: 1095 },
    { label: '5 years',  days: 1825 },
    { label: '7 years',  days: 2555 },
    { label: '10 years', days: 3650 },
  ];

  return (
    <Section title="Data Retention" icon={Lock}>
      <div className="space-y-6 max-w-md">
        <p className="text-xs text-gray-500">
          Retention policies control when documents and evidence are automatically archived
          and purged. Required for ISO A.5.33 and SOC 2 CC6.5.
        </p>

        {(['documentRetentionDays', 'evidenceRetentionDays'] as const).map((field) => (
          <div key={field}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field === 'documentRetentionDays' ? 'Document retention' : 'Evidence retention'}
            </label>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min={30}
                max={7300}
                className="input w-28 text-sm"
                value={form[field]}
                onChange={e => setForm(f => ({ ...f, [field]: parseInt(e.target.value, 10) || 2555 }))}
              />
              <span className="text-sm text-gray-500">days</span>
              <span className="text-xs text-gray-400">
                (~{Math.round(form[field] / 365 * 10) / 10} years)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, [field]: p.days }))}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form[field] === p.days
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <button
          className="btn-primary"
          onClick={() => save.mutate()}
          disabled={save.isPending}
        >
          {saved ? 'Saved!' : save.isPending ? 'Saving…' : 'Save retention policy'}
        </button>
      </div>
    </Section>
  );
}

function DangerZoneSection() {
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const reset = useMutation({
    mutationFn: () => settingsApi.resetDemo(),
    onSuccess: () => {
      // Clear query cache so stale data doesn't persist
      if (typeof window !== 'undefined') {
        window.location.href = '/onboarding';
      }
    },
  });

  return (
    <div className="card p-6 border-red-200 bg-red-50/30">
      <div className="flex items-center gap-2.5 mb-4">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-red-500 shrink-0" />
                Restart Onboarding
              </p>
              <p className="text-xs text-gray-500">
                Wipes all compliance data for this organisation — controls, evidence, tasks, policies,
                risks, workflows, journeys, scope documents, and readiness scores.
                Your user account and LLM key are preserved. Use this to experience the full
                onboarding flow from scratch.
              </p>
            </div>
            {!confirm && (
              <button
                onClick={() => setConfirm(true)}
                className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-300
                           text-red-600 hover:bg-red-50 transition-colors"
              >
                Reset data
              </button>
            )}
          </div>

          {confirm && (
            <div className="mt-4 space-y-3 border-t border-red-100 pt-4">
              <p className="text-xs font-medium text-red-700">
                Type <span className="font-mono bg-red-100 px-1 rounded">RESET</span> to confirm
              </p>
              <input
                autoFocus
                className="w-full text-sm border border-red-300 rounded-lg px-3 py-2 focus:outline-none
                           focus:ring-2 focus:ring-red-400 font-mono"
                placeholder="Type RESET"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirm(false); setConfirmText(''); }}
                  className="flex-1 text-xs py-2 rounded-lg border border-gray-200 text-gray-500
                             hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => reset.mutate()}
                  disabled={confirmText !== 'RESET' || reset.isPending}
                  className="flex-1 text-xs py-2 rounded-lg bg-red-600 text-white font-medium
                             hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center justify-center gap-1.5"
                >
                  {reset.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Resetting…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Wipe &amp; restart
                    </>
                  )}
                </button>
              </div>
              {reset.isError && (
                <p className="text-xs text-red-600">
                  Reset failed — please try again or contact support.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { clearUser } = useAuthStore();

  async function signOutAll() {
    try { await settingsApi.logoutAllSessions(); } catch {}
    clearUser();
    router.push('/login');
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div className="mb-2">
        <h1>Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and organization</p>
      </div>

      <ProfileSection />
      <PasswordSection />
      <OrgSection />
      <AIConfigSection />
      <NotificationsSection />
      <RetentionSection />

      <div className="card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <LogOut className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Sessions</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Sign out of all devices and sessions.</p>
        <button className="btn-secondary text-danger-700 border-danger-200 hover:bg-danger-50" onClick={signOutAll}>
          Sign out everywhere
        </button>
      </div>

      <DangerZoneSection />
    </div>
  );
}
