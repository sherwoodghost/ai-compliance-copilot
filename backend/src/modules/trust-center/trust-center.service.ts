import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UpdateTrustCenterDto {
  companyName?:  string;
  logoUrl?:      string;
  primaryColor?: string;
  headline?:     string;
  description?:  string;
  showControls?: boolean;
  showEvidence?: boolean;
}

export interface CreateAccessLinkDto {
  label:        string;
  expiresInDays?: number;  // null = no expiry
}

@Injectable()
export class TrustCenterService {
  private readonly logger = new Logger(TrustCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Org-facing methods (authenticated) ──────────────────────────────────

  async getOrCreate(orgId: string) {
    const existing = await this.prisma.trustCenter.findUnique({ where: { orgId } });
    if (existing) return existing;

    // Auto-generate a slug from the org name
    const org  = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true, slug: true } });
    const slug = org?.slug ?? orgId.slice(0, 8);

    return this.prisma.trustCenter.create({
      data: {
        orgId,
        slug,
        companyName: org?.name ?? 'Trust Center',
        headline:    'Our Commitment to Security & Compliance',
        description: 'We take security seriously. This page provides transparency into our compliance posture.',
        primaryColor: '#6366f1',
        isPublic:    false,
      },
    });
  }

  async update(orgId: string, dto: UpdateTrustCenterDto) {
    const tc = await this.prisma.trustCenter.findUnique({ where: { orgId } });
    if (!tc) throw new NotFoundException('Trust Center not found — call GET /trust-center first to initialise');

    // Ensure slug uniqueness if slug would change (we don't allow slug updates for now)
    return this.prisma.trustCenter.update({
      where: { orgId },
      data:  dto,
    });
  }

  async publish(orgId: string) {
    const tc = await this.getOrCreate(orgId);
    return this.prisma.trustCenter.update({
      where: { orgId },
      data:  { isPublic: true, publishedAt: new Date() },
    });
  }

  async unpublish(orgId: string) {
    await this.getOrCreate(orgId);
    return this.prisma.trustCenter.update({
      where: { orgId },
      data:  { isPublic: false },
    });
  }

  async createAccessLink(orgId: string, dto: CreateAccessLinkDto) {
    const tc = await this.getOrCreate(orgId);

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.trustCenterAccessLink.create({
      data: {
        trustCenterId: tc.id,
        token:         crypto.randomUUID(),
        label:         dto.label,
        expiresAt,
      },
    });
  }

  async listAccessLinks(orgId: string) {
    const tc = await this.getOrCreate(orgId);
    return this.prisma.trustCenterAccessLink.findMany({
      where:   { trustCenterId: tc.id },
      orderBy: { expiresAt: 'asc' },
    });
  }

  // ─── Public page (no auth) ────────────────────────────────────────────────

  async getPublicBySlug(slug: string, token?: string) {
    const tc = await this.prisma.trustCenter.findUnique({ where: { slug } });

    if (!tc) throw new NotFoundException('Trust center not found');

    // Check access: must be public OR have a valid access link token
    if (!tc.isPublic) {
      if (!token) throw new ForbiddenException('This trust center is private');

      const link = await this.prisma.trustCenterAccessLink.findUnique({ where: { token } });
      if (!link || link.trustCenterId !== tc.id) throw new ForbiddenException('Invalid access token');
      if (link.expiresAt && link.expiresAt < new Date()) throw new ForbiddenException('Access link has expired');

      // Increment view count
      await this.prisma.trustCenterAccessLink.update({
        where: { token },
        data:  { viewCount: { increment: 1 } },
      }).catch(() => {}); // non-fatal
    }

    const passRate    = await this.getControlPassRate(tc.orgId);
    const frameworks  = tc.showControls ? await this.getFrameworkSummary(tc.orgId) : [];

    return { trustCenter: tc, passRate, frameworks };
  }

  // ─── Internal helpers ─────────────────────────────────────────────────────

  async getControlPassRate(orgId: string) {
    const results = await this.prisma.controlTestResult.findMany({
      where:   { orgId },
      orderBy: { testedAt: 'desc' },
    });

    // Deduplicate: take latest result per testId
    const seen    = new Set<string>();
    const latest  = results.filter((r) => {
      if (seen.has(r.testId)) return false;
      seen.add(r.testId);
      return true;
    });

    const total   = latest.length;
    const pass    = latest.filter((r) => r.outcome === 'pass').length;
    const fail    = latest.filter((r) => r.outcome === 'fail').length;
    const skipped = latest.filter((r) => r.outcome === 'skipped').length;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;

    return { total, pass, fail, skipped, passRate };
  }

  private async getFrameworkSummary(orgId: string) {
    const orgControls = await this.prisma.organizationControl.findMany({
      where:   { orgId },
      include: { control: { include: { framework: true } } },
    });

    // Group by framework
    const byFramework: Record<string, { code: string; status: string }[]> = {};

    for (const oc of orgControls) {
      const fw = oc.control.framework.name;
      if (!byFramework[fw]) byFramework[fw] = [];
      byFramework[fw].push({ code: oc.control.code, status: oc.status });
    }

    return Object.entries(byFramework).map(([framework, controls]) => ({
      framework,
      total:       controls.length,
      implemented: controls.filter((c) => c.status === 'implemented').length,
      inProgress:  controls.filter((c) => c.status === 'in_progress').length,
      notStarted:  controls.filter((c) => c.status === 'not_started').length,
    }));
  }
}
