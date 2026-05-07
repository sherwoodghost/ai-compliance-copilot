'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { User, Building, Lock, LogOut, Bot, Key, CheckCircle2, XCircle, Loader2, Bell, Webhook } from 'lucide-react';

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
    mutationFn: () => apiClient.patch('/users/me', form).then((r) => r.data),
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
    mutationFn: () => apiClient.post('/users/me/change-password', {
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
    queryFn: () => apiClient.get('/organizations/me').then((r) => r.data),
  });

  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);

  const update = useMutation({
    mutationFn: () => apiClient.patch('/organizations/me', { name }),
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
    queryFn: () => apiClient.get('/organizations/me/llm-settings').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: () => apiClient.patch('/organizations/me/llm-settings', { orgApiKey: apiKey }),
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
      const r = await apiClient.post('/organizations/me/llm-settings/test', {
        apiKey: apiKey || undefined,
      });
      setTestResult(r.data);
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
    queryFn: () => apiClient.get('/organizations/me').then(r => r.data),
  });

  useEffect(() => {
    const s = orgData?.settings ?? {};
    if (s.slackWebhook) setSlackWebhook(s.slackWebhook);
    if (s.notificationPrefs) setPrefs(p => ({ ...p, ...s.notificationPrefs }));
  }, [orgData]);

  const save = useMutation({
    mutationFn: () => apiClient.patch('/organizations/me', {
      settings: { ...(orgData?.settings ?? {}), slackWebhook, notificationPrefs: prefs }
    }),
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

export default function SettingsPage() {
  const router = useRouter();
  const { clearUser } = useAuthStore();

  async function signOutAll() {
    try { await apiClient.post('/auth/logout-all'); } catch {}
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
    </div>
  );
}
