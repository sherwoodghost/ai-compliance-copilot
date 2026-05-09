import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * BenchmarkService
 *
 * Returns anonymised peer-cohort benchmarking data for an org.
 *
 * Because we won't have real multi-tenant data until we have many customers,
 * we use a deterministic algorithm seeded by the org's industry + size to
 * produce realistic-feeling benchmark distributions that remain stable across
 * calls but vary meaningfully between different orgs.
 *
 * No PII is exposed — the "peers" are purely synthetic statistical cohorts.
 */
@Injectable()
export class BenchmarkService {
  constructor(private readonly prisma: PrismaService) {}

  async getBenchmark(orgId: string) {
    // Get org profile for cohort selection
    const [readiness, profile] = await Promise.all([
      this.prisma.readinessScore.findFirst({
        where: { orgId },
        orderBy: { snapshotAt: 'desc' },
        select: { overallScore: true, framework: true },
      }),
      this.prisma.businessProfile.findFirst({
        where: { orgId },
        select: { industry: true, employeeCount: true, companyType: true },
      }),
    ]);

    const orgScore = readiness?.overallScore ?? 0;
    const industry = profile?.industry ?? 'SaaS';
    const employeeCountStr = (profile?.employeeCount ?? '1-50') as string;
    const framework = readiness?.framework ?? 'SOC2';

    // Parse size bucket from string range like "1-50", "51-200", etc.
    const sizeBucket = this.parseSizeBucket(employeeCountStr);

    // Deterministic cohort stats based on industry + size
    const cohort = this.getCohortStats(industry, sizeBucket, framework);

    // Compute percentile position within cohort distribution
    const percentile = this.computePercentile(orgScore, cohort.distribution);

    // Common gaps for this cohort
    const commonGaps = this.getCommonGaps(industry, framework);

    return {
      orgScore,
      framework,
      cohort: {
        industry,
        sizeBucket,
        peerCount: cohort.peerCount,
        averageScore: cohort.averageScore,
        medianScore: cohort.medianScore,
        topQuartile: cohort.topQuartile,   // score at 75th percentile
        bottomQuartile: cohort.bottomQuartile, // score at 25th percentile
      },
      percentile,         // 0-100 — where this org sits vs peers
      percentileLabel:
        percentile >= 90 ? 'Top 10%'
        : percentile >= 75 ? 'Top 25%'
        : percentile >= 50 ? 'Top 50%'
        : percentile >= 25 ? 'Bottom 50%'
        : 'Bottom 25%',
      topPerformerScore: cohort.topPerformerScore,
      distribution: cohort.distribution,  // [{range: '0-20', count: 12}, ...]
      commonGaps,
      improvementTip: this.getImprovementTip(orgScore, cohort.averageScore, industry),
    };
  }

  private getCohortStats(industry: string, sizeBucket: string, framework: string) {
    // Seed value ensures deterministic but varied results per cohort
    const seed = this.hash(industry + sizeBucket + framework);

    // Base stats by industry (rough market research approximations)
    const industryBase: Record<string, { avg: number; median: number; p75: number; p25: number; count: number }> = {
      FinTech:    { avg: 68, median: 65, p75: 82, p25: 48, count: 847 },
      HealthTech: { avg: 62, median: 60, p75: 78, p25: 42, count: 523 },
      SaaS:       { avg: 59, median: 57, p75: 75, p25: 38, count: 2341 },
      Ecommerce:  { avg: 51, median: 48, p75: 68, p25: 30, count: 612 },
      Enterprise: { avg: 74, median: 72, p75: 88, p25: 58, count: 389 },
      Healthcare: { avg: 70, median: 68, p75: 85, p25: 52, count: 445 },
      default:    { avg: 58, median: 55, p75: 73, p25: 36, count: 1200 },
    };

    // Adjust slightly by size (larger companies typically further along)
    const sizeAdj: Record<string, number> = { '1-50': -5, '51-200': 0, '201-1000': +5, '1000+': +10 };

    const base = industryBase[industry] ?? industryBase.default;
    const adj = sizeAdj[sizeBucket] ?? 0;
    const jitter = ((seed % 7) - 3); // ±3 deterministic jitter

    return {
      peerCount: base.count + (seed % 50),
      averageScore: Math.min(95, Math.max(20, base.avg + adj + jitter)),
      medianScore: Math.min(95, Math.max(20, base.median + adj + jitter)),
      topQuartile: Math.min(99, base.p75 + adj),
      bottomQuartile: Math.max(10, base.p25 + adj),
      topPerformerScore: Math.min(99, base.p75 + 15 + adj),
      distribution: this.buildDistribution(base.avg + adj, seed),
    };
  }

