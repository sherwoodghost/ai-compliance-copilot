'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, SsoConfigInput } from '@/lib/api/settings';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { User, Building, Lock, LogOut, Bot, Key, CheckCircle2, XCircle, Loader2, Bell, Webhook, RotateCcw, AlertTriangle, ShieldCheck, ExternalLink, Copy, Eye, EyeOff, ToggleLeft, ToggleRight, Layers, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

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

function SsoSection() {
  const qc = useQueryClient();

  const { data: ssoConfig, isLoading, isError } = useQuery({
    queryKey: ['sso-config'],
    queryFn:  () => settingsApi.getSsoConfig(),
    retry:    false,  // 404 = not configured yet, that's fine
  });

  const isConfigured = !isError && !!ssoConfig;
  const isEnabled    = ssoConfig?.organization?.ssoEnabled ?? false;
  const isVerified   = ssoConfig?.isVerified ?? false;

  const [form, setForm] = useState<SsoConfigInput>({
    provider:           'saml',
    idpEntityId:        '',
    idpSsoUrl:          '',
    idpCertificate:     '',
    emailAttribute:     'email',
    firstNameAttribute: 'firstName',
    lastNameAttribute:  'lastName',
  });
  const [showCert,     setShowCert]     = useState(false);
  const [testResult,   setTestResult]   = useState<{ ok: boolean; error?: string } | null>(null);
  const [testing,      setTesting]      = useState(false);
  const [savedMsg,     setSavedMsg]     = useState('');

  // Pre-fill form when config loads
  useEffect(() => {
    if (ssoConfig) {
      setForm(f => ({
        ...f,
        provider:           ssoConfig.provider           ?? 'saml',
        idpEntityId:        ssoConfig.idpEntityId        ?? '',
        idpSsoUrl:          ssoConfig.idpSsoUrl          ?? '',
        idpCertificate:     '',     // never pre-fill cert (backend returns '[configured]')
        emailAttribute:     ssoConfig.emailAttribute     ?? 'email',
        firstNameAttribute: ssoConfig.firstNameAttribute ?? 'firstName',
        lastNameAttribute:  ssoConfig.lastNameAttribute  ?? 'lastName',
      }));
    }
  }, [ssoConfig]);

  const save = useMutation({
    mutationFn: () => {
      const dto: SsoConfigInput = { ...form };
      // Don't send empty cert (would overwrite stored value with nothing)
      if (!dto.idpCertificate?.trim()) delete dto.idpCertificate;
      return settingsApi.upsertSsoConfig(dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sso-config'] });
      setSavedMsg('Configuration saved!');
      setTestResult(null);
      setTimeout(() => setSavedMsg(''), 3000);
    },
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => settingsApi.toggleSso(enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sso-config'] }),
  });

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await settingsApi.testSsoConfig();
      setTestResult(r);
      if (r.ok) qc.invalidateQueries({ queryKey: ['sso-config'] });
    } catch (e: any) {
      setTestResult({ ok: false, error: e.response?.data?.message ?? 'Connection failed' });
    } finally {
      setTesting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  const acsUrl    = ssoConfig?.acsUrl    ?? '';
  const entityId  = ssoConfig?.spEntityId ?? '';

  return (
    <Section title="SAML Single Sign-On (SSO)" icon={ShieldCheck}>
      <div className="space-y-6">
        {/* Info banner */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
          <p className="text-sm font-semibold text-indigo-900 mb-1">Enterprise SSO via SAML 2.0</p>
          <p className="text-xs text-indigo-700">
            Connect your Identity Provider (Okta, Azure AD, Google Workspace, etc.) to allow your
            team to sign in with company credentials. Users are provisioned automatically on first login.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center gap-2">
            {isConfigured && isVerified ? (
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : isConfigured ? (
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {isConfigured && isVerified ? 'Verified & ready' : isConfigured ? 'Configured — not yet verified' : 'Not configured'}
            </span>
            {isConfigured && ssoConfig?.lastTestedAt && (
              <span className="text-xs text-gray-400">
                · Last tested {new Date(ssoConfig.lastTestedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {isConfigured && isVerified && (
            <button
              onClick={() => toggle.mutate(!isEnabled)}
              disabled={toggle.isPending}
              className="flex items-center gap-1.5 text-sm font-medium transition-colors"
            >
              {isEnabled ? (
                <>
                  <ToggleRight className="w-5 h-5 text-green-500" />
                  <span className="text-green-700">Enabled</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                  <span className="text-gray-500">Disabled</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* SP metadata (read-only, show after config exists) */}
        {isConfigured && (acsUrl || entityId) && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Service Provider Details (copy into your IdP)
            </p>
            {[
              { label: 'ACS URL (Callback)',  value: acsUrl },
              { label: 'Entity ID / Issuer',  value: entityId },
            ].map(({ label, value }) => (
              value ? (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 truncate font-mono text-gray-700">
                      {value}
                    </code>
                    <button
                      onClick={() => copyToClipboard(value)}
                      title="Copy"
                      className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors shrink-0"
                    >
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                </div>
              ) : null
            ))}
            {ssoConfig?.organization?.slug && (
              <a
                href={`/api/v1/auth/sso/${ssoConfig.organization.slug}/metadata`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Download SP metadata XML
              </a>
            )}
          </div>
        )}

        {/* Config form */}
        <div className="space-y-4 max-w-lg">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Identity Provider Configuration
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IdP SSO URL</label>
            <input
              type="url"
              className="input text-sm font-mono"
              placeholder="https://your-idp.example.com/sso/saml"
              value={form.idpSsoUrl ?? ''}
              onChange={e => setForm(f => ({ ...f, idpSsoUrl: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">The SSO endpoint from your IdP (Okta, Azure AD, etc.)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">IdP Entity ID</label>
            <input
              type="text"
              className="input text-sm font-mono"
              placeholder="https://your-idp.example.com/issuer"
              value={form.idpEntityId ?? ''}
              onChange={e => setForm(f => ({ ...f, idpEntityId: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              IdP Certificate (X.509)
              {ssoConfig?.idpCertificate === '[configured]' && (
                <span className="ml-2 text-xs text-green-600 font-normal">✓ Certificate on file</span>
              )}
            </label>
            <div className="relative">
              <textarea
                className="input text-xs font-mono resize-none"
                rows={showCert ? 6 : 2}
                placeholder={ssoConfig?.idpCertificate === '[configured]' ? 'Leave blank to keep existing certificate' : 'Paste PEM-encoded certificate (-----BEGIN CERTIFICATE----- ...)'}
                value={form.idpCertificate ?? ''}
                onChange={e => setForm(f => ({ ...f, idpCertificate: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowCert(v => !v)}
                className="absolute right-2 top-2 p-1 rounded text-gray-400 hover:text-gray-600"
              >
                {showCert ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Attribute mapping */}
          <details className="border border-gray-200 rounded-xl overflow-hidden">
            <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 select-none">
              Attribute Mapping (advanced)
            </summary>
            <div className="px-4 pb-4 pt-2 space-y-3 bg-gray-50">
              <p className="text-xs text-gray-500">
                Map SAML attributes to user fields. Defaults work for most IdPs.
              </p>
              {([
                { key: 'emailAttribute',     label: 'Email attribute',      placeholder: 'email' },
                { key: 'firstNameAttribute', label: 'First name attribute', placeholder: 'firstName' },
                { key: 'lastNameAttribute',  label: 'Last name attribute',  placeholder: 'lastName' },
              ] as { key: keyof SsoConfigInput; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-xs text-gray-600 w-36 shrink-0">{label}</label>
                  <input
                    type="text"
                    className="input text-xs font-mono flex-1"
                    placeholder={placeholder}
                    value={(form[key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </details>
        </div>

        {/* Feedback */}
        {savedMsg && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {savedMsg}
          </div>
        )}
        {save.isError && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <XCircle className="w-4 h-4 shrink-0" />
            {(save.error as any)?.response?.data?.message ?? 'Failed to save configuration'}
          </div>
        )}
        {testResult && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 ${testResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {testResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {testResult.ok ? 'IdP is reachable — configuration verified!' : (testResult.error ?? 'Connection failed')}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            className="btn-primary text-sm"
            onClick={() => save.mutate()}
            disabled={save.isPending || (!form.idpSsoUrl?.trim() && !form.idpEntityId?.trim())}
          >
            {save.isPending ? 'Saving…' : isConfigured ? 'Update configuration' : 'Save configuration'}
          </button>
          {isConfigured && (
            <button
              className="btn-secondary text-sm flex items-center gap-1.5"
              onClick={testConnection}
              disabled={testing}
            >
              {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {testing ? 'Testing…' : 'Test connection'}
            </button>
          )}
        </div>
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

// ── Frameworks section ────────────────────────────────────────────────────────

const ALL_FRAMEWORKS = [
  { id: 'soc2',     name: 'SOC 2',       version: 'Trust Services Criteria 2017',  color: 'emerald', href: '/frameworks/soc2',     dashHref: '/controls?framework=SOC2',    category: 'Security & Privacy' },
  { id: 'iso27001', name: 'ISO 27001',   version: 'ISO/IEC 27001:2022',            color: 'indigo',  href: '/frameworks/iso27001', dashHref: '/controls?framework=ISO27001', category: 'Security & Privacy' },
  { id: 'hipaa',    name: 'HIPAA',       version: '45 CFR Parts 160 & 164',        color: 'rose',    href: '/frameworks/hipaa',    dashHref: '/hipaa',                       category: 'Security & Privacy' },
  { id: 'pci-dss',  name: 'PCI DSS',     version: 'PCI DSS v4.0',                  color: 'amber',   href: '/frameworks/pci-dss',  dashHref: '/pci-dss',                     category: 'Security & Privacy' },
  { id: 'gdpr',     name: 'GDPR',        version: 'Regulation (EU) 2016/679',      color: 'violet',  href: '/frameworks/gdpr',     dashHref: '/gdpr',                        category: 'Security & Privacy' },
  { id: 'fedramp',  name: 'FedRAMP',     version: 'NIST SP 800-53 Rev 5 Moderate', color: 'sky',     href: '/frameworks/fedramp',  dashHref: '/fedramp',                     category: 'Government & Federal' },
  { id: 'nist-csf', name: 'NIST CSF',    version: 'NIST CSF 2.0',                  color: 'orange',  href: '/frameworks/nist-csf', dashHref: '/nist-csf',                    category: 'Government & Federal' },
  { id: 'iso9001',  name: 'ISO 9001',    version: 'ISO 9001:2015',                 color: 'teal',    href: '/frameworks/iso9001',  dashHref: '/iso9001',                     category: 'Quality & Management' },
  { id: 'iso14001', name: 'ISO 14001',   version: 'ISO 14001:2015',                color: 'green',   href: '/frameworks/iso14001', dashHref: '/iso14001',                    category: 'Quality & Management' },
  { id: 'iso45001', name: 'ISO 45001',   version: 'ISO 45001:2018',                color: 'yellow',  href: '/frameworks/iso45001', dashHref: '/iso45001',                    category: 'Quality & Management' },
] as const;

const COLOR_CLASSES: Record<string, { badge: string; dot: string }> = {
  emerald: { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  indigo:  { badge: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
  rose:    { badge: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500' },
  amber:   { badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  violet:  { badge: 'bg-violet-100 text-violet-700',   dot: 'bg-violet-500' },
  sky:     { badge: 'bg-sky-100 text-sky-700',         dot: 'bg-sky-500' },
  orange:  { badge: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  teal:    { badge: 'bg-teal-100 text-teal-700',       dot: 'bg-teal-500' },
  green:   { badge: 'bg-green-100 text-green-700',     dot: 'bg-green-500' },
  yellow:  { badge: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-500' },
};

function FrameworksSection() {
  const queryClient = useQueryClient();
  const { data: profileData } = useQuery({
    queryKey: ['onboarding-profile'],
    queryFn: async () => {
      const { data } = await import('@/lib/api/client').then(m => m.apiClient.get('/onboarding/profile'));
      return data?.data ?? data;
    },
  });

  const activeRaw: string[] = profileData?.complianceGoals?.targetFrameworks ?? [];
  const activeSet = new Set(activeRaw.map((f: string) => {
    const m: Record<string, string> = {
      SOC2: 'soc2', SOC2_TYPE1: 'soc2', SOC2_TYPE2: 'soc2',
      ISO27001: 'iso27001', HIPAA: 'hipaa', PCI_DSS: 'pci-dss', 'PCI-DSS': 'pci-dss',
      GDPR: 'gdpr', FEDRAMP: 'fedramp', ISO9001: 'iso9001',
      NIST_CSF: 'nist-csf', ISO14001: 'iso14001', ISO45001: 'iso45001',
    };
    return m[f] ?? f.toLowerCase();
  }));

  const categories = [...new Set(ALL_FRAMEWORKS.map(f => f.category))];

  return (
    <Section title="Active Frameworks" icon={Layers}>
      <div className="space-y-6">
        <p className="text-sm text-gray-500">
          These are the compliance frameworks configured for your organisation during onboarding.
          To add or remove frameworks, re-run the onboarding interview or contact support.
        </p>

        {categories.map(cat => (
          <div key={cat}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{cat}</p>
            <div className="space-y-2">
              {ALL_FRAMEWORKS.filter(f => f.category === cat).map(fw => {
                const active = activeSet.has(fw.id);
                const colors = COLOR_CLASSES[fw.color] ?? COLOR_CLASSES.emerald;
                return (
                  <div key={fw.id} className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60',
                  )}>
                    <div className="flex items-center gap-3">
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', active ? colors.dot : 'bg-gray-300')} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{fw.name}</span>
                          {active && (
                            <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', colors.badge)}>Active</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{fw.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <Link
                          href={fw.dashHref}
                          className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 px-2 py-1 rounded-md hover:bg-brand-50 transition-colors"
                        >
                          Open Dashboard <ChevronRight className="w-3 h-3" />
                        </Link>
                      )}
                      <Link
                        href={fw.href}
                        target="_blank"
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                      >
                        Reference <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-brand-50 border border-brand-100 rounded-lg p-4">
          <p className="text-sm text-brand-700 font-medium">Want to add a new framework?</p>
          <p className="text-xs text-brand-600 mt-1">
            Ask the Compliance Copilot — it can guide you through activating HIPAA, FedRAMP, GDPR, ISO 14001, or any other framework for your organisation.
          </p>
          <Link href="/overview" className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-lg transition-colors">
            Open Compliance Copilot <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </Section>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────

type SettingsTab = 'account' | 'organization' | 'frameworks' | 'ai' | 'security' | 'advanced';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'account',      label: 'Account',      icon: User },
  { id: 'organization', label: 'Organization',  icon: Building },
  { id: 'frameworks',   label: 'Frameworks',    icon: Layers },
  { id: 'ai',          label: 'AI & Integrations', icon: Bot },
  { id: 'security',    label: 'Security',      icon: ShieldCheck },
  { id: 'advanced',    label: 'Advanced',      icon: Lock },
];

// ── Sessions sub-section ──────────────────────────────────────────────────────

function SessionsSection({ onSignOutAll }: { onSignOutAll: () => void }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-2.5 mb-4">
        <LogOut className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-900">Sessions</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Sign out of all devices and sessions.</p>
      <button className="btn-secondary text-danger-700 border-danger-200 hover:bg-danger-50" onClick={onSignOutAll}>
        Sign out everywhere
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { clearUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  async function signOutAll() {
    try { await settingsApi.logoutAllSessions(); } catch {}
    clearUser();
    router.push('/login');
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1>Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and organization</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="space-y-6">
        {activeTab === 'account' && (
          <>
            <ProfileSection />
            <PasswordSection />
            <SessionsSection onSignOutAll={signOutAll} />
          </>
        )}

        {activeTab === 'organization' && (
          <>
            <OrgSection />
            <NotificationsSection />
          </>
        )}

        {activeTab === 'frameworks' && (
          <>
            <FrameworksSection />
          </>
        )}

        {activeTab === 'ai' && (
          <>
            <AIConfigSection />
          </>
        )}

        {activeTab === 'security' && (
          <>
            <SsoSection />
            <RetentionSection />
          </>
        )}

        {activeTab === 'advanced' && (
          <>
            <DangerZoneSection />
          </>
        )}
      </div>
    </div>
  );
}
