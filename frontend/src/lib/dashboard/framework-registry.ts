/**
 * Framework Plugin Registry
 *
 * Each entry describes everything a compliance framework contributes to the
 * platform UI: dashboard widgets, sidebar nav groups, and display metadata.
 *
 * Adding a new framework (e.g. HIPAA, NIST):
 *   1. Add an entry to FRAMEWORK_PLUGINS below.
 *   2. Create the widget components it references.
 *   3. Done — the dashboard, sidebar, and reference pages all auto-wire.
 */

import type { FrameworkId } from '@/lib/hooks/useActiveFrameworks';
import type { ElementType } from 'react';

// ── Widget spec ────────────────────────────────────────────────────────────────

export interface WidgetSpec {
  /** Stable key used as React list key */
  id: string;
  /** Human-readable title shown in the widget header */
  title: string;
  /** Lazy import of the widget component */
  component: () => Promise<{ default: ElementType }>;
  /** Width: 'half' = col-span-1, 'full' = col-span-2 */
  width: 'half' | 'full';
}

// ── Nav spec ──────────────────────────────────────────────────────────────────

export interface NavItemSpec {
  href:  string;
  label: string;
  icon:  string;  // lucide icon name (resolved at runtime by Sidebar)
}

export interface NavGroupSpec {
  label: string;
  items: NavItemSpec[];
  /** Collapsed by default in sidebar? */
  defaultCollapsed?: boolean;
}

// ── Framework plugin ──────────────────────────────────────────────────────────

