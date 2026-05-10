'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient as api } from '@/lib/api/client';

export type FrameworkId = 'soc2' | 'iso27001' | 'iso9001' | 'gdpr' | 'hipaa' | 'pci-dss' | 'nist-csf' | 'fedramp';

export const FRAMEWORK_LABELS: Record<string, string> = {
  soc2: 'SOC 2',
  iso27001: 'ISO 27001',
  iso9001: 'ISO 9001',
  gdpr: 'GDPR',
  hipaa: 'HIPAA',
  'pci-dss': 'PCI DSS',
  'nist-csf': 'NIST CSF',
  fedramp: 'FedRAMP',
};

const FRAMEWORK_ENUM_MAP: Record<string, FrameworkId> = {
  SOC2: 'soc2',
  SOC2_TYPE1: 'soc2',
  SOC2_TYPE2: 'soc2',
  ISO27001: 'iso27001',
  ISO9001: 'iso9001',
  GDPR: 'gdpr',
  HIPAA: 'hipaa',
  PCI_DSS: 'pci-dss',
  NIST_CSF: 'nist-csf',
  NIST: 'nist-csf',
  FedRAMP: 'fedramp',
  FEDRAMP: 'fedramp',
};

function normalizeFrameworks(raw: string[]): FrameworkId[] {
  const normalised = raw
    .map(f => FRAMEWORK_ENUM_MAP[f] ?? f.toLowerCase().replace(/_/g, '-') as FrameworkId)
    .filter((v, i, a) => a.indexOf(v) === i);
  return normalised;
}

export function useActiveFrameworks(): { frameworks: FrameworkId[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['active-frameworks'],
    queryFn: async () => {
      try {
        const res = await api.get('/onboarding/profile');
        const goals = res.data?.complianceGoals ?? {};
        const targets: string[] = goals.targetFrameworks ?? [];
        const normalised = normalizeFrameworks(targets);
        // Return empty array when no frameworks configured — do NOT default to soc2/iso27001
        return normalised.length > 0 ? normalised : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  return { frameworks: data ?? [], isLoading };
}
