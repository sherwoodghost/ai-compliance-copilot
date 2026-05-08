import {
  Injectable, NotFoundException, UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';
import * as crypto from 'crypto';

export interface CreateAuditorSessionDto {
  auditorName: string;
  auditorFirm?: string;
  auditorEmail?: string;
  expiresInDays?: number; // default 30
}

export interface CreateRfiDto {
  controlId?: string;
  question: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface RespondRfiDto {
  response: string;
}

@Injectable()
export class AuditorPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resend: ResendService,
  ) {}

  // ─── Session Management (org admins) ────────────────────────────────────────

  async createSession(orgId: string, createdBy: string, dto: CreateAuditorSessionDto) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (dto.expiresInDays ?? 30));

    return this.prisma.auditorSession.create({
      data: {
        orgId,
        createdBy,
        token,
        auditorName: dto.auditorName,
        auditorFirm: dto.auditorFirm,
        auditorEmail: dto.auditorEmail,
        expiresAt,
      },
    });
  }

  async listSessions(orgId: string) {
    return this.prisma.auditorSession.findMany({
      where: { orgId },
      include: {
        creator: { select: { id: true, fullName: true, email: true } },
        _count: { select: { rfis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(orgId: string, sessionId: string) {
    const session = await this.prisma.auditorSession.findFirst({
      where: { id: sessionId, orgId },
    });
    if (!session) throw new NotFoundException('Session not found');
    return this.prisma.auditorSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  // ─── Auditor Portal Access (token-gated) ─────────────────────────────────────

  async validateToken(token: string) {
    const session = await this.prisma.auditorSession.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });

    if (!session) throw new UnauthorizedException('Invalid auditor token');
    if (session.isRevoked) throw new ForbiddenException('This auditor session has been revoked');
    if (new Date() > session.expiresAt) throw new ForbiddenException('This auditor token has expired');

    // Update last access
    await this.prisma.auditorSession.update({
      where: { id: session.id },
      data: { lastAccessAt: new Date() },
    });

    return session;
  }

  async getPortalData(token: string) {
    const session = await this.validateToken(token);
    const orgId = session.orgId;

    const [controls, evidence, policies, rfis] = await Promise.all([
      this.prisma.organizationControl.findMany({
        where: { orgId },
        include: {
          control: {
            select: {
              id: true, code: true, title: true, category: true, description: true,
              evidence: {
                where: { orgId, isValid: true },
                select: { id: true, title: true, type: true, isValid: true, collectedAt: true, expiresAt: true },
              },
            },
          },
        },
        orderBy: [{ control: { category: 'asc' } }, { control: { code: 'asc' } }],
      }),
      this.prisma.evidence.findMany({
        where: { orgId, isValid: true },
        select: {
          id: true, title: true, type: true, collectedAt: true, expiresAt: true,
          control: { select: { id: true, code: true, title: true } },
        },
        orderBy: { collectedAt: 'desc' },
        take: 100,
      }),
      this.prisma.policy.findMany({
        where: { orgId, status: 'approved' },
        select: { id: true, title: true, version: true, approvedAt: true },
        orderBy: { approvedAt: 'desc' },
      }),
      this.prisma.auditorRfi.findMany({
        where: { auditorSessionId: session.id },
        include: {
          control: { select: { id: true, code: true, title: true } },
          responder: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      session: {
        id: session.id,
        auditorName: session.auditorName,
        auditorFirm: session.auditorFirm,
        expiresAt: session.expiresAt,
        organization: session.organization,
      },
      controls,
      evidence,
      policies,
      rfis,
    };
  }

  // ─── RFI Management ──────────────────────────────────────────────────────────

  async createRfi(token: string, dto: CreateRfiDto) {
    const session = await this.validateToken(token);

    const rfi = await this.prisma.auditorRfi.create({
      data: {
        orgId: session.orgId,
        auditorSessionId: session.id,
        controlId: dto.controlId,
        question: dto.question,
        priority: dto.priority ?? 'medium',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    // Notify org admins — fire-and-forget, never blocks the response
    this.notifyAdminsOfRfi(session, rfi).catch(() => {});

    return rfi;
  }

  private async notifyAdminsOfRfi(session: any, rfi: any): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { name: true },
    });
    const admins = await this.prisma.user.findMany({
      where: { orgId: session.orgId, role: 'admin', isActive: true },
      select: { email: true },
    });
    const orgName = org?.name ?? 'Your Organization';

    await Promise.all(
      admins.map((admin) =>
        this.resend.sendAuditorRfiNotification({
          to:          admin.email,
          orgName,
          auditorName: session.auditorName,
          auditorFirm: session.auditorFirm,
          question:    rfi.question,
          controlCode: rfi.control?.code,
          priority:    rfi.priority,
        }),
      ),
    );
  }

  async listRfis(orgId: string, status?: string) {
    return this.prisma.auditorRfi.findMany({
      where: { orgId, ...(status && { status }) },
      include: {
        control: { select: { id: true, code: true, title: true } },
        auditorSession: { select: { auditorName: true, auditorFirm: true } },
        responder: { select: { id: true, fullName: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async respondRfi(orgId: string, userId: string, rfiId: string, dto: RespondRfiDto) {
    const rfi = await this.prisma.auditorRfi.findFirst({
      where: { id: rfiId, orgId },
    });
    if (!rfi) throw new NotFoundException('RFI not found');

    return this.prisma.auditorRfi.update({
      where: { id: rfiId },
      data: {
        response: dto.response,
        status: 'resolved',
        respondedBy: userId,
        respondedAt: new Date(),
      },
    });
  }
}
