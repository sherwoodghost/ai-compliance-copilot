import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class ProfileVersioningService {
  private readonly logger = new Logger(ProfileVersioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Snapshot the current business profile before any change */
  async createVersion(
    orgId: string,
    changedById: string,
    changeReason?: string,
  ): Promise<void> {
    const profile = await this.prisma.businessProfile.findUnique({ where: { orgId } });
    if (!profile) return;

    const latest = await this.prisma.businessProfileVersion.findFirst({
      where: { orgId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (latest?.version ?? 0) + 1;

    // Compute diff (top-level keys that changed)
    const prev = (latest?.snapshot ?? {}) as Record<string, unknown>;
    const curr = profile as Record<string, unknown>;
    const diff: Record<string, { from: unknown; to: unknown }> = {};

    for (const key of new Set([...Object.keys(prev), ...Object.keys(curr)])) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
        diff[key] = { from: prev[key], to: curr[key] };
      }
    }

    await this.prisma.businessProfileVersion.create({
      data: {
        orgId,
        version: nextVersion,
        snapshot: curr as any,
        changedById,
        changeReason,
        diff: diff as any,
      },
    });

    this.logger.log(`BusinessProfile v${nextVersion} snapshot created for org ${orgId}`);
  }

  /** Get all versions for an org */
  async listVersions(orgId: string) {
    return this.prisma.businessProfileVersion.findMany({
      where: { orgId },
      include: {
        changedBy: { select: { fullName: true, email: true } },
      },
      orderBy: { version: 'desc' },
    });
  }

  /** Restore a specific version (creates a new version of the restored state) */
  async rollback(orgId: string, targetVersion: number, changedById: string): Promise<void> {
    const versionRecord = await this.prisma.businessProfileVersion.findUnique({
      where: { orgId_version: { orgId, version: targetVersion } },
    });
    if (!versionRecord) throw new Error(`Version ${targetVersion} not found for org ${orgId}`);

    // Snapshot current before overwriting
    await this.createVersion(orgId, changedById, `Rollback to v${targetVersion}`);

    // Restore — only update fields stored in the profile model
    const snap = versionRecord.snapshot as Record<string, unknown>;
    await this.prisma.businessProfile.update({
      where: { orgId },
      data: {
        companyName: snap.companyName as string,
        companyType: snap.companyType as any,
        industry: snap.industry as any,
        employeeCount: snap.employeeCount as string,
        infrastructure: snap.infrastructure as any,
        tools: snap.tools as any,
        dataHandling: snap.dataHandling as any,
        currentPosture: snap.currentPosture as any,
        complianceGoals: snap.complianceGoals as any,
        riskProfile: snap.riskProfile as any,
      },
    });

    this.logger.log(`BusinessProfile rolled back to v${targetVersion} for org ${orgId}`);
  }
}
