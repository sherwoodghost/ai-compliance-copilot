import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEvidenceDto, UpdateEvidenceDto } from './dto/evidence.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
  ) {}

  async findAll(orgId: string, controlId?: string, isValid?: boolean) {
    return this.prisma.evidence.findMany({
      where: {
        orgId,
        ...(controlId && { controlId }),
        ...(isValid !== undefined && { isValid }),
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
      orderBy: { collectedAt: 'desc' },
    });
  }

  async findOne(orgId: string, evidenceId: string) {
    const evidence = await this.prisma.evidence.findFirst({
      where: { id: evidenceId, orgId },
      include: {
        control: { include: { framework: true } },
        reviewer: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!evidence) throw new NotFoundException('Evidence not found');
    return evidence;
  }

  async create(orgId: string, dto: CreateEvidenceDto, userId: string) {
    // Verify control belongs to this org
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId: dto.controlId } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        controlId: dto.controlId,
        title: dto.title,
        type: dto.type,
        source: dto.source,
        storageUrl: dto.storageUrl,
        metadata: (dto.metadata ?? {}) as any,
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
        reviewedBy: userId,
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`Evidence created: ${evidence.id} for control: ${dto.controlId}`);

    // Index into RAG for retrieval (non-blocking)
    this.ragIndexer.indexEvidence(orgId, evidence.id).catch((err) =>
      this.logger.warn(`RAG indexing failed for evidence ${evidence.id}: ${err.message}`),
    );

    return evidence;
  }

  async update(orgId: string, evidenceId: string, dto: UpdateEvidenceDto, userId: string) {
    await this.findOne(orgId, evidenceId);

    return this.prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.isValid !== undefined && { isValid: dto.isValid }),
        ...(dto.metadata && { metadata: dto.metadata as any }),
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
        reviewedBy: userId,
      },
    });
  }

  async delete(orgId: string, evidenceId: string) {
    const evidence = await this.findOne(orgId, evidenceId);

    if (evidence.source === 'integration') {
      throw new ForbiddenException('Integration-sourced evidence cannot be manually deleted');
    }

    await this.prisma.evidence.delete({ where: { id: evidenceId } });
    this.logger.log(`Evidence deleted: ${evidenceId}`);
  }

  async markInvalid(orgId: string, evidenceId: string, userId: string) {
    await this.findOne(orgId, evidenceId);
    return this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { isValid: false, reviewedBy: userId },
    });
  }

  async getExpiryReport(orgId: string) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const [expired, expiringSoon] = await Promise.all([
      this.prisma.evidence.findMany({
        where: { orgId, isValid: true, expiresAt: { lt: new Date() } },
        include: { control: { select: { code: true, title: true } } },
      }),
      this.prisma.evidence.findMany({
        where: {
          orgId,
          isValid: true,
          expiresAt: { gte: new Date(), lte: thirtyDaysFromNow },
        },
        include: { control: { select: { code: true, title: true } } },
      }),
    ]);

    return { expired, expiringSoon };
  }
}
