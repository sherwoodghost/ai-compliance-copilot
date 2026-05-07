'use client';

import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer';

// Register fonts (using system fonts via PDF renderer defaults)
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 40,
    backgroundColor: '#ffffff',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
  },
  headerLeft: { flexDirection: 'column' },
  reportTitle: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1e293b', marginBottom: 2 },
  reportSubtitle: { fontSize: 10, color: '#64748b' },
  orgName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#4f46e5', textAlign: 'right' },
  generatedDate: { fontSize: 8, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
  // Disclaimer
  disclaimer: {
    backgroundColor: '#fef9c3',
    borderWidth: 1,
    borderColor: '#fde047',
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
  },
  disclaimerTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#854d0e', marginBottom: 4 },
  disclaimerText: { fontSize: 8, color: '#854d0e', lineHeight: 1.4 },
  // Section
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 6,
    padding: 10,
    alignItems: 'center',
  },
  statValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#4f46e5', marginBottom: 2 },
  statLabel: { fontSize: 8, color: '#64748b', textAlign: 'center' },
  // Table
  table: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tableRowLast: { flexDirection: 'row' },
  tableRowAlt: { flexDirection: 'row', backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  th: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#475569', padding: '6 8' },
  td: { fontSize: 8, color: '#374151', padding: '5 8', lineHeight: 1.3 },
  // Status badges
  badgeImplemented: { backgroundColor: '#dcfce7', color: '#15803d', borderRadius: 3, padding: '1 4', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeInProgress: { backgroundColor: '#fef9c3', color: '#854d0e', borderRadius: 3, padding: '1 4', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeNotImpl: { backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: 3, padding: '1 4', fontSize: 7, fontFamily: 'Helvetica-Bold' },
  badgeNA: { backgroundColor: '#f1f5f9', color: '#64748b', borderRadius: 3, padding: '1 4', fontSize: 7 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
  pageNumber: { fontSize: 7, color: '#94a3b8' },
});

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'implemented' ? styles.badgeImplemented
    : status === 'in_progress' || status === 'partial' ? styles.badgeInProgress
    : status === 'not_applicable' ? styles.badgeNA
    : styles.badgeNotImpl;

  const labels: Record<string, string> = {
    implemented: 'Implemented',
    in_progress: 'In Progress',
    partial: 'Partial',
    not_implemented: 'Not Implemented',
    not_applicable: 'N/A',
    not_started: 'Not Started',
    applicable: 'Applicable',
    not_applicable_excluded: 'Excluded',
  };

  return <Text style={style}>{labels[status] ?? status}</Text>;
}

// ─── SOC 2 Readiness Report ──────────────────────────────────────────────────

export type Soc2ReportData = {
  disclaimer: string;
  generatedAt: string;
  organization: { name: string; industry?: string; framework: string; auditType?: string; trustServiceCategories?: string[] };
  readinessScore: number;
  controlMatrix: Array<{ code: string; title: string; status: string; score: number; hasPolicies: boolean; hasEvidence: boolean; dueDate?: string }>;
  policyInventory: Array<{ title: string; status: string; version: string; approvedAt?: string }>;
  evidenceIndex: Array<{ title: string; type: string; collectedAt: string; expiresAt?: string; isValid: boolean }>;
  riskSummary: { total: number; open: number; highCritical: number };
};

export function Soc2ReadinessPdf({ data }: { data: Soc2ReportData }) {
  const implemented = data.controlMatrix.filter(c => c.status === 'implemented').length;
  const inProgress = data.controlMatrix.filter(c => ['in_progress', 'partial'].includes(c.status)).length;
  const gaps = data.controlMatrix.filter(c => c.status === 'not_implemented').length;
  const approvedPolicies = data.policyInventory.filter(p => p.status === 'approved').length;
  const validEvidence = data.evidenceIndex.filter(e => e.isValid).length;

  return (
    <Document title={`SOC 2 Readiness Report — ${data.organization.name}`} author="AI Compliance Copilot">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>SOC 2 Readiness Report</Text>
            <Text style={styles.reportSubtitle}>Internal Readiness Assessment · {data.organization.framework}</Text>
          </View>
          <View>
            <Text style={styles.orgName}>{data.organization.name}</Text>
            <Text style={styles.generatedDate}>Generated {new Date(data.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>⚠ DISCLAIMER</Text>
          <Text style={styles.disclaimerText}>This report reflects an internal readiness assessment only and does NOT constitute an official SOC 2 audit opinion or any external attestation. Certification requires engagement with an accredited third-party auditor.</Text>
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Executive Summary</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: data.readinessScore >= 80 ? '#15803d' : data.readinessScore >= 60 ? '#b45309' : '#b91c1c' }]}>{data.readinessScore}%</Text>
              <Text style={styles.statLabel}>Readiness Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#15803d' }]}>{implemented}</Text>
              <Text style={styles.statLabel}>Controls Implemented</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#b45309' }]}>{inProgress}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#b91c1c' }]}>{gaps}</Text>
              <Text style={styles.statLabel}>Gaps</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#4f46e5' }]}>{approvedPolicies}</Text>
              <Text style={styles.statLabel}>Approved Policies</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: '#0891b2' }]}>{validEvidence}</Text>
              <Text style={styles.statLabel}>Valid Evidence</Text>
            </View>
          </View>
        </View>

        {/* Org info */}
        {data.organization.industry && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Organization Details</Text>
            <View style={styles.table}>
              {[
                ['Industry', data.organization.industry],
                ['Audit Type', data.organization.auditType ?? 'Type II'],
                ['Trust Service Categories', (data.organization.trustServiceCategories ?? ['Security']).join(', ')],
                ['Assessment Date', new Date(data.generatedAt).toLocaleDateString()],
              ].map(([label, value], i) => (
                <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={[styles.td, { width: '40%', fontFamily: 'Helvetica-Bold' }]}>{label}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AI Compliance Copilot · {data.organization.name} · Internal Use Only</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Control Matrix page */}
      {data.controlMatrix.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.reportTitle}>Control Matrix</Text>
            <Text style={styles.orgName}>{data.organization.name}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SOC 2 Control Implementation Status</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: '12%' }]}>Code</Text>
                <Text style={[styles.th, { flex: 1 }]}>Control Title</Text>
                <Text style={[styles.th, { width: '18%' }]}>Status</Text>
                <Text style={[styles.th, { width: '10%' }]}>Score</Text>
                <Text style={[styles.th, { width: '10%' }]}>Policy</Text>
                <Text style={[styles.th, { width: '12%' }]}>Evidence</Text>
              </View>
              {data.controlMatrix.map((c, i) => (
                <View key={c.code} style={i === data.controlMatrix.length - 1 ? styles.tableRowLast : (i % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}>
                  <Text style={[styles.td, { width: '12%', fontFamily: 'Helvetica-Bold', color: '#4f46e5' }]}>{c.code}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{c.title}</Text>
                  <View style={[{ width: '18%' }, styles.td]}>
                    <StatusBadge status={c.status} />
                  </View>
                  <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{c.score ? `${c.score}%` : '—'}</Text>
                  <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{c.hasPolicies ? '✓' : '✗'}</Text>
                  <Text style={[styles.td, { width: '12%', textAlign: 'center' }]}>{c.hasEvidence ? '✓' : '✗'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>AI Compliance Copilot · {data.organization.name} · Internal Use Only</Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* Policy Inventory page */}
      {data.policyInventory.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.reportTitle}>Policy Inventory</Text>
            <Text style={styles.orgName}>{data.organization.name}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Policy Status ({data.policyInventory.length} total)</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { flex: 1 }]}>Policy Title</Text>
                <Text style={[styles.th, { width: '15%' }]}>Status</Text>
                <Text style={[styles.th, { width: '12%' }]}>Version</Text>
                <Text style={[styles.th, { width: '20%' }]}>Approved Date</Text>
              </View>
              {data.policyInventory.map((p, i) => (
                <View key={i} style={i === data.policyInventory.length - 1 ? styles.tableRowLast : (i % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}>
                  <Text style={[styles.td, { flex: 1 }]}>{p.title}</Text>
                  <View style={[{ width: '15%' }, styles.td]}>
                    <StatusBadge status={p.status} />
                  </View>
                  <Text style={[styles.td, { width: '12%', fontFamily: 'Helvetica-Oblique' }]}>{p.version}</Text>
                  <Text style={[styles.td, { width: '20%' }]}>{p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : '—'}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.footer} fixed>
            <Text style={styles.footerText}>AI Compliance Copilot · {data.organization.name} · Internal Use Only</Text>
            <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      )}

      {/* Risk Summary page */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.reportTitle}>Risk Summary</Text>
          <Text style={styles.orgName}>{data.organization.name}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#1e293b' }]}>{data.riskSummary.total}</Text>
            <Text style={styles.statLabel}>Total Risks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#b45309' }]}>{data.riskSummary.open}</Text>
            <Text style={styles.statLabel}>Open Risks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#b91c1c' }]}>{data.riskSummary.highCritical}</Text>
            <Text style={styles.statLabel}>High / Critical</Text>
          </View>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AI Compliance Copilot · {data.organization.name} · Internal Use Only</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Control Matrix PDF ──────────────────────────────────────────────────────

export type ControlMatrixData = {
  disclaimer: string;
  generatedAt: string;
  controls: Array<{ framework: string; code: string; title: string; status: string; score: number; notes?: string }>;
};

export function ControlMatrixPdf({ data }: { data: ControlMatrixData }) {
  const byFramework = data.controls.reduce<Record<string, typeof data.controls>>((acc, c) => {
    if (!acc[c.framework]) acc[c.framework] = [];
    acc[c.framework].push(c);
    return acc;
  }, {});

  return (
    <Document title="Control Matrix" author="AI Compliance Copilot">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>Control Matrix</Text>
            <Text style={styles.reportSubtitle}>Cross-Framework Implementation Status</Text>
          </View>
          <Text style={styles.generatedDate}>{new Date(data.generatedAt).toLocaleDateString()}</Text>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>⚠ DISCLAIMER</Text>
          <Text style={styles.disclaimerText}>Internal readiness assessment only. Does not constitute official audit opinion or certification.</Text>
        </View>

        {Object.entries(byFramework).map(([framework, controls]) => (
          <View key={framework} style={styles.section}>
            <Text style={styles.sectionTitle}>{framework} Controls ({controls.length})</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.th, { width: '14%' }]}>Code</Text>
                <Text style={[styles.th, { flex: 1 }]}>Title</Text>
                <Text style={[styles.th, { width: '22%' }]}>Status</Text>
                <Text style={[styles.th, { width: '10%' }]}>Score</Text>
              </View>
              {controls.map((c, i) => (
                <View key={c.code} style={i === controls.length - 1 ? styles.tableRowLast : (i % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}>
                  <Text style={[styles.td, { width: '14%', fontFamily: 'Helvetica-Bold', color: '#4f46e5' }]}>{c.code}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{c.title}</Text>
                  <View style={[{ width: '22%' }, styles.td]}><StatusBadge status={c.status} /></View>
                  <Text style={[styles.td, { width: '10%', textAlign: 'center' }]}>{c.score ? `${c.score}%` : '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AI Compliance Copilot · Internal Use Only</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// ─── ISO SoA PDF ──────────────────────────────────────────────────────────────

export type IsoSoaData = {
  disclaimer: string;
  generatedAt: string;
  organization: { name: string; framework: string };
  ismsScope: string;
  statementOfApplicability: Array<{
    controlCode: string; controlTitle: string; applicable: boolean;
    rationale?: string; implementationStatus?: string;
  }>;
  totals: { total: number; applicable: number; notApplicable: number };
};

export function IsoSoaPdf({ data }: { data: IsoSoaData }) {
  return (
    <Document title={`ISO 27001 SoA — ${data.organization.name}`} author="AI Compliance Copilot">
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.reportTitle}>Statement of Applicability</Text>
            <Text style={styles.reportSubtitle}>ISO 27001:2022 · Annex A</Text>
          </View>
          <View>
            <Text style={styles.orgName}>{data.organization.name}</Text>
            <Text style={styles.generatedDate}>{new Date(data.generatedAt).toLocaleDateString()}</Text>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>⚠ DISCLAIMER</Text>
          <Text style={styles.disclaimerText}>Internal readiness assessment only. Does not constitute ISO 27001 certification. Certification requires engagement with an accredited certification body.</Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Total Controls', value: data.totals.total, color: '#1e293b' },
            { label: 'Applicable', value: data.totals.applicable, color: '#15803d' },
            { label: 'Not Applicable', value: data.totals.notApplicable, color: '#64748b' },
          ].map(({ label, value, color }) => (
            <View key={label} style={styles.statCard}>
              <Text style={[styles.statValue, { color }]}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {data.ismsScope !== 'Not defined' && (
          <View style={[styles.section, { marginBottom: 12 }]}>
            <Text style={styles.sectionTitle}>ISMS Scope</Text>
            <Text style={{ fontSize: 9, color: '#374151', lineHeight: 1.5 }}>{data.ismsScope}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Annex A Controls ({data.statementOfApplicability.length})</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { width: '12%' }]}>Code</Text>
              <Text style={[styles.th, { flex: 1 }]}>Control Title</Text>
              <Text style={[styles.th, { width: '14%' }]}>Applicable</Text>
              <Text style={[styles.th, { width: '20%' }]}>Status</Text>
            </View>
            {data.statementOfApplicability.map((entry, i) => (
              <View key={entry.controlCode} style={i === data.statementOfApplicability.length - 1 ? styles.tableRowLast : (i % 2 === 0 ? styles.tableRow : styles.tableRowAlt)}>
                <Text style={[styles.td, { width: '12%', fontFamily: 'Helvetica-Bold', color: '#4f46e5' }]}>{entry.controlCode}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{entry.controlTitle}</Text>
                <Text style={[styles.td, { width: '14%', textAlign: 'center', color: entry.applicable ? '#15803d' : '#b91c1c', fontFamily: 'Helvetica-Bold' }]}>{entry.applicable ? 'Yes' : 'No'}</Text>
                <View style={[{ width: '20%' }, styles.td]}>
                  {entry.implementationStatus && <StatusBadge status={entry.implementationStatus} />}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>AI Compliance Copilot · {data.organization.name} · Internal Use Only</Text>
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
