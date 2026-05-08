import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { CreateEvidenceDto, UpdateEvidenceDto, UploadEvidenceDto } from './dto/evidence.dto';
import { RagIndexerService } from '../../llm-gateway/rag/rag-indexer.service';
import { StorageService } from '../../storage/storage.service';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragIndexer: RagIndexerService,
    private readonly llm: LlmService,
    private readonly storage: StorageService,
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

  // ─── File Upload ────────────────────────────────────────────────────────────
  async uploadEvidence(
    orgId: string,
    file: Express.Multer.File,
    dto: UploadEvidenceDto,
    userId: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    // Verify control belongs to this org
    const orgControl = await this.prisma.organizationControl.findUnique({
      where: { orgId_controlId: { orgId, controlId: dto.controlId } },
    });
    if (!orgControl) throw new NotFoundException('Control not found for this organization');

    // Upload file to S3 (or placeholder if S3 not configured)
    const uploadResult = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      orgId,
    );

    const evidence = await this.prisma.evidence.create({
      data: {
        orgId,
        controlId: dto.controlId,
        title: dto.title,
        type: dto.type,
        source: 'manual_upload',
        storageUrl: uploadResult.url,
        contentHash: uploadResult.contentHash,
        isValid: true,
        collectedAt: new Date(),
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) }),
        reviewedBy: userId,
        metadata: {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          storageKey: uploadResult.key,
          storageBucket: uploadResult.bucket,
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        } as any,
      },
      include: {
        control: { select: { id: true, code: true, title: true } },
      },
    });

    this.logger.log(`File evidence uploaded: ${evidence.id} (${file.originalname}, ${file.size} bytes)`);

    // RAG index (non-blocking)
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
    const controlCode  = evidence.control?.code  ?? '';
    const controlTitle = evidence.control?.title ?? '';
    const fileName     = (evidence.metadata as any)?.fileName ?? '';
    const fileSize     = (evidence.metadata as any)?.fileSize ?? 0;
    const mimeType     = (evidence.metadata as any)?.mimeType ?? '';

    const prompt = `You are a SOC 2 / ISO 27001 compliance auditor reviewing an evidence item.

Evidence details:
- Title: "${evidence.title}"
- Type: ${evidence.type}
- Source: ${evidence.source ?? 'manual'}
${fileName ? `- File: ${fileName} (${Math.round(fileSize / 1024)} KB, ${mimeType})` : ''}
- Control: ${controlCode} — ${controlTitle}

Scoring guide:
- 90–100: Complete, time-stamped, directly proves the control with no gaps
- 70–89: Mostly complete, minor gaps or dated content
- 50–69: Partially relevant, missing key details an auditor would expect
- 30–49: Weak match, title suggests it might be relevant but major gaps exist
- 0–29: Irrelevant or clearly insufficient for this control

Respond with ONLY valid JSON, no preamble:
{
  "confidence": <integer 0-100>,
  "summary": "<1 sentence: what this evidence demonstrates and why it does or doesn't satisfy the control>",
  "flags": ["<specific auditor concern — e.g. 'No date/timestamp visible', 'Scope unclear — which systems are covered?', 'Missing reviewer signature'>"]
}

Only include flags for genuine concerns. Return an empty array if the evidence looks complete.`;

    const response = await this.llm.complete(
      [{ role: 'user', content: prompt }],
      { agentName: 'evidence-validator', maxTokens: 400, temperature: 0.1 },
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

  // ─── AI: Bulk cross-mapping — find additional controls for all evidence ──────
  async bulkSuggestMappings(orgId: string) {
    // Fetch up to 12 real (non-pending) evidence items
    const evidenceItems = await this.prisma.evidence.findMany({
      where: { orgId },
      include: { control: { select: { id: true, code: true, title: true } } },
      orderBy: { collectedAt: 'desc' },
      take: 12,
    });

    const realItems = evidenceItems.filter(
      (e) => !(e.metadata as any)?.isPendingSuggestion,
    );

    if (realItems.length === 0) {
      return { processed: 0, suggestions: [] };
    }

    // Fetch all org controls for matching
    const orgControls = await this.prisma.organizationControl.findMany({
      where: { orgId },
      include: { control: { select: { id: true, code: true, title: true, category: true } } },
      take: 80,
    });

    const controlListStr = orgControls
      .map((oc) => `${oc.control.code}: ${oc.control.title} (${oc.control.category})`)
      .join('\n');

    const evidenceListStr = realItems
      .map((e, i) => `${i + 1}. ID:${e.id} | "${e.title}" | type:${e.type} | mapped-to:${(e as any).control?.code ?? 'none'}`)
      .join('\n');

    const prompt = `You are a compliance expert performing cross-framework evidence mapping.

For each evidence item below, identify up to 3 ADDITIONAL compliance controls it could satisfy (beyond its current mapping).
Only suggest controls where confidence is >70%. Ignore the control the evidence is already mapped to.

AVAILABLE CONTROLS:
${controlListStr}

EVIDENCE ITEMS:
${evidenceListStr}

Return ONLY a JSON array (no markdown, no explanation):
[
  {
    "evidenceId": "exact ID from evidence item",
    "additionalCodes": ["CC6.1", "A.9.2"]
  }
]

If an evidence item has no strong additional matches, omit it from the array.`;

    const response = await this.llm.complete(
      [{ role: 'user', content: prompt }],
      { agentName: 'evidence-mapper', maxTokens: 800, temperature: 0.1 },
    );

    let rawMappings: Array<{ evidenceId: string; additionalCodes: string[] }> = [];
    try {
      const match = response.content.match(/\[[\s\S]*\]/);
      if (match) rawMappings = JSON.parse(match[0]);
    } catch {
      rawMappings = [];
    }

    // Build lookup maps
    const controlByCode = new Map(
      orgControls.map((oc) => [oc.control.code, { controlId: oc.controlId, code: oc.control.code, title: oc.control.title }]),
    );
    const evidenceById = new Map(realItems.map((e) => [e.id, e]));

    const suggestions = rawMappings
      .map((m) => {
        const ev = evidenceById.get(m.evidenceId);
        if (!ev) return null;
        const additionalControls = (m.additionalCodes ?? [])
          .map((code) => controlByCode.get(code))
          .filter(Boolean) as Array<{ controlId: string; code: string; title: string }>;
        if (additionalControls.length === 0) return null;
        return {
          evidenceId:          ev.id,
          evidenceTitle:       ev.title,
          evidenceType:        ev.type,
          storageUrl:          ev.storageUrl,
          currentControlCode:  (ev as any).control?.code ?? null,
          additionalControls,
        };
      })
      .filter(Boolean);

    return { processed: realItems.length, suggestions };
  }

  // ─── Manual re-trigger AI validation ───────────────────────────────────────
  async revalidate(orgId: string, evidenceId: string) {
    const evidence = await this.findOne(orgId, evidenceId);
    // Clear old AI fields so frontend shows "validating" state
    const existingMeta = ((evidence.metadata as Record<string, unknown>) ?? {});
    const { aiConfidence: _, aiSummary: __, aiFlags: ___, aiValidatedAt: ____, ...restMeta } = existingMeta as any;
    await this.prisma.evidence.update({
      where: { id: evidenceId },
      data: { metadata: restMeta as any },
    });
    // Re-run validation non-blocking — return immediately
    this.validateEvidenceWithAI(orgId, evidence).catch((err) =>
      this.logger.warn(`Revalidation failed for evidence ${evidenceId}: ${err.message}`),
    );
    return { status: 'revalidation_started', evidenceId };
  }

  async getDownloadUrl(orgId: string, evidenceId: string): Promise<{ url: string }> {
    const evidence = await this.findOne(orgId, evidenceId);
    const meta = (evidence.metadata ?? {}) as Record<string, any>;
    const key = meta['storageKey'];
    if (!key) throw new NotFoundException('No file stored for this evidence');
    const url = await this.storage.getSignedUrl(key);
    return { url };
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
