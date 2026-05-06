'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '@/lib/api/integrations';
import { formatRelative } from '@/lib/utils';
import { Github, Cloud, CheckCircle, XCircle, RefreshCw, Trash2, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROVIDERS = [
  {
    key: 'github',
    label: 'GitHub',
    icon: Github,
    description: 'Branch protection, member access, Dependabot alerts',
    fields: [{ name: 'token', label: 'Personal Access Token', type: 'password' }],
  },
  {
    key: 'aws',
    label: 'AWS',
    icon: Cloud,
    description: 'IAM policies, S3 encryption, CloudTrail, GuardDuty',
    fields: [
      { name: 'accessKeyId', label: 'Access Key ID', type: 'text' },
      { name: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
      { name: 'region', label: 'Region', type: 'text' },
    ],
  },
];

function ConnectModal({ provider, onClose }: { provider: typeof PROVIDERS[0]; onClose: () => void }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const connect = useMutation({
    mutationFn: () => integrationsApi.connect(provider.key, fields),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message ?? 'Connection failed'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <provider.icon className="w-5 h-5 text-gray-700" />
            <h2 className="text-base font-semibold text-gray-900">Connect {provider.label}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">{provider.description}</p>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-50 border border-danger-200 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {provider.fields.map((f) => (
            <div key={f.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">{f.label}</label>
              <input
                type={f.type}
                className="input"
                value={fields[f.name] ?? ''}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
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

function IntegrationCard({ integration, providerMeta }: { integration: any; providerMeta: typeof PROVIDERS[0] | undefined }) {
  const qc = useQueryClient();
  const Icon = providerMeta?.icon ?? Cloud;

  const sync = useMutation({
    mutationFn: () => integrationsApi.sync(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const disconnect = useMutation({
    mutationFn: () => integrationsApi.disconnect(integration.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const isActive = integration.status === 'active';

  return (
    <div className={cn('card p-5 flex items-start gap-4', !isActive && 'opacity-60')}>
      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 capitalize">{integration.provider}</p>
          {isActive ? (
            <span className="badge-passed"><CheckCircle className="w-3 h-3 mr-1" />Connected</span>
          ) : (
            <span className="badge-failed"><XCircle className="w-3 h-3 mr-1" />{integration.status}</span>
          )}
        </div>
        {integration.lastSyncedAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            Last synced {formatRelative(integration.lastSyncedAt)}
          </p>
        )}
        {integration.errorMessage && (
          <p className="text-xs text-danger-600 mt-1">{integration.errorMessage}</p>
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
          className="text-gray-400 hover:text-danger-600 transition-colors"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const [connecting, setConnecting] = useState<typeof PROVIDERS[0] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: integrationsApi.list,
  });

  const integrations: any[] = data ?? [];
  const connectedProviders = new Set(integrations.map((i) => i.provider));

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1>Integrations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Connect your tools to automatically collect evidence
        </p>
      </div>

      {/* Connected */}
      {integrations.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-4">Connected</h2>
          <div className="space-y-3">
            {integrations.map((i) => (
              <IntegrationCard
                key={i.id}
                integration={i}
                providerMeta={PROVIDERS.find((p) => p.key === i.provider)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available */}
      <div>
        <h2 className="mb-4">Available</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROVIDERS.filter((p) => !connectedProviders.has(p.key)).map((provider) => (
            <div key={provider.key} className="card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <provider.icon className="w-5 h-5 text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{provider.label}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{provider.description}</p>
              </div>
              <button
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 shrink-0"
                onClick={() => setConnecting(provider)}
              >
                <Plus className="w-3 h-3" /> Connect
              </button>
            </div>
          ))}
          {PROVIDERS.every((p) => connectedProviders.has(p.key)) && (
            <p className="text-sm text-gray-400 col-span-2">All available integrations are connected.</p>
          )}
        </div>
      </div>

      {connecting && (
        <ConnectModal provider={connecting} onClose={() => setConnecting(null)} />
      )}
    </div>
  );
}
