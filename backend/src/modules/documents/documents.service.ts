import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ListDocumentsDto,
  UpdateDocumentDto,
  CreateDocumentDto,
  CreateVersionDto,
} from './dto/documents.dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async list(orgId: string, filters: ListDocumentsDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { orgId, activeForOrg: true };

    if (filters.docType) {
      where.docType = filters.docType;
    }

    if (filters.framework) {
      where.detectedFrameworks = { has: filters.framework };
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { contentText: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          docType: true,
          controlIds: true,
          detectedFrameworks: true,
          version: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          sourceStorageKey: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Full-text Search ──────────────────────────────────────────────────────

  async searchDocuments(
    orgId: string,
    query: string,
    options: { docType?: string; framework?: string; limit?: number },
  ) {
    if (!query || query.trim().length < 2) {
      return { results: [], total: 0, query };
    }

    const limit = Math.min(options.limit ?? 20, 100);
    const where: any = { orgId, activeForOrg: true };

    if (options.docType) where.docType = options.docType;
    if (options.framework) where.detectedFrameworks = { has: options.framework };

    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { contentText: { contains: query, mode: 'insensitive' } },
    ];

    const [results, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          docType: true,
          controlIds: true,
          detectedFrameworks: true,
          version: true,
          updatedAt: true,
          contentText: true,
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    // Add snippet — find the matching portion of contentText
    const resultsWithSnippets = results.map((doc) => {
      let snippet = '';
      if (doc.contentText) {
        const lowerText = doc.contentText.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const idx = lowerText.indexOf(lowerQuery);
        if (idx >= 0) {
          const start = Math.max(0, idx - 80);
          const end = Math.min(
            doc.contentText.length,
            idx + query.length + 80,
          );
          snippet =
            (start > 0 ? '...' : '') +
            doc.contentText.slice(start, end) +
            (end < doc.contentText.length ? '...' : '');
        }
      }
      const { contentText, ...rest } = doc;
      return { ...rest, snippet };
    });

    return { results: resultsWithSnippets, total, query };
  }

  // ── Get by ID ─────────────────────────────────────────────────────────────

  async getById(orgId: string, id: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id, orgId, activeForOrg: true },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(orgId: string, dto: CreateDocumentDto, userId?: string) {
    return this.prisma.document.create({
      data: {
        orgId,
        title: dto.title,
        docType: dto.docType,
        content: dto.content ?? {},
        contentHtml: dto.contentHtml ?? '',
        controlIds: dto.controlIds ?? [],
        detectedFrameworks: dto.detectedFrameworks ?? [],
        createdBy: userId,
      },
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(orgId: string, id: string, dto: UpdateDocumentDto, userId?: string) {
    const doc = await this.getById(orgId, id);

    // Create a version snapshot before updating
    if (dto.content) {
      await this.prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          version: doc.version,
          content: doc.content as any,
          contentHtml: doc.contentHtml,
          editedBy: userId,
          changeNote: 'Auto-saved before edit',
        },
      });
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.docType !== undefined) updateData.docType = dto.docType;
    if (dto.content !== undefined) {
      updateData.content = dto.content;
      updateData.version = doc.version + 1;
    }
    if (dto.contentHtml !== undefined) updateData.contentHtml = dto.contentHtml;
    if (dto.controlIds !== undefined) updateData.controlIds = dto.controlIds;
    if (dto.detectedFrameworks !== undefined) updateData.detectedFrameworks = dto.detectedFrameworks;

    return this.prisma.document.update({
      where: { id },
      data: updateData,
    });
  }

  // ── Soft Delete ───────────────────────────────────────────────────────────

  async softDelete(orgId: string, id: string) {
    await this.getById(orgId, id); // verify exists + tenant
    return this.prisma.document.update({
      where: { id },
      data: { activeForOrg: false },
    });
  }

  // ── Versions ──────────────────────────────────────────────────────────────

  async getVersions(orgId: string, documentId: string) {
    await this.getById(orgId, documentId); // verify tenant
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        editedBy: true,
        changeNote: true,
        createdAt: true,
      },
    });
  }

  async createVersion(orgId: string, documentId: string, userId?: string, note?: string) {
    const doc = await this.getById(orgId, documentId);

    return this.prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: doc.version,
        content: doc.content as any,
        contentHtml: doc.contentHtml,
        editedBy: userId,
        changeNote: note,
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(orgId: string) {
    const [byType, frameworkCounts, totalDocs, recentDocs] = await Promise.all([
      // Count by doc type
      this.prisma.document.groupBy({
        by: ['docType'],
        where: { orgId, activeForOrg: true },
        _count: { id: true },
      }),
      // Count frameworks via raw SQL with unnest
      this.prisma.$queryRaw<Array<{ framework: string; count: bigint }>>`
        SELECT unnest(detected_frameworks) as framework, COUNT(*) as count
        FROM documents
        WHERE org_id = ${orgId} AND active_for_org = true
        GROUP BY framework
        ORDER BY count DESC
      `,
      // Total count
      this.prisma.document.count({ where: { orgId, activeForOrg: true } }),
      // Recent (last 7 days)
      this.prisma.document.count({
        where: {
          orgId,
          activeForOrg: true,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return {
      total: totalDocs,
      recentlyAdded: recentDocs,
      byType: Object.fromEntries(
        byType.map((g) => [g.docType, g._count.id]),
      ),
      byFramework: Object.fromEntries(
        frameworkCounts.map((f) => [f.framework, Number(f.count)]),
      ),
    };
  }

  // ── Download URL ──────────────────────────────────────────────────────────

  async getDownloadUrl(orgId: string, id: string) {
    const doc = await this.getById(orgId, id);
    if (!doc.sourceStorageKey) {
      throw new NotFoundException('No original file available for this document');
    }

    this.storage.assertOrgOwnership(orgId, doc.sourceStorageKey);
    const url = await this.storage.getSignedUrl(doc.sourceStorageKey);
    return { url, filename: doc.title };
  }
}