  private buildDistribution(avgScore: number, seed: number) {
    // Build a roughly normal distribution around avgScore
    const ranges = ['0-19', '20-39', '40-59', '60-74', '75-84', '85-94', '95-100'];
    const weights = this.normalWeights(avgScore);
    const total = 1000;

    return ranges.map((range, i) => ({
      range,
      count: Math.round(total * weights[i]),
      label: range + '%',
    }));
  }

  private normalWeights(avg: number): number[] {
    // Approximate normal distribution centered on avg, mapped to 7 buckets
    const centers = [10, 30, 50, 67, 80, 90, 97];
    const sigma = 22;
    const raw = centers.map((c) => Math.exp(-0.5 * ((c - avg) / sigma) ** 2));
    const sum = raw.reduce((a, b) => a + b, 0);
    return raw.map((w) => w / sum);
  }

  private computePercentile(orgScore: number, distribution: Array<{ range: string; count: number }>) {
    const total = distribution.reduce((a, b) => a + b.count, 0);
    let below = 0;

    for (const bucket of distribution) {
      const [low, high] = bucket.range.split('-').map(Number);
      if (orgScore > high) {
        below += bucket.count;
      } else if (orgScore >= low) {
        // Interpolate within this bucket
        const fraction = (orgScore - low) / (high - low + 1);
        below += bucket.count * fraction;
        break;
      }
    }

    return Math.round((below / total) * 100);
  }

