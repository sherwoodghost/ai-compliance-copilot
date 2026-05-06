'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/lib/stores/auth.store';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api/auth';
import { User, Building, Lock, LogOut } from 'lucide-react';

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
