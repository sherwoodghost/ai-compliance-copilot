import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// Canonical framework IDs — lower-cased, matching the control library keys
export type FrameworkId = 'soc2' | 'iso27001' | 'gdpr' | 'iso9001' | 'hipaa' | 'pci-dss' | 'fedramp' | 'nist-csf' | 'iso14001' | 'iso45001' | string;

// Map from raw onboarding targetFramework values → canonical IDs
const FRAMEWORK_ALIAS_MAP: Record<string, FrameworkId> = {
  SOC2:         'soc2',
  SOC2_TYPE1:   'soc2',
  SOC2_TYPE2:   'soc2',
  ISO27001:     'iso27001',
  'ISO 27001':  'iso27001',
  GDPR:         'gdpr',
  ISO9001:      'iso9001',
  'ISO 9001':   'iso9001',
  HIPAA:        'hipaa',
  'PCI-DSS':    'pci-dss',
  PCI_DSS:      'pci-dss',
  PCIDSS:       'pci-dss',
  NIST:         'nist-csf',   // legacy alias — maps to NIST CSF
  CCPA:         'gdpr',       // legacy alias — no dedicated CCPA module; route to GDPR
  FedRAMP:      'fedramp',
  FEDRAMP:      'fedramp',
  NIST_CSF:     'nist-csf',
  'NIST-CSF':   'nist-csf',
  ISO14001:     'iso14001',
  'ISO 14001':  'iso14001',
  ISO45001:     'iso45001',
  'ISO 45001':  'iso45001',
};

function normalise(raw: string): FrameworkId {
  return (FRAMEWORK_ALIAS_MAP[raw] ?? raw.toLowerCase()) as FrameworkId;
}

async function fetchActiveFrameworks(): Promise<FrameworkId[]> {
  try {
    const { data } = await apiClient.get('/onboarding/profile');
    const profile = data?.data ?? data;
    const raw: string[] = profile?.complianceGoals?.targetFrameworks ?? [];
    const normalised = [...new Set(raw.map(normalise))];
    // Always include at least soc2 + iso27001 as a sensible default so the
    // dashboard is never completely empty for existing customers.
    return normalised.length > 0 ? normalised : ['soc2', 'iso27001'];
  } catch {
    return ['soc2', 'iso27001'];
  }
}

/**
 * Returns the active compliance frameworks for the current org, derived from
 * the business profile collected during onboarding.
 *
 * Values are normalised to lower-case canonical IDs:
 *   soc2 | iso27001 | gdpr | iso9001 | hipaa | pci-dss | fedramp | nist-csf | iso14001 | iso45001
 */
export function useActiveFrameworks() {
  return useQuery<FrameworkId[]>({
    queryKey: ['active-frameworks'],
    queryFn:  fetchActiveFrameworks,
    staleTime: 5 * 60 * 1000,   // 5 min — framework selection rarely changes
    gcTime:    30 * 60 * 1000,  // keep in cache for 30 min
  });
}
