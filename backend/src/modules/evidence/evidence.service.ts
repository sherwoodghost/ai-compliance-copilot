import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { CreateEvidenceDto, UpdateEvidenceDto } from './dto/evidence.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
    private readonly llm: LlmService,
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

    // AI validation (non-blocking)
    this.validateEvidenceWithAI(orgId, evidence).catch((err) =>
      this.logger.warn(`AI validation failed for evidence ${evidence.id}: ${err.message}`),
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

  // ─── AI: Validate evidence quality and assign confidence score ──────────────
  private async validateEvidenceWithAI(orgId: string, evidence: any) {
    const controlCode = evidence.control?.code ?? '';
    const controlTitle = evidence.control?.title ?? '';

    const prompt = `You are a compliance auditor. Analyze this evidence item and assess its quality.

Evidence Title: "${evidence.title}"
Evidence Type: ${evidence.type}
Control: ${controlCode} - ${controlTitle}

Respond with ONLY valid JSON (no explanation):
{
  "confidence": <integer 0-100>,
  "summary": "<1-2 sentence summary of what this evidence demonstrates>",
  "flags": ["<concern or gap if any>"]
}`;

    const response = await this.llm.complete(
      [{ role: 'user', content: prompt }],
      { agentName: 'evidence-validator', maxTokens: 300, temperature: 0.1 },
    );

    const match = response.content.match(/\{[\s\S]*\}/);
    if (!match) return;

    const parsed = JSON.parse(match[0]) as {
      confidence?: number;
      summary?: string;
      flags?: string[];
    };
    if (parsed.confidence === undefined) return;

    const existingMeta = ((evidence.metadata as Record<string, unknown>) ?? {});
    await this.prisma.evidence.update({
      where: { id: evidence.id },
      data: {
        metadata: {
          ...existingMeta,
          aiConfidence: Math.min(100, Math.max(0, parsed.confidence)),
          aiSummary: parsed.summary ?? '',
          aiFlags: parsed.flags ?? [],
          aiValidatedAt: new Date().toISOString(),
        } as any,
      },
    });

    this.logger.log(`AI validation complete for evidence ${evidence.id}: confidence=${parsed.confidence}`);
  }

  // ─── AI: Suggest additional controls this evidence might satisfy ─────────────
  async suggestControlMappings(orgId: string, evidenceId: string) {
    const evidence = await this.findOne(orgId, evidenceId);

    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: { control: { select: { id: true, code: true, title: true } } },
      take: 60,
    });

    const currentCode = (evidence as any).control?.code ?? '';
    const controlList = orgControls
      .filter((oc) => oc.control.code !== currentCode)
      .map((oc) => `${oc.control.code}: ${oc.control.title}`)
      .join('\n');

    const prompt = `You are a compliance expert. Given this evidence item, identify which OTHER compliance controls it might also satisfy.

Evidence: "${evidence.title}" (type: ${evidence.type})
Already mapped to: ${currentCode}

Available controls:
${controlList}

Return ONLY a JSON array of control codes with high confidence (>75%) matches, max 5:
["CC6.1", "CC6.2"]

If no strong matches, return [].`;

    const response = await this.llm.complete(
      [{ role: 'user', content: prompt }],
      { agentName: 'evidence-mapper', maxTokens: 200, temperature: 0.1 },
    );

    const match = response.content.match(/\[[\s\S]*\]/);
    const codes: string[] = match ? JSON.parse(match[0]) : [];

    const suggestions = orgControls
      .filter((oc) => codes.includes(oc.control.code))
      .map((oc) => ({
        controlId: oc.controlId,
        code: oc.control.code,
        title: oc.control.title,
      }));

    return { evidenceId, currentControlCode: currentCode, suggestions };
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