export interface FrameworkPlugin {
  id:          FrameworkId;
  name:        string;
  version:     string;
  /** Tailwind color token, e.g. 'emerald', 'violet' */
  color:       string;
  /** Path to the public reference page */
  referencePath: string;
  /** Dashboard widgets this framework contributes */
  widgets:     WidgetSpec[];
  /** Sidebar nav groups this framework adds */
  navGroups:   NavGroupSpec[];
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const FRAMEWORK_PLUGINS: Record<string, FrameworkPlugin> = {

  // ── SOC 2 ──────────────────────────────────────────────────────────────────
  soc2: {
    id:            'soc2',
    name:          'SOC 2',
    version:       'Trust Services Criteria 2017',
    color:         'emerald',
    referencePath: '/frameworks/soc2',
    widgets: [
      {
        id:        'soc2-readiness',
        title:     'SOC 2 Readiness',
        component: () => import('@/components/dashboard/widgets/Soc2ReadinessWidget').then(m => ({ default: m.Soc2ReadinessWidget })),
        width:     'half',
      },
      {
        id:        'soc2-evidence',
        title:     'Evidence Freshness',
        component: () => import('@/components/dashboard/widgets/EvidenceFreshnessWidget').then(m => ({ default: m.EvidenceFreshnessWidget })),
        width:     'half',
      },
    ],
    navGroups: [],  // SOC 2 is covered by the universal Compliance nav group
  },

  // ── ISO 27001 ───────────────────────────────────────────────────────────────
  iso27001: {
    id:            'iso27001',
    name:          'ISO 27001',
    version:       'ISO/IEC 27001:2022',
    color:         'indigo',
    referencePath: '/frameworks/iso27001',
    widgets: [
      {
        id:        'iso27001-annex',
        title:     'Annex A Coverage',
        component: () => import('@/components/dashboard/widgets/AnnexCoverageWidget').then(m => ({ default: m.AnnexCoverageWidget })),
        width:     'half',
      },
      {
        id:        'iso27001-risk',
        title:     'Risk Treatment',
        component: () => import('@/components/dashboard/widgets/RiskTreatmentWidget').then(m => ({ default: m.RiskTreatmentWidget })),
        width:     'half',
      },
    ],
    navGroups: [],  // ISO 27001 is covered by universal Compliance nav group
  },

  // ── GDPR ────────────────────────────────────────────────────────────────────
  gdpr: {
    id:            'gdpr',
    name:          'GDPR',
    version:       'Regulation (EU) 2016/679',
    color:         'violet',
    referencePath: '/frameworks/gdpr',
    widgets: [
      {
        id:        'gdpr-dsar',
        title:     'DSAR Queue',
        component: () => import('@/components/dashboard/widgets/DsarQueueWidget').then(m => ({ default: m.DsarQueueWidget })),
        width:     'half',
      },
      {
        id:        'gdpr-ropa',
        title:     'ROPA Coverage',
        component: () => import('@/components/dashboard/widgets/RopaCoverageWidget').then(m => ({ default: m.RopaCoverageWidget })),
        width:     'half',
      },
      {
        id:        'gdpr-breach',
        title:     'Breach Notification',
        component: () => import('@/components/dashboard/widgets/BreachClockWidget').then(m => ({ default: m.BreachClockWidget })),
        width:     'full',
      },
    ],
    navGroups: [
      {
        label:            'GDPR',
        defaultCollapsed: true,
        items: [
          { href: '/gdpr',            label: 'GDPR Overview',icon: 'ShieldCheck' },
          { href: '/gdpr/ropa',       label: 'ROPA',         icon: 'FileText'    },
          { href: '/gdpr/dsar',       label: 'DSAR Queue',   icon: 'Users'       },
          { href: '/gdpr/dpia',       label: 'DPIA Register',icon: 'ShieldAlert' },
          { href: '/gdpr/breach-log', label: 'Breach Log',   icon: 'Siren'       },
        ],
      },
    ],
  },

  // ── HIPAA ───────────────────────────────────────────────────────────────────
  hipaa: {
    id:            'hipaa',
    name:          'HIPAA',
    version:       'Security Rule 45 CFR §164',
    color:         'rose',
    referencePath: '/frameworks/hipaa',
    widgets: [
      {
        id:        'hipaa-readiness',
        title:     'HIPAA Readiness',
        component: () => import('@/components/dashboard/widgets/HipaaReadinessWidget').then(m => ({ default: m.HipaaReadinessWidget })),
        width:     'half',
      },
    ],
    navGroups: [
      {
        label:            'HIPAA',
        defaultCollapsed: true,
        items: [
          { href: '/hipaa',                label: 'HIPAA Overview',    icon: 'ShieldCheck'  },
          { href: '/hipaa/risk-analysis',  label: 'Risk Analysis',     icon: 'AlertTriangle' },
          { href: '/hipaa/baa-tracker',    label: 'BAA Tracker',       icon: 'FileText'     },
          { href: '/hipaa/phi-inventory',  label: 'PHI Inventory',     icon: 'Database'     },
          { href: '/hipaa/breach-log',     label: 'Breach Log',        icon: 'Activity'     },
        ],
      },
    ],
  },

  // ── PCI DSS ─────────────────────────────────────────────────────────────────
  'pci-dss': {
    id:            'pci-dss',
    name:          'PCI DSS',
    version:       'PCI DSS v4.0',
    color:         'amber',
    referencePath: '/frameworks/pci-dss',
    widgets: [
      {
        id:        'pci-dss-readiness',
        title:     'PCI DSS Readiness',
        component: () => import('@/components/dashboard/widgets/PciDssReadinessWidget').then(m => ({ default: m.PciDssReadinessWidget })),
        width:     'half',
      },
    ],
    navGroups: [
      {
        label:            'PCI DSS',
        defaultCollapsed: true,
        items: [
          { href: '/pci-dss',                        label: 'PCI DSS Overview',       icon: 'CreditCard'   },
          { href: '/pci-dss/cde-scope',              label: 'CDE Scope',              icon: 'Network'      },
          { href: '/pci-dss/saq-tracker',            label: 'SAQ / Assessment',       icon: 'FileText'     },
          { href: '/pci-dss/compensating-controls',  label: 'Compensating Controls',  icon: 'ShieldCheck'  },
        ],
      },
    ],
  },

  // ── FedRAMP ─────────────────────────────────────────────────────────────────
  fedramp: {
    id:            'fedramp',
    name:          'FedRAMP',
    version:       'NIST SP 800-53 Rev 5 — Moderate',
    color:         'blue',
    referencePath: '/frameworks/fedramp',
    widgets: [
      {
        id:        'fedramp-readiness',
        title:     'FedRAMP Readiness',
        component: () => import('@/components/dashboard/widgets/FedRampReadinessWidget').then(m => ({ default: m.FedRampReadinessWidget })),
        width:     'half',
      },
    ],
    navGroups: [
      {
        label:            'FedRAMP',
        defaultCollapsed: true,
        items: [
          { href: '/fedramp',               label: 'FedRAMP Overview',  icon: 'ShieldCheck'  },
          { href: '/fedramp/ato-tracker',   label: 'ATO Tracker',       icon: 'FileText'     },
          { href: '/fedramp/ssp',           label: 'System Sec. Plan',  icon: 'Server'       },
          { href: '/fedramp/continuous-mon',label: 'Continuous Mon.',   icon: 'Activity'     },
          { href: '/fedramp/poam',          label: 'POA&M',             icon: 'AlertTriangle'},
        ],
      },
    ],
  },

  // ── ISO 9001 ────────────────────────────────────────────────────────────────
  iso9001: {
    id:            'iso9001',
    name:          'ISO 9001',
    version:       'ISO 9001:2015',
    color:         'teal',
    referencePath: '/frameworks/iso9001',
    widgets: [
      {
        id:        'iso9001-ncr',
        title:     'NCR Aging',
        component: () => import('@/components/dashboard/widgets/NcrAgingWidget').then(m => ({ default: m.NcrAgingWidget })),
        width:     'half',
      },
      {
        id:        'iso9001-capa',
        title:     'CAPA Effectiveness',
        component: () => import('@/components/dashboard/widgets/CapaEffectivenessWidget').then(m => ({ default: m.CapaEffectivenessWidget })),
        width:     'half',
      },
      {
        id:        'iso9001-objectives',
        title:     'Quality Objectives',
        component: () => import('@/components/dashboard/widgets/QualityObjectivesWidget').then(m => ({ default: m.QualityObjectivesWidget })),
        width:     'full',
      },
    ],
    navGroups: [
      {
        label:            'ISO 9001',
        defaultCollapsed: true,
        items: [
          { href: '/iso9001',            label: 'ISO 9001 Overview', icon: 'CheckCircle2'   },
          { href: '/iso9001/ncr',        label: 'NCR Tracker',       icon: 'AlertTriangle'  },
          { href: '/iso9001/capa',       label: 'CAPA Board',        icon: 'ClipboardCheck' },
          { href: '/iso9001/objectives', label: 'Quality Objectives', icon: 'Target'         },
          { href: '/iso9001/audits',     label: 'Process Audits',    icon: 'ScrollText'     },
        ],
      },
    ],
  },

  // ── NIST CSF ────────────────────────────────────────────────────────────────
  'nist-csf': {
    id:            'nist-csf',
    name:          'NIST CSF',
    version:       'NIST Cybersecurity Framework 2.0',
    color:         'orange',
    referencePath: '/frameworks/nist-csf',
    widgets: [
      {
        id:        'nist-csf-readiness',
        title:     'NIST CSF Readiness',
        component: () => import('@/components/dashboard/widgets/NistCsfReadinessWidget').then(m => ({ default: m.NistCsfReadinessWidget })),
        width:     'half',
      },
    ],
    navGroups: [
      {
        label:            'NIST CSF',
        defaultCollapsed: true,
        items: [
          { href: '/nist-csf',                 label: 'NIST CSF Overview',  icon: 'Shield'       },
          { href: '/nist-csf/profiles',         label: 'CSF Profiles',       icon: 'FileText'     },
          { href: '/nist-csf/tier-assessment',  label: 'Tier Assessment',    icon: 'BarChart3'    },
          { href: '/nist-csf/action-plan',      label: 'Action Plan',        icon: 'Target'       },
        ],
      },
    ],
  },

  // ── ISO 14001 ───────────────────────────────────────────────────────────────
  iso14001: {
    id:            'iso14001',
    name:          'ISO 14001',
    version:       'ISO 14001:2015',
    color:         'green',
    referencePath: '/frameworks/iso14001',
    widgets: [
      {
        id:        'iso14001-readiness',
        title:     'ISO 14001 EMS Readiness',
        component: () => import('@/components/dashboard/widgets/Iso14001ReadinessWidget').then(m => ({ default: m.Iso14001ReadinessWidget })),
        width:     'half',
      },
      {
        id:        'iso14001-aspects',
        title:     'Environmental Aspects',
        component: () => import('@/components/dashboard/widgets/EnvAspectsWidget').then(m => ({ default: m.EnvAspectsWidget })),
        width:     'half',
      },
      {
        id:        'iso14001-objectives',
        title:     'Environmental Objectives',
        component: () => import('@/components/dashboard/widgets/EnvObjectivesWidget').then(m => ({ default: m.EnvObjectivesWidget })),
        width:     'full',
      },
    ],
    navGroups: [
      {
        label:            'ISO 14001',
        defaultCollapsed: true,
        items: [
          { href: '/iso14001',                   label: 'EMS Overview',          icon: 'Globe'          },
          { href: '/iso14001/aspects',            label: 'Environmental Aspects', icon: 'Activity'       },
          { href: '/iso14001/objectives',         label: 'Env Objectives',        icon: 'Target'         },
          { href: '/iso14001/legal-register',     label: 'Legal Register',        icon: 'ScrollText'     },
          { href: '/iso14001/emergency-response', label: 'Emergency Response',    icon: 'Siren'          },
        ],
      },
    ],
  },

  // ── ISO 45001 ───────────────────────────────────────────────────────────────
  iso45001: {
    id:            'iso45001',
    name:          'ISO 45001',
    version:       'ISO 45001:2018',
    color:         'yellow',
    referencePath: '/frameworks/iso45001',
    widgets: [
      {
        id:        'iso45001-readiness',
        title:     'ISO 45001 OHS Readiness',
        component: () => import('@/components/dashboard/widgets/Iso45001ReadinessWidget').then(m => ({ default: m.Iso45001ReadinessWidget })),
        width:     'half',
      },
      {
        id:        'iso45001-incidents',
        title:     'OH&S Incident Tracker',
        component: () => import('@/components/dashboard/widgets/OhsIncidentWidget').then(m => ({ default: m.OhsIncidentWidget })),
        width:     'half',
      },
      {
        id:        'iso45001-hazards',
        title:     'Hazard Register',
        component: () => import('@/components/dashboard/widgets/HazardRegisterWidget').then(m => ({ default: m.HazardRegisterWidget })),
        width:     'full',
      },
    ],
    navGroups: [
      {
        label:            'ISO 45001',
        defaultCollapsed: true,
        items: [
          { href: '/iso45001',               label: 'OHS Overview',        icon: 'ShieldAlert'    },
          { href: '/iso45001/hazards',        label: 'Hazard Register',     icon: 'AlertTriangle'  },
          { href: '/iso45001/incidents',      label: 'OHS Incidents',       icon: 'Siren'          },
          { href: '/iso45001/emergency',      label: 'Emergency Plans',     icon: 'Activity'       },
          { href: '/iso45001/health-surveillance', label: 'Health Surveillance', icon: 'Users'    },
        ],
      },
    ],
  },
};

// ── Helper functions ──────────────────────────────────────────────────────────

/**
 * Returns the ordered list of plugins active for the given framework IDs.
 * Unknown framework IDs are silently skipped (future-proof).
 */
export function getActivePlugins(frameworkIds: string[]): FrameworkPlugin[] {
  return frameworkIds
    .map(id => FRAMEWORK_PLUGINS[id])
    .filter((p): p is FrameworkPlugin => p !== undefined);
}

/**
 * Collects all widget specs from the active plugins, in plugin order.
 */
export function getActiveWidgets(frameworkIds: string[]): WidgetSpec[] {
  return getActivePlugins(frameworkIds).flatMap(p => p.widgets);
}

/**
 * Collects all nav groups from the active plugins.
 * Universal nav groups (SOC 2, ISO 27001) return empty arrays so they don't
 * add duplicate entries — those frameworks are covered by the Compliance group.
 */
export function getActiveNavGroups(frameworkIds: string[]): NavGroupSpec[] {
  return getActivePlugins(frameworkIds).flatMap(p => p.navGroups);
}
