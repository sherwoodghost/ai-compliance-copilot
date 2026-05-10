import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface EvidenceHealthItem {
  id: string;
  title: string;
  controlCode: string;
  controlTitle: string;
  framework: string;
  type: string;
  source: string;
  collectedAt: string;
  expiresAt: string | null;
  isValid: boolean;
  status: 'fresh' | 'expiring_soon' | 'expired' | 'stale' | 'invalid';
  daysUntilExpiry: number | null;
  daysSinceCollection: number;
}

export interface EvidenceHealthSummary {
  totalEvidence: number;
  fresh: number;
  expiringSoon: number; // within 30 days
  expired: number;
  stale: number; // collected > 90 days ago and no expiry set
  invalid: number;
  coverageRate: number; // % of applicable controls with valid evidence
  controlsWithoutEvidence: number;
  avgDaysSinceCollection: number;
  byFramework: { framework: string; total: number; fresh: number; atRisk: number }[];
  byType: { type: string; count: number }[];
}

export interface EvidenceHealthReport {
  summary: EvidenceHealthSummary;
  items: EvidenceHealthItem[];
}

@Injectable()
export class EvidenceHealthService {
  private readonly logger = new Logger(EvidenceHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getHealthReport(orgId: string): Promise<EvidenceHealthReport> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Get all evidence with control and framework info
    const evidence = await this.prisma.evidence.findMany({
      where: { orgId },
      include: {
        control: {
          include: {
            framework: { select: { name: true } },
          },
        },
      },
      orderBy: { collectedAt: 'desc' },
    });

    // Get applicable controls for coverage calculation
    const applicableControls = await this.prisma.controlApplicability.findMany({
      where: { orgId, applicable: true },
      select: { controlId: true },
    });

    const controlsWithEvidence = new Set(
      evidence.filter((e) => e.isValid).map((e) => e.controlId),
    );

    const items: EvidenceHealthItem[] = evidence.map((e) => {
      const daysSinceCollection = Math.floor(
        (now.getTime() - new Date(e.collectedAt).getTime()) / (24 * 60 * 60 * 1000),
      );

      let daysUntilExpiry: number | null = null;
      if (e.expiresAt) {
        daysUntilExpiry = Math.floor(
          (new Date(e.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );
      }

      let status: EvidenceHealthItem['status'];
      if (!e.isValid) {
        status = 'invalid';
      } else if (e.expiresAt && new Date(e.expiresAt) < now) {
        status = 'expired';
      } else if (e.expiresAt && new Date(e.expiresAt) < thirtyDaysFromNow) {
        status = 'expiring_soon';
      } else if (!e.expiresAt && new Date(e.collectedAt) < ninetyDaysAgo) {
        status = 'stale';
      } else {
        status = 'fresh';
      }

      return {
        id: e.id,
        title: e.title,
        controlCode: e.control.code,
        controlTitle: e.control.title,
        framework: e.control.framework.name,
        type: e.type,
        source: e.source,
        collectedAt: e.collectedAt.toISOString(),
        expiresAt: e.expiresAt?.toISOString() ?? null,
        isValid: e.isValid,
        status,
        daysUntilExpiry,
        daysSinceCollection,
      };
    });

    // Summary stats
    const fresh = items.filter((i) => i.status === 'fresh').length;
    const expiringSoon = items.filter((i) => i.status === 'expiring_soon').length;
    const expired = items.filter((i) => i.status === 'expired').length;
    const stale = items.filter((i) => i.status === 'stale').length;
    const invalid = items.filter((i) => i.status === 'invalid').length;

    const coverageRate = applicableControls.length > 0
      ? Math.round((controlsWithEvidence.size / applicableControls.length) * 100)
      : 0;

    const controlsWithoutEvidence = applicableControls.length - controlsWithEvidence.size;

    const avgDays = items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.daysSinceCollection, 0) / items.length)
      : 0;

    // By framework
    const frameworkMap = new Map<string, { total: number; fresh: number; atRisk: number }>();
    for (const item of items) {
      const entry = frameworkMap.get(item.framework) ?? { total: 0, fresh: 0, atRisk: 0 };
      entry.total++;
      if (item.status === 'fresh') entry.fresh++;
      if (item.status === 'expired' || item.status === 'expiring_soon' || item.status === 'stale') entry.atRisk++;
      frameworkMap.set(item.framework, entry);
    }

    // By type
    const typeMap = new Map<string, number>();
    for (const item of items) {
      typeMap.set(item.type, (typeMap.get(item.type) ?? 0) + 1);
    }

    const summary: EvidenceHealthSummary = {
      totalEvidence: items.length,
      fresh,
      expiringSoon,
      expired,
      stale,
      invalid,
      coverageRate,
      controlsWithoutEvidence,
      avgDaysSinceCollection: avgDays,
      byFramework: Array.from(frameworkMap.entries()).map(([framework, data]) => ({
        framework,
        ...data,
      })),
      byType: Array.from(typeMap.entries()).map(([type, count]) => ({ type, count })),
    };

    return { summary, items };
  }
}
