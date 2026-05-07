'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations';
import {
  CheckCircle, XCircle, RefreshCw, Trash2, Plus, X,
  Mail, Lock, Shield, Cloud, Code, Monitor, Users,
  Laptop, Ticket, Activity, ChevronRight, Search,
  AlertTriangle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Provider Registry ────────────────────────────────────────────────────────

type ProviderStatus = 'available' | 'request_access';

type Provider = {
  key: string;
  label: string;
  category: string;
  description: string;
  controlsCovered: string[];
  evidenceTypes: string[];
  status: ProviderStatus;
  authType?: string;
  fields?: { name: string; label: string; type: string; placeholder?: string }[];
};

const PROVIDERS: Provider[] = [
  // ── Identity
  {
    key: 'okta', label: 'Okta', category: 'Identity', status: 'available',
    description: 'MFA enforcement, user access reviews, SSO policies',
    controlsCovered: ['CC6.1', 'CC6.2', 'CC6.3', 'A.8.2', 'A.8.3'],
    evidenceTypes: ['mfa_config', 'user_access_list', 'sso_policy'],
    fields: [
      { name: 'domain', label: 'Okta Domain', type: 'text', placeholder: 'yourorg.okta.com' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  {
    key: 'google_workspace', label: 'Google Workspace', category: 'Identity', status: 'available',
    description: '2-Step Verification, admin activity logs, device policies',
    controlsCovered: ['CC6.1', 'CC6.3', 'A.8.2'],
    evidenceTypes: ['2sv_config', 'admin_activity_log', 'device_policy'],
    fields: [
      { name: 'serviceAccountJson', label: 'Service Account JSON', type: 'password' },
      { name: 'adminEmail', label: 'Admin Email', type: 'text' },
    ],
  },
  {
    key: 'azure_ad', label: 'Azure AD', category: 'Identity', status: 'available',
    description: 'Conditional access, MFA status, privileged identity management',
    controlsCovered: ['CC6.1', 'CC6.2', 'A.8.2', 'A.8.3'],
    evidenceTypes: ['conditional_access', 'mfa_status', 'pim_config'],
    fields: [
      { name: 'tenantId', label: 'Tenant ID', type: 'text' },
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client Secret', type: 'password' },
    ],
  },
  // ── Cloud
  {
    key: 'aws', label: 'AWS', category: 'Cloud', status: 'available',
    description: 'IAM policies, S3 encryption, CloudTrail, GuardDuty findings',
    controlsCovered: ['CC6.1', 'CC7.1', 'CC7.2', 'A.12.4'],
    evidenceTypes: ['iam_policy', 's3_encryption', 'cloudtrail_logs', 'guardduty'],
    fields: [
      { name: 'accessKeyId', label: 'Access Key ID', type: 'text' },
      { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
      { name: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
    ],
  },
  {
    key: 'gcp', label: 'Google Cloud', category: 'Cloud', status: 'available',
    description: 'IAM bindings, Cloud Audit Logs, Security Command Center',
    controlsCovered: ['CC6.1', 'CC7.1', 'A.12.4'],
    evidenceTypes: ['iam_policy', 'audit_logs', 'scc_findings'],
    fields: [
      { name: 'serviceAccountJson', label: 'Service Account JSON', type: 'password' },
      { name: 'projectId', label: 'Project ID', type: 'text' },
    ],
  },
  // ── Code
  {
    key: 'github', label: 'GitHub', category: 'Code', status: 'available',
    description: 'Branch protection, secret scanning, Dependabot, code review',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['branch_protection', 'secret_scan', 'dependabot_alerts'],
    fields: [
      { name: 'token', label: 'Personal Access Token', type: 'password' },
      { name: 'org', label: 'Organization', type: 'text' },
    ],
  },
  {
    key: 'gitlab', label: 'GitLab', category: 'Code', status: 'available',
    description: 'Merge request approvals, pipeline security, secret detection',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['mr_approvals', 'pipeline_config', 'secret_detection'],
    fields: [
      { name: 'token', label: 'Personal Access Token', type: 'password' },
      { name: 'baseUrl', label: 'GitLab URL', type: 'text', placeholder: 'https://gitlab.com' },
    ],
  },
  // ── Monitoring
  {
    key: 'datadog', label: 'Datadog', category: 'Monitoring', status: 'available',
    description: 'Security signals, compliance monitors, anomaly detection',
    controlsCovered: ['CC7.1', 'CC7.2', 'A.12.4'],
    evidenceTypes: ['security_signals', 'monitors', 'anomaly_alerts'],
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
      { name: 'appKey', label: 'Application Key', type: 'password' },
    ],
  },
  // ── MDM
  {
    key: 'jamf', label: 'Jamf', category: 'MDM', status: 'available',
    description: 'Device compliance, disk encryption, OS patch level',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'disk_encryption', 'patch_level'],
    fields: [
      { name: 'url', label: 'Jamf URL', type: 'text', placeholder: 'https://yourorg.jamfcloud.com' },
      { name: 'username', label: 'Username', type: 'text' },
      { name: 'password', label: 'Password', type: 'password' },
    ],
  },
  // ── Ticketing
  {
    key: 'jira', label: 'Jira', category: 'Ticketing', status: 'available',
    description: 'Vulnerability tickets, change management, audit trail',
    controlsCovered: ['CC8.1', 'A.12.1'],
    evidenceTypes: ['vulnerability_tickets', 'change_management'],
    fields: [
      { name: 'domain', label: 'Atlassian Domain', type: 'text', placeholder: 'yourorg.atlassian.net' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'apiToken', label: 'API Token', type: 'password' },
    ],
  },
  // ── HR
  {
    key: 'rippling', label: 'Rippling', category: 'HR', status: 'available',
    description: 'Employee onboarding/offboarding, access provisioning',
    controlsCovered: ['CC6.2', 'CC6.3', 'A.7.2'],
    evidenceTypes: ['employee_list', 'offboarding_log', 'access_provisioning'],
    fields: [
      { name: 'apiKey', label: 'API Key', type: 'password' },
    ],
  },
  // ── Request access
  {
    key: 'crowdstrike', label: 'CrowdStrike', category: 'Security', status: 'request_access',
    description: 'Endpoint detection, vulnerability assessment, threat intelligence',
    controlsCovered: ['CC7.1', 'CC7.2'],
    evidenceTypes: ['edr_alerts', 'vulnerability_assessment'],
  },
  {
    key: 'snyk', label: 'Snyk', category: 'Security', status: 'request_access',
    description: 'Container and dependency vulnerability scanning',
    controlsCovered: ['CC8.1', 'A.12.6'],
    evidenceTypes: ['vulnerability_scan'],
  },
  {
    key: 'slack', label: 'Slack', category: 'Collaboration', status: 'request_access',
    description: 'Message retention, DLP policies, workspace audit logs',
    controlsCovered: ['CC6.7', 'A.12.4'],
    evidenceTypes: ['audit_logs', 'dlp_policy'],
  },
  {
    key: 'servicenow', label: 'ServiceNow', category: 'Ticketing', status: 'request_access',
    description: 'ITSM workflows, change management, incident response',
    controlsCovered: ['CC8.1'],
    evidenceTypes: ['change_records', 'incident_records'],
  },
  {
    key: 'bamboohr', label: 'BambooHR', category: 'HR', status: 'request_access',
    description: 'Employee records, org chart, offboarding workflows',
    controlsCovered: ['CC6.2', 'A.7.2'],
    evidenceTypes: ['employee_list', 'offboarding_log'],
  },
  {
    key: 'kandji', label: 'Kandji', category: 'MDM', status: 'request_access',
    description: 'Apple device management, compliance baselines',
    controlsCovered: ['CC6.7', 'A.8.1'],
    evidenceTypes: ['device_compliance', 'patch_level'],
  },
];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Identity:      Users,
  Cloud:         Cloud,
  Code:          Code,
  Monitoring:    Activity,
  MDM:           Laptop,
  Ticketing:     Ticket,
  HR:            Users,
  Security:      Shield,
  Collaboration: Mail,
};

// ─── Connect Modal ────────────────────────────────────────────────────────────

function ConnectModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const connect = useMutation({
    mutationFn: () => integrationsApi.connect(provider.key, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Connection failed. Check your credentials.'),
  });

  const CategoryIcon = CATEGORY_ICONS[provider.category] ?? Shield;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <CategoryIcon className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Connect {provider.label}</h2>
              <p className="text-xs text-gray-400">{provider.category}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-5">{provider.description}</p>

          {/* Controls covered */}
          {provider.controlsCovered.length > 0 && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span className="text-xs text-gray-400">Controls:</span>
              {provider.controlsCovered.slice(0, 4).map((c) => (
                <span key={c} className="text-xs font-mono bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded">
                  {c}
                </span>
              ))}
              {provider.controlsCovered.length > 4 && (
                <span className="text-xs text-gray-400">+{provider.controlsCovered.length - 4} more</span>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {(provider.fields ?? []).map((f) => (
              <div key={f.name}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  className="input"
                  placeholder={f.placeholder}
                  value={fields[f.name] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1"
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
          >
            {connect.isPending ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Access Modal ─────────────────────────────────────────────────────

function RequestModal({ provider, onClose }: { provider: Provider; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-brand-600" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">
            {provider.label} — Coming Soon
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {provider.label} integration is in our roadmap. We'll notify you as soon as it's available.
          </p>
          <div className="flex gap-3">
            <button className="btn-secondary flex-1" onClick={onClose}>Dismiss</button>
            <button className="btn-primary flex-1" onClick={onClose}>Request Early Access</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Connected Card ───────────────────────────────────────────────────────────

function ConnectedCard({ integration }: { integration: any }) {
  const qc = useQueryClient();
  const providerMeta = PROVIDERS.find((p) => p.key === integration.provider);
  const CategoryIcon = providerMeta ? (CATEGORY_ICONS[providerMeta.category] ?? Shield) : Shield;
  const isActive = integration.status === 'active';

  const sync = useMutation({
    mutationFn: () => integrationsApi.sync(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const disconnect = useMutation({
    mutationFn: () => integrationsApi.disconnect(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  return (
    <div className={cn(
      'bg-white border rounded-xl p-4 flex items-center gap-4 transition-all',
      isActive ? 'border-gray-200 hover:border-gray-300' : 'border-gray-200 opacity-60',
    )}>
      <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
        <CategoryIcon className="w-5 h-5 text-gray-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900">
            {providerMeta?.label ?? integration.provider}
          </p>
          {isActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <CheckCircle className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <XCircle className="w-3 h-3" /> {integration.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {integration.lastSyncedAt && (
            <span>Synced {new Date(integration.lastSyncedAt).toLocaleDateString()}</span>
          )}
          {providerMeta?.controlsCovered && (
            <span>{providerMeta.controlsCovered.length} controls covered</span>
          )}
        </div>

        {integration.errorMessage && (
          <p className="text-xs text-red-500 mt-1">{integration.errorMessage}</p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1"
          onClick={() => sync.mutate()}
          disabled={sync.isPending || !isActive}
        >
          <RefreshCw className={cn('w-3 h-3', sync.isPending && 'animate-spin')} />
          Sync
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
          title="Disconnect"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Available Provider Card ──────────────────────────────────────────────────

function ProviderCard({ provider, onConnect }: {
  provider: Provider;
  onConnect: (p: Provider) => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[provider.category] ?? Shield;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300
                    hover:shadow-sm transition-all duration-150 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <CategoryIcon className="w-4 h-4 text-gray-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-sm font-semibold text-gray-900">{provider.label}</p>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            {provider.category}
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-2 leading-relaxed">{provider.description}</p>

        {/* Controls */}
        <div className="flex items-center gap-1 flex-wrap">
          {provider.controlsCovered.slice(0, 3).map((c) => (
            <span key={c} className="text-xs font-mono bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
              {c}
            </span>
          ))}
          {provider.controlsCovered.length > 3 && (
            <span className="text-xs text-gray-400">+{provider.controlsCovered.length - 3}</span>
          )}
        </div>
      </div>

      <button
        className={cn(
          'shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors',
          provider.status === 'available'
            ? 'bg-brand-600 text-white hover:bg-brand-700'
            : 'border border-gray-200 text-gray-600 hover:bg-gray-50',
        )}
        onClick={() => onConnect(provider)}
      >
        {provider.status === 'available' ? (
          <>
            <Plus className="w-3 h-3" /> Connect
          </>
        ) : (
          <>
            <ChevronRight className="w-3 h-3" /> Request
          </>
        )}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null);
  const [requestingProvider, setRequestingProvider] = useState<Provider | null>(null);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
  });

  const integrations: any[] = data ?? [];
  const connectedKeys = new Set(integrations.map((i) => i.provider));

  const available = PROVIDERS.filter((p) => !connectedKeys.has(p.key));

  const filteredAvailable = search.trim()
    ? available.filter((p) =>
        p.label.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase()),
      )
    : available;

  const categories = [...new Set(filteredAvailable.map((p) => p.category))];

  function handleConnect(p: Provider) {
    if (p.status === 'available') {
      setConnectingProvider(p);
    } else {
      setRequestingProvider(p);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Integrations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Connect your tools to automatically collect compliance evidence
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
          <span className="font-semibold text-gray-700">{integrations.length}</span> connected ·
          <span className="font-semibold text-gray-700">{PROVIDERS.filter(p => p.status === 'available').length}</span> available
        </div>
      </div>

      {/* Connected section */}
      {isLoading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : integrations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Connected</h2>
          <div className="space-y-2">
            {integrations.map((i) => (
              <ConnectedCard key={i.id} integration={i} />
            ))}
          </div>
        </div>
      )}

      {/* Available section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Available ({filteredAvailable.length})
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent
                         w-52"
            />
          </div>
        </div>

        {categories.map((category) => {
          const categoryProviders = filteredAvailable.filter((p) => p.category === category);
          if (categoryProviders.length === 0) return null;

          return (
            <div key={category} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                {(() => {
                  const Icon = CATEGORY_ICONS[category] ?? Shield;
                  return <Icon className="w-3.5 h-3.5 text-gray-400" />;
                })()}
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {category}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categoryProviders.map((provider) => (
                  <ProviderCard
                    key={provider.key}
                    provider={provider}
                    onConnect={handleConnect}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filteredAvailable.length === 0 && search.trim() && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No integrations match "{search}".
          </div>
        )}
      </div>

      {/* Modals */}
      {connectingProvider && (
        <ConnectModal
          provider={connectingProvider}
          onClose={() => setConnectingProvider(null)}
        />
      )}
      {requestingProvider && (
        <RequestModal
          provider={requestingProvider}
          onClose={() => setRequestingProvider(null)}
        />
      )}
    </div>
  );
}
