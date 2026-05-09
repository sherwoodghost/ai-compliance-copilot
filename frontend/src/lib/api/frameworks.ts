// ─── Types ────────────────────────────────────────────────────────────────────

export interface Framework {
  name: string;
  type: string;
}

export interface Domain {
  name: string;
  code: string;
}

export interface LibraryMeta {
  domain: Domain;
}

export interface EvidenceRequirement {
  evidenceType: string;
  description:  string;
  isMandatory:  boolean;
}

export interface PolicyRequirement {
  policyName:  string;
  description: string;
}

export interface CrosswalkMapping {
  sourceCode:    string;
  sourceTitle:   string;
  targetCode:    string;
  targetTitle:   string;
  mappingType:   string;
  confidence:    'high' | 'medium' | 'low';
  sourceFramework: string;
  targetFramework: string;
}

export interface Control {
  id:          string;
  code:        string;
  title:       string;
  description: string;
  category:    string;
  guidance:    string | null;
  weight:      number;
  framework:   Framework;
  libraryMeta: LibraryMeta;
}

export interface ControlDetail extends Control {
  evidenceRequirements: EvidenceRequirement[];
  policyRequirements:   PolicyRequirement[];
  crosswalkSources:     CrosswalkMapping[];
  crosswalkTargets:     CrosswalkMapping[];
}

export interface FrameworkInfo {
  name:         string;
  version:      string;
  controlCount: number;
  categories:   string[];
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

function apiBase(): string {
  return process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';
}

// Note: use 'no-store' so the control library always reflects the latest seeded data.
// For production, swap to { next: { revalidate: 3600 } } once data is stable.
const ISR_OPTIONS: RequestInit = { cache: 'no-store' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, ISR_OPTIONS);
    if (!res.ok) return null;
    const json = await res.json();
    // API may wrap in { data: [...] } or return array directly
    return (json?.data !== undefined ? json.data : json) as T;
  } catch {
    return null;
  }
}

function extractCategories(controls: Control[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of controls) {
    if (!seen.has(c.category)) {
      seen.add(c.category);
      out.push(c.category);
    }
  }
  return out.sort();
}

// ─── Public API functions ─────────────────────────────────────────────────────

export async function getFrameworks(): Promise<{
  soc2:     FrameworkInfo;
  iso27001: FrameworkInfo;
}> {
  const [soc2Controls, iso27001Controls] = await Promise.all([
    safeFetch<Control[]>(`${apiBase()}/controls/library/soc2`),
    safeFetch<Control[]>(`${apiBase()}/controls/library/iso27001`),
  ]);

  return {
    soc2: {
      name:         'SOC 2',
      version:      'Trust Services Criteria 2017',
      controlCount: soc2Controls?.length ?? 68,
      categories:   soc2Controls ? extractCategories(soc2Controls) : [],
    },
    iso27001: {
      name:         'ISO 27001',
      version:      'ISO/IEC 27001:2022',
      controlCount: iso27001Controls?.length ?? 97,
      categories:   iso27001Controls ? extractCategories(iso27001Controls) : [],
    },
  };
}

export async function getFrameworkControls(
  framework: 'soc2' | 'iso27001',
): Promise<Control[]> {
  const result = await safeFetch<Control[]>(
    `${apiBase()}/controls/library/${framework}`,
  );
  return result ?? [];
}

export async function getAllControls(): Promise<Control[]> {
  const result = await safeFetch<Control[]>(`${apiBase()}/controls/library`);
  return result ?? [];
}

export async function getControlByCode(code: string): Promise<ControlDetail | null> {
  return safeFetch<ControlDetail>(
    `${apiBase()}/controls/library/control/${encodeURIComponent(code)}`,
  );
}

export async function getControlCrosswalks(code: string): Promise<CrosswalkMapping[]> {
  const result = await safeFetch<CrosswalkMapping[]>(
    `${apiBase()}/controls/library/control/${encodeURIComponent(code)}/crosswalks`,
  );
  return result ?? [];
}