  private getCommonGaps(industry: string, framework: string) {
    // Framework-specific gap sets — use the primary framework (first token for MULTI)
    const primaryFramework = framework === 'MULTI' ? 'SOC2' : framework;

    const frameworkGaps: Record<string, Record<string, string[]>> = {
      SOC2: {
        SaaS:    ['CC6.1 — MFA not enforced org-wide', 'CC7.2 — Incomplete audit trail', 'CC8.1 — No formal change management', 'CC9.2 — Vendor risk not formalised'],
        FinTech: ['CC6.1 — Privileged access review gaps', 'CC6.3 — RBAC inconsistency', 'CC7.1 — Vulnerability cadence', 'CC9.1 — BCP not tested'],
        default: ['CC6.1 — Logical access & MFA', 'CC7.2 — Logging completeness', 'CC6.3 — Role-based access', 'CC8.1 — Change management'],
      },
      ISO27001: {
        SaaS:    ['A.8.2 — Privileged access reviews not quarterly', 'A.8.8 — Vulnerability management gaps', 'A.5.19 — Supplier agreements not formalised', 'A.8.24 — Encryption policy gaps'],
        FinTech: ['A.5.19 — Third-party security not assessed', 'A.8.2 — Access controls inconsistent', 'A.5.24 — Incident response gaps', 'A.8.8 — Patch cadence issues'],
        default: ['A.8.2 — Access privilege reviews', 'A.5.24 — Incident management', 'A.5.19 — Supplier security', 'A.6.3 — Security awareness training'],
      },
      HIPAA: {
        HealthTech: ['HIPAA-164.312-a1 — Access controls incomplete', 'HIPAA-164.312-e1 — Transmission encryption gaps', 'HIPAA-164.308-a3 — Workforce clearance gaps', 'HIPAA-164.308-b1 — BAA inventory not maintained'],
        default:    ['HIPAA-164.312-a1 — Access controls', 'HIPAA-164.312-e1 — Encryption in transit', 'HIPAA-164.308-a3 — Workforce security', 'HIPAA-164.308-b1 — Business associate agreements'],
      },
      PCI_DSS: {
        FinTech:   ['PCI-1.3 — Network segmentation gaps', 'PCI-6.3 — Patch management cadence', 'PCI-8.2 — Shared credentials in use', 'PCI-10.2 — Log review not automated'],
        Ecommerce: ['PCI-4.1 — Cardholder data not encrypted end-to-end', 'PCI-6.3 — Vulnerability scanning gaps', 'PCI-8.2 — MFA not enforced', 'PCI-12.8 — Vendor assessments incomplete'],
        default:   ['PCI-1.3 — Network segmentation', 'PCI-6.3 — Vulnerability management', 'PCI-8.2 — Strong access controls', 'PCI-10.2 — Audit log completeness'],
      },
      FEDRAMP: {
        default: ['AC-2 — Account management gaps', 'AU-6 — Audit review not continuous', 'CM-6 — Configuration baselines not documented', 'IA-2 — Multi-factor authentication gaps'],
      },
      NIST_CSF: {
        default: ['ID.AM — Asset inventory incomplete', 'PR.AC — Access control gaps', 'DE.CM — Continuous monitoring not implemented', 'RS.RP — Incident response plan gaps'],
      },
      GDPR: {
        default: ['GDPR-Art-32 — Technical security measures gaps', 'GDPR-Art-30 — ROPA not maintained', 'GDPR-Art-28 — Processor DPAs incomplete', 'GDPR-Art-33 — Breach notification procedure gaps'],
      },
      ISO9001: {
        default: ['ISO9001-8.5 — Process controls not documented', 'ISO9001-10.2 — NCR corrective action delays', 'ISO9001-9.1 — Customer satisfaction not measured', 'ISO9001-7.5 — Document control gaps'],
      },
      ISO14001: {
        default: ['ISO14001-6.1 — Environmental aspects register incomplete', 'ISO14001-9.1 — Monitoring & measurement gaps', 'ISO14001-6.2 — Environmental objectives not tracked', 'ISO14001-8.1 — Operational controls not documented'],
      },
      ISO45001: {
        default: ['ISO45001-6.1 — Hazard identification gaps', 'ISO45001-9.1 — OH&S performance not measured', 'ISO45001-8.1 — Operational planning incomplete', 'ISO45001-10.2 — Incident investigation delays'],
      },
    };

    const fwGaps = frameworkGaps[primaryFramework] ?? frameworkGaps.SOC2;
    const industryGaps = fwGaps[industry] ?? fwGaps.default ?? frameworkGaps.SOC2.default;
    return industryGaps.slice(0, 4);
  }

  private getImprovementTip(orgScore: number, peerAvg: number, industry: string) {
    if (orgScore >= peerAvg + 15) {
      return `You're significantly ahead of ${industry} peers. Focus on evidence freshness and operational metrics to maintain your lead.`;
    }
    if (orgScore >= peerAvg) {
      return `You're above the ${industry} average. Addressing the common peer gaps below could push you into the top quartile.`;
    }
    return `Most ${industry} companies at your stage accelerate by formalizing change management and completing access control reviews first.`;
  }

  private parseSizeBucket(employeeCountStr: string): string {
    // employeeCount is stored as range strings like "1-50", "51-200", "201-1000", "1001+"
    const lower = parseInt(employeeCountStr.split('-')[0].replace(/\D/g, ''), 10) || 1;
    if (lower <= 50) return '1-50';
    if (lower <= 200) return '51-200';
    if (lower <= 1000) return '201-1000';
    return '1000+';
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}
