import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

// Standard ISO 9.3 agenda items
const ISO_93_AGENDA_ITEMS = [
  { item: 'Status of actions from previous management reviews', category: 'follow_up' },
  { item: 'Changes in external and internal issues relevant to the ISMS', category: 'context' },
  { item: 'Feedback on information security performance, including: non-conformities, corrective actions, monitoring results, audit results, fulfilment of information security objectives', category: 'performance' },
  { item: 'Feedback from interested parties', category: 'stakeholder' },
  { item: 'Results of risk assessment and status of risk treatment plan', category: 'risk' },
  { item: 'Opportunities for continual improvement', category: 'improvement' },
];

@Injectable()
export class ManagementReviewService {
  private readonly logger = new Logger(ManagementReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List management reviews for an org */
  async listReviews(orgId: string) {
    return this.prisma.managementReview.findMany({
      where: { orgId },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  /** Get one review */
  async getReview(orgId: string, reviewId: string) {
    const review = await this.prisma.managementReview.findFirst({
      where: { id: reviewId, orgId },
    });
    if (!review) throw new NotFoundException('Management review not found');
    return review;
  }

  /**
   * Schedule a management review.
   * Pre-populates with ISO 9.3 standard agenda items.
   */
  async scheduleReview(
    orgId: string,
    actorId: string,
    dto: { scheduledAt: string; attendees: string[] },
  ) {
    const scheduledAt = new Date(dto.scheduledAt);

    const review = await this.prisma.managementReview.create({
      data: {
        orgId,
        scheduledAt,
        attendees: dto.attendees,
        agendaItems: ISO_93_AGENDA_ITEMS,
        actions: [],
      } as any,
    });

    // Create a task for COMPLIANCE_LEAD to prepare the review
    const complianceLead = await this.prisma.complianceResponsibility.findFirst({
      where: { orgId, role: 'COMPLIANCE_LEAD' } as any,
      include: { user: { select: { id: true } } },
    } as any);

    await this.prisma.task.create({
      data: {
        orgId,
        title: `Prepare Management Review — ${scheduledAt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        description: `Prepare for ISO Clause 9.3 management review on ${scheduledAt.toDateString()}. Complete agenda, gather performance data, and ensure all attendees are confirmed.`,
        status: 'open',
        priority: 'high',
        assignedTo: (complianceLead as any)?.user?.id ?? actorId,
        dueDate: new Date(scheduledAt.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days before
        isGuided: true,
        kind: 'ATTESTATION',
        guidance: {
          why: 'ISO 27001 Clause 9.3 requires top management to review the ISMS at planned intervals to ensure its continuing suitability, adequacy, and effectiveness.',
          evidenceHint: 'Minutes of the management review meeting, signed by the management representative.',
          stepByStep: [
            'Gather inputs: audit results, risk register status, control effectiveness data',
            'Prepare agenda pre-populated with ISO 9.3 input items',
            'Conduct the review meeting with management attendees',
            'Record minutes, decisions, and action items',
            'Sign off the review to generate compliance evidence',
          ],
          controlCategory: 'Management System',
        },
      } as any,
    });

    this.logger.log(`Management review scheduled for ${scheduledAt.toISOString()} in org ${orgId}`);
    return review;
  }

  /**
   * Update review with minutes and action items.
   */
  async updateReview(
    orgId: string,
    reviewId: string,
    dto: {
      minutes?: string;
      actions?: { item: string; owner: string; dueDate: string; status: string }[];
      completedAt?: string;
    },
  ) {
    await this.getReview(orgId, reviewId);

    return this.prisma.managementReview.update({
      where: { id: reviewId },
      data: {
        minutes:     dto.minutes,
        actions:     dto.actions ?? [],
        completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
      } as any,
    });
  }

  /**
   * Sign off a management review.
   * Generates Evidence mapped to ISO Clause 9.3 (A.5.35 equivalent).
   */
  async signOff(orgId: string, reviewId: string, actorId: string) {
    const review = await this.getReview(orgId, reviewId);

    if (!(review as any).completedAt && !(review as any).minutes) {
      throw new BadRequestException('Cannot sign off: review has no minutes recorded');
    }

    if ((review as any).signedBy) {
      throw new BadRequestException('This review has already been signed off');
    }

    const signedAt = new Date();

    // Find ISO A.5.35 (or generic ISMS oversight) control
    const orgControl = await this.prisma.organizationControl.findFirst({
      where: {
        orgId,
        control: { code: { in: ['A.5.35', 'A.5.36', 'A.9.3'] } },
      },
      include: { control: { select: { id: true, code: true } } },
    });

    // Create evidence
    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        title: `Management Review Minutes — ${(review as any).scheduledAt ? new Date((review as any).scheduledAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Review'}`,
        description: `ISO Clause 9.3 management review completed with ${(review as any).attendees?.length ?? 0} attendees. ${((review as any).actions ?? []).length} action items recorded.`,
        fileType: 'application/json',
        fileSize: JSON.stringify(review).length,
        storageUrl: `evidence/management-reviews/${reviewId}/minutes.json`,
        uploadedBy: actorId,
        controlId: (orgControl as any)?.control?.id,
        reviewedBy: actorId,
        expiresAt: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
      } as any,
    });

    if (orgControl) {
      await this.prisma.controlEvidence.create({
        data: {
          evidenceId: evidence.id,
          controlId: (orgControl as any).control.id,
          orgId,
          confidence: 100,
          mappedBy: 'management_review_signoff',
        } as any,
      }).catch(() => {});
    }

    // Update review
    const signed = await this.prisma.managementReview.update({
      where: { id: reviewId },
      data: {
        signedBy:   actorId,
        signedAt,
        completedAt: (review as any).completedAt ?? signedAt,
        evidenceId: evidence.id,
      } as any,
    });

    this.logger.log(`Management review ${reviewId} signed off by ${actorId}. Evidence: ${evidence.id}`);
    return { review: signed, evidence };
  }
}
