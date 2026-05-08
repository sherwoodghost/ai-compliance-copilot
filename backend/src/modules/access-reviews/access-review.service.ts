import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

// ISO A.8.2 + SOC2 CC6.3 control codes this review generates evidence for
const ACCESS_REVIEW_CONTROL_CODES = ['A.8.2', 'A.5.18', 'CC6.3'];

export interface CreateAccessReviewDto {
  reviewerId: string;
  dueDate: string;
  items: {
    userId: string;
    system: string;
    accessLevel: string;
    lastUsedAt?: string;
  }[];
}

export interface SignOffDto {
  decisions: {
    itemId: string;
    decision: 'APPROVE' | 'MODIFY' | 'REVOKE';
    reason?: string;
  }[];
}

@Injectable()
export class AccessReviewService {
  private readonly logger = new Logger(AccessReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all access reviews for an org */
  async listReviews(orgId: string) {
    return this.prisma.accessReview.findMany({
      where: { orgId },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true } },
        items: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  /** Get a single review */
  async getReview(orgId: string, reviewId: string) {
    const review = await this.prisma.accessReview.findFirst({
      where: { id: reviewId, orgId },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true } },
        items: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });
    if (!review) throw new NotFoundException('Access review not found');
    return review;
  }

  /**
   * Generate quarterly access reviews — one per manager.
   * Creates AccessReview records and corresponding tasks for each manager.
   */
  async generateQuarterlyReviews(orgId: string, actorId: string) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 21); // 21 days from now

    // Find all active users who have direct reports
    const managers = await this.prisma.user.findMany({
      where: {
        orgId,
        status: 'active',
        directReports: { some: {} },
      },
      include: {
        directReports: {
          where: { status: 'active' },
          select: { id: true, fullName: true },
        },
      },
    } as any);

    // If no managers with direct reports, create one global review for the actor
    const reviewTargets = (managers as any[]).length > 0 ? (managers as any[]) : [
      { id: actorId, directReports: await this.getOrgUsers(orgId) },
    ];

    const created: any[] = [];

    for (const manager of reviewTargets) {
      if (!manager.directReports?.length) continue;

      // Check for existing open review for this manager
      const existing = await this.prisma.accessReview.findFirst({
        where: {
          orgId,
          reviewerId: manager.id,
          status: { in: ['pending', 'in_progress'] },
        } as any,
      });
      if (existing) continue;

      // Build items from direct reports
      const items = [];
      for (const report of manager.directReports) {
        // Default systems — would come from integrations in production
        const defaultSystems = ['GitHub', 'AWS Console', 'Production Database', 'Slack'];
        for (const system of defaultSystems) {
          items.push({
            userId: report.id,
            system,
            accessLevel: 'Member',
          });
        }
      }

      const review = await this.prisma.accessReview.create({
        data: {
          orgId,
          reviewerId: manager.id,
          dueDate,
          status: 'pending',
          items: {
            create: items,
          },
        } as any,
        include: {
          reviewer: { select: { id: true, fullName: true } },
          items: true,
        },
      });

      // Create a corresponding task for the manager
      await this.prisma.task.create({
        data: {
          orgId,
          title: `Quarterly Access Review — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
          description: `Review access levels for ${items.length / 4} direct reports across ${4} systems. Sign off to generate ISO A.8.2 evidence.`,
          status: 'open',
          priority: 'high',
          assignedTo: manager.id,
          dueDate,
          isGuided: true,
          kind: 'ACCESS_REVIEW',
          guidance: {
            why: 'Quarterly access reviews are required by ISO 27001 A.8.2 and SOC 2 CC6.3 to ensure access rights remain appropriate.',
            evidenceHint: 'Review each team member\'s access, approve or revoke, then sign off to auto-generate evidence.',
            stepByStep: [
              'Open the access review in Team → Access Reviews',
              'For each team member, review their system access',
              'Select APPROVE, MODIFY, or REVOKE for each access',
              'Add a reason for any REVOKE decisions',
              'Click "Sign Off" to generate evidence',
            ],
            controlCategory: 'Access Management',
          },
        } as any,
      });

      created.push(review);
    }

    this.logger.log(`Generated ${created.length} quarterly access reviews for org ${orgId}`);
    return { created: created.length, reviews: created };
  }

  /**
   * Sign off on an access review.
   * Generates HMAC signature, creates Evidence, maps to A.8.2 + CC6.3.
   */
  async signOff(
    orgId: string,
    reviewId: string,
    actorId: string,
    dto: SignOffDto,
  ) {
    const review = await this.getReview(orgId, reviewId);

    if (review.status === 'signed') {
      throw new BadRequestException('This review has already been signed off');
    }

    // Apply decisions to all items
    for (const dec of dto.decisions) {
      await this.prisma.accessReviewItem.update({
        where: { id: dec.itemId },
        data: {
          decision: dec.decision,
          reason: dec.reason,
        } as any,
      });
    }

    // Check all items have a decision
    const updatedReview = await this.getReview(orgId, reviewId);
    const undecided = updatedReview.items.filter((i) => !(i as any).decision);
    if (undecided.length > 0) {
      throw new BadRequestException(
        `${undecided.length} access review items still need a decision`,
      );
    }

    // Generate HMAC signature
    const signatureData = `${reviewId}:${actorId}:${new Date().toISOString()}:${dto.decisions.map((d) => `${d.itemId}=${d.decision}`).join(',')}`;
    const signatureHash = crypto.createHmac('sha256', process.env.JWT_SECRET ?? 'secret').update(signatureData).digest('hex');

    const completedAt = new Date();

    // Generate Evidence record
    const evidenceTitle = `Quarterly Access Review — ${completedAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} — Signed by ${(updatedReview.reviewer as any).fullName}`;
    const evidenceContent = JSON.stringify({
      reviewId,
      reviewerId: actorId,
      reviewerName: (updatedReview.reviewer as any).fullName,
      completedAt: completedAt.toISOString(),
      totalItems: updatedReview.items.length,
      approved: dto.decisions.filter((d) => d.decision === 'APPROVE').length,
      modified: dto.decisions.filter((d) => d.decision === 'MODIFY').length,
      revoked: dto.decisions.filter((d) => d.decision === 'REVOKE').length,
      signatureHash,
    }, null, 2);

    // Find controls for evidence mapping
    const controlCodes = ACCESS_REVIEW_CONTROL_CODES;
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId, control: { code: { in: controlCodes } } },
      include: { control: { select: { id: true, code: true } } },
    });

    // Create evidence
    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        title: evidenceTitle,
        description: `Signed access review with ${updatedReview.items.length} access decisions`,
        fileType: 'application/json',
        fileSize: evidenceContent.length,
        storageUrl: `evidence/access-reviews/${reviewId}/sign-off.json`,
        uploadedBy: actorId,
        controlId: orgControls[0]?.controlId,
        reviewedBy: actorId,
        expiresAt: new Date(completedAt.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year
      } as any,
    });

    // Map evidence to all access control codes
    for (const orgControl of orgControls) {
      try {
        await this.prisma.controlEvidence.create({
          data: {
            evidenceId: evidence.id,
            controlId: orgControl.controlId,
            orgId,
            confidence: 100,
            mappedBy: 'access_review_signoff',
          } as any,
        });
      } catch {}
    }

    // Update review status
    const signedReview = await this.prisma.accessReview.update({
      where: { id: reviewId },
      data: {
        status: 'signed',
        completedAt,
        signedAt: completedAt,
        signatureHash,
        evidenceId: evidence.id,
      } as any,
    });

    // Update reviewer's lastAccessReviewAt
    await this.prisma.user.update({
      where: { id: actorId },
      data: { lastAccessReviewAt: completedAt } as any,
    });

    // Create tasks for REVOKE decisions
    const revokes = dto.decisions.filter((d) => d.decision === 'REVOKE');
    for (const dec of revokes) {
      const item = updatedReview.items.find((i) => i.id === dec.itemId);
      if (item) {
        // Find IT admin to assign deprovisioning task
        const itAdmin = await this.prisma.complianceResponsibility.findFirst({
          where: { orgId, role: 'IT_ADMIN' },
          include: { user: { select: { id: true } } },
        } as any);

        await this.prisma.task.create({
          data: {
            orgId,
            title: `Revoke ${(item as any).system} access for ${((item as any).user as any)?.fullName ?? 'user'}`,
            description: `Access review decision: REVOKE ${(item as any).accessLevel} access on ${(item as any).system}. Reason: ${dec.reason ?? 'Access review decision'}`,
            status: 'open',
            priority: 'high',
            assignedTo: (itAdmin as any)?.user?.id ?? actorId,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
          } as any,
        });
      }
    }

    this.logger.log(`Access review ${reviewId} signed off by ${actorId}. Evidence: ${evidence.id}`);
    return {
      review: signedReview,
      evidence,
      signatureHash,
      revokeTasks: revokes.length,
    };
  }

  private async getOrgUsers(orgId: string) {
    return this.prisma.user.findMany({
      where: { orgId, status: 'active' },
      select: { id: true, fullName: true },
    });
  }
}
