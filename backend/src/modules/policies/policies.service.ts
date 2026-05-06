import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policies.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';

@Injectable()
export class PoliciesService {
  private readonly logger = new Logger(PoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
  ) {}

  async findAll(orgId: string, controlId?: string, status?: string) {
    return this.prisma.policy.findMany({
      where: {
        orgId,
        ...(controlId && { controlId }),
        ...(status && { status: status as any }),
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
        approver: { select: { id: true, fullName: true } },
      },
      orderBy: [{ controlId: 'asc' }, { version: 'desc' }],
    });
  }

  async findOne(orgId: string, policyId: string) {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, orgId },
      include: {
        control: { include: { framework: true } },
        approver: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async create(orgId: string, dto: CreatePolicyDto) {
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId: dto.controlId } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    // Auto-increment version for this control
    const latestVersion = await this.prisma.policy.findFirst({
      where: { orgId, controlId: dto.controlId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const policy = await this.prisma.policy.create({
      data: {
        orgId,
        controlId: dto.controlId,
        title: dto.title,
        content: dto.content,
        version: (latestVersion?.version ?? 0) + 1,
        status: 'draft',
        generatedBy: dto.generatedBy ?? 'human',
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`Policy created: v${policy.version} for control: ${dto.controlId}`);
    return policy;
  }

  async update(orgId: string, policyId: string, dto: UpdatePolicyDto) {
    const policy = await this.findOne(orgId, policyId);

    if (policy.status === 'approved' && dto.content) {
      throw new BadRequestException(
        'Cannot edit an approved policy. Create a new version instead.',
      );
    }

    return this.prisma.policy.update({
      where: { id: policyId },
      data: {
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async approve(orgId: string, policyId: string, approverId: string) {
    const policy = await this.findOne(orgId, policyId);

    if (policy.status === 'approved') {
      throw new BadRequestException('Policy is already approved');
    }

    if (policy.status === 'archived') {
      throw new BadRequestException('Cannot approve an archived policy');
    }

    const updated = await this.prisma.policy.update({
      where: { id: policyId },
      data: {
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
      include: {
        approver: { select: { id: true, fullName: true } },
      },
    });

    // Index the approved policy into RAG for retrieval by other agents
    this.ragIndexer.indexPolicy(orgId, policyId).catch((err) =>
      this.logger.warn(`RAG indexing failed for policy ${policyId}: ${err.message}`),
    );

    return updated;
  }

  async archive(orgId: string, policyId: string) {
    await this.findOne(orgId, policyId);
    return this.prisma.policy.update({
      where: { id: policyId },
      data: { status: 'archived' },
    });
  }

  async createNewVersion(orgId: string, policyId: string, content: string) {
    const policy = await this.findOne(orgId, policyId);

    // Archive the old approved version
    if (policy.status === 'approved') {
      await this.prisma.policy.update({
        where: { id: policyId },
        data: { status: 'archived' },
      });
    }

    return this.prisma.policy.create({
      data: {
        orgId,
        controlId: policy.controlId,
        title: policy.title,
        content,
        version: policy.version + 1,
        status: 'draft',
        generatedBy: 'human',
      },
    });
  }

  async getVersionHistory(orgId: string, controlId: string) {
    return this.prisma.policy.findMany({
      where: { orgId, controlId },
      select: {
        id: true,
        version: true,
        status: true,
        generatedBy: true,
        approvedAt: true,
        createdAt: true,
        approver: { select: { fullName: true } },
      },
      orderBy: { version: 'desc' },
    });
  }
}
