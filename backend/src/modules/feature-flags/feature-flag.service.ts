import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);

  // Simple in-memory cache (5 min TTL) — replace with Redis for multi-instance
  private cache = new Map<string, { value: boolean; expiresAt: number }>();
  private readonly TTL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluate whether a feature flag is enabled for a given org.
   * Evaluation order: disabledOrgIds → enabledOrgIds → enabledGlobally → rolloutPercent
   */
  async isEnabled(key: string, orgId: string): Promise<boolean> {
    const cacheKey = `${key}:${orgId}`;
    const cached   = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let result = false;
    try {
      const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
      if (!flag) {
        result = false;
      } else if (flag.disabledOrgIds.includes(orgId)) {
        result = false;
      } else if (flag.enabledOrgIds.includes(orgId)) {
        result = true;
      } else if (flag.enabledGlobally) {
        result = true;
      } else if (flag.rolloutPercent > 0) {
        // Deterministic hash-based rollout
        result = this.hashPercent(`${key}:${orgId}`) < flag.rolloutPercent;
      }
    } catch (err) {
      this.logger.warn(`Feature flag lookup failed for ${key}: ${(err as Error).message}`);
      result = false;
    }

    this.cache.set(cacheKey, { value: result, expiresAt: Date.now() + this.TTL_MS });
    return result;
  }

  /**
   * Return all flags for an org as { key: boolean } map.
   * Used by the frontend `GET /feature-flags` endpoint.
   */
  async getAll(orgId: string): Promise<Record<string, boolean>> {
    const flags = await this.prisma.featureFlag.findMany();
    const results: Record<string, boolean> = {};
    for (const flag of flags) {
      results[flag.key] = await this.isEnabled(flag.key, orgId);
    }
    return results;
  }

  /** Invalidate cache for a specific flag */
  invalidate(key: string): void {
    for (const k of this.cache.keys()) {
      if (k.startsWith(`${key}:`)) this.cache.delete(k);
    }
  }

  // ── Deterministic hash ────────────────────────────────────────────────────────

  private hashPercent(input: string): number {
    // Simple djb2 hash → 0–99
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
      hash = hash & hash; // 32-bit
    }
    return Math.abs(hash) % 100;
  }
}
