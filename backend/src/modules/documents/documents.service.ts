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

    // Track which fields are changing for the audit trail
    const changedFields: string[] = [];
    if (dto.title !== undefined && dto.title !== doc.title) changedFields.push('title');
    if (dto.content !== undefined) changedFields.push('content');
    if (dto.docType !== undefined && dto.docType !== doc.docType) changedFields.push('docType');
    if (dto.controlIds !== undefined) changedFields.push('controlIds');
    if (dto.contentHtml !== undefined) changedFields.push('contentHtml');
    if (dto.detectedFrameworks !== undefined) changedFields.push('detectedFrameworks');

    // Create a version snapshot before updating
    await this.prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: doc.version,
        content: doc.content as any,
        contentHtml: doc.contentHtml,
        editedBy: userId,
        changeNote: changedFields.length > 0
          ? `Updated: ${changedFields.join(', ')}`
          : 'Auto-saved before edit',
      },
    });

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

  // ── Export ──────────────────────────────────────────────────────────────────

  async exportDocument(orgId: string, id: string, format: 'html' | 'text' | 'markdown' = 'html') {
    const doc = await this.getById(orgId, id);

    let content: string;
    let contentType: string;
    let extension: string;

    switch (format) {
      case 'text':
        content = doc.contentText || '';
        contentType = 'text/plain';
        extension = 'txt';
        break;
      case 'markdown':
        // Convert HTML to markdown using turndown
        const TurndownService = require('turndown');
        const turndown = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
        });
        content = turndown.turndown(doc.contentHtml || '');
        contentType = 'text/markdown';
        extension = 'md';
        break;
      case 'html':
      default:
        content = this.wrapHtmlForExport(doc.title, doc.contentHtml || '');
        contentType = 'text/html';
        extension = 'html';
        break;
    }

    return { content, contentType, filename: `${doc.title}.${extension}` };
  }

  private wrapHtmlForExport(title: string, html: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1a1a1a; }
    h1 { border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
    h2 { border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    blockquote { border-left: 4px solid #d1d5db; margin: 16px 0; padding: 8px 16px; color: #4b5563; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre code { display: block; padding: 16px; overflow-x: auto; }
    img { max-width: 100%; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${html}
</body>
</html>`;
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  getTemplates() {
    return [
      {
        id: 'security-policy',
        name: 'Information Security Policy',
        docType: 'policy',
        frameworks: ['SOC2', 'ISO27001'],
        description: 'Comprehensive information security policy covering access control, data protection, and incident response.',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Information Security Policy' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Purpose' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This policy establishes the information security requirements for [Company Name]. It defines the controls, procedures, and responsibilities necessary to protect information assets.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Scope' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This policy applies to all employees, contractors, and third-party users who access [Company Name] information systems and data.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Access Control' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Describe your access control requirements here. Include authentication standards, authorization levels, and access review procedures.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Data Protection' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Describe data classification levels, encryption requirements, and data handling procedures.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5. Incident Response' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Define incident detection, reporting, and response procedures.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '6. Review' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This policy shall be reviewed annually or upon significant changes to the organization or threat landscape.' }] },
          ],
        },
      },
      {
        id: 'incident-response',
        name: 'Incident Response Procedure',
        docType: 'procedure',
        frameworks: ['SOC2', 'ISO27001'],
        description: 'Step-by-step incident response procedure with escalation matrix.',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Incident Response Procedure' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Detection & Reporting' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'All security incidents must be reported immediately to the Security team via [reporting channel]. Incidents include unauthorized access, data breaches, malware infections, and service disruptions.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Severity Classification' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '- Critical (P1): Active data breach or system compromise\n- High (P2): Potential data exposure or significant service impact\n- Medium (P3): Contained security event with limited impact\n- Low (P4): Minor security concern with no immediate risk' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Response Steps' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Define containment, eradication, recovery, and lessons-learned procedures for each severity level.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Communication' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Define internal and external communication procedures, including customer notification requirements.]' }] },
          ],
        },
      },
      {
        id: 'access-review',
        name: 'Access Review Template',
        docType: 'template',
        frameworks: ['SOC2', 'ISO27001'],
        description: 'Quarterly access review checklist and documentation template.',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Access Review — Q[X] [Year]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Review Details' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Reviewer: [Name]\nReview Date: [Date]\nPeriod Covered: [Start Date] — [End Date]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Systems Reviewed' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[List each system reviewed, the number of accounts, and findings.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Findings & Actions' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Document any excessive permissions, orphaned accounts, or policy violations found during the review.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sign-Off' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Reviewed by: _____________ Date: _____________\nApproved by: _____________ Date: _____________' }] },
          ],
        },
      },
      {
        id: 'privacy-policy',
        name: 'Privacy Policy',
        docType: 'policy',
        frameworks: ['GDPR'],
        description: 'GDPR-compliant privacy policy template.',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Privacy Policy' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '1. Data Controller' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Company Name] is the data controller for personal data processed under this policy. Contact: [DPO Email].' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '2. Data We Collect' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[List categories of personal data collected, purposes, and legal bases for processing.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '3. Data Subject Rights' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Under GDPR, you have the right to: access, rectification, erasure, restriction of processing, data portability, and objection. Contact [email] to exercise these rights.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '4. Data Retention' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Define retention periods for each category of personal data.]' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '5. International Transfers' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '[Describe any cross-border data transfers and safeguards in place.]' }] },
          ],
        },
      },
    ];
  }

  async createFromTemplate(orgId: string, templateId: string, title: string, userId?: string) {
    const templates = this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) throw new NotFoundException(`Template "${templateId}" not found`);

    const { generateHTML } = require('@tiptap/html/server');
    const { SERVER_EXTENSIONS } = require('../ingestion/tiptap-extensions');
    const html = generateHTML(template.content, SERVER_EXTENSIONS);

    // Extract plain text from the template
    const plainText = this.extractPlainText(template.content);

    return this.prisma.document.create({
      data: {
        orgId,
        title: title || template.name,
        docType: template.docType,
        content: template.content,
        contentHtml: html,
        contentText: plainText,
        controlIds: [],
        detectedFrameworks: template.frameworks,
        createdBy: userId,
      },
    });
  }

  private extractPlainText(tiptapJson: any): string {
    const texts: string[] = [];
    const walk = (node: any) => {
      if (node.type === 'text' && node.text) texts.push(node.text);
      if (node.content) node.content.forEach(walk);
    };
    walk(tiptapJson);
    return texts.join(' ');
  }

  // ── Bulk Export ───────────────────────────────────────────────────────────

  async bulkExport(orgId: string, filters?: { docType?: string; framework?: string }) {
    const where: any = { orgId, activeForOrg: true };
    if (filters?.docType) where.docType = filters.docType;
    if (filters?.framework) where.detectedFrameworks = { has: filters.framework };

    const docs = await this.prisma.document.findMany({
      where,
      select: {
        title: true,
        docType: true,
        contentHtml: true,
        contentText: true,
        detectedFrameworks: true,
        controlIds: true,
        version: true,
        updatedAt: true,
      },
      orderBy: [{ docType: 'asc' }, { title: 'asc' }],
      take: 200, // safety limit
    });

    // Build a manifest + individual HTML files as a JSON response
    // (A real ZIP would need archiver/jszip, which isn't installed)
    const manifest = docs.map((d, i) => ({
      index: i + 1,
      title: d.title,
      type: d.docType,
      frameworks: d.detectedFrameworks,
      controls: d.controlIds,
      version: d.version,
      lastUpdated: d.updatedAt,
    }));

    const files = docs.map(d => ({
      filename: `${d.docType}/${d.title.replace(/[^a-zA-Z0-9._-]/g, '_')}.html`,
      content: this.wrapHtmlForExport(d.title, d.contentHtml || d.contentText || ''),
    }));

    return { manifest, files, totalDocuments: docs.length };
  }
}
