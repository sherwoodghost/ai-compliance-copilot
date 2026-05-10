import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  ListDocumentsDto,
  UpdateDocumentDto,
  CreateDocumentDto,
  CreateVersionDto,
} from './dto/documents.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  /** List documents for the org (paginated, filterable) */
  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() filters: ListDocumentsDto,
  ) {
    return this.svc.list(user.orgId, filters);
  }

  /** Full-text search across document content */
  @Get('search')
  async search(
    @CurrentUser() user: JwtPayload,
    @Query('q') query: string,
    @Query('docType') docType?: string,
    @Query('framework') framework?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.searchDocuments(user.orgId, query, {
      docType,
      framework,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /** Get document statistics for the org */
  @Get('stats')
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.svc.getStats(user.orgId);
  }

  /** Get available document templates */
  @Get('templates')
  async getTemplates() {
    return this.svc.getTemplates();
  }

  /** Bulk export documents for auditors */
  @Get('bulk-export')
  async bulkExport(
    @CurrentUser() user: JwtPayload,
    @Query('docType') docType?: string,
    @Query('framework') framework?: string,
  ) {
    return this.svc.bulkExport(user.orgId, { docType, framework });
  }

  /** Create a document from a template */
  @Post('from-template')
  @Roles(UserRole.admin, UserRole.member)
  async createFromTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: { templateId: string; title?: string },
  ) {
    return this.svc.createFromTemplate(user.orgId, dto.templateId, dto.title ?? '', user.sub);
  }

  /** Get a single document by ID */
  @Get(':id')
  async getById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.svc.getById(user.orgId, id);
  }

  /** Create a new document */
  @Post()
  @Roles(UserRole.admin, UserRole.member)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.svc.create(user.orgId, dto, user.sub);
  }

  /** Update a document's content or metadata */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.member)
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.svc.update(user.orgId, id, dto, user.sub);
  }

  /** Soft-delete a document (admin only) */
  @Delete(':id')
  @Roles(UserRole.admin)
  async delete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.svc.softDelete(user.orgId, id);
  }

  /** Get version history for a document */
  @Get(':id/versions')
  async getVersions(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.svc.getVersions(user.orgId, id);
  }

  /** Manually create a version snapshot */
  @Post(':id/versions')
  @Roles(UserRole.admin, UserRole.member)
  async createVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.svc.createVersion(user.orgId, id, user.sub, dto.changeNote);
  }

  /** Export a document in various formats */
  @Get(':id/export')
  async exportDocument(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('format') format: 'html' | 'text' | 'markdown' | undefined,
    @Res() res: Response,
  ) {
    const result = await this.svc.exportDocument(user.orgId, id, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }

  /** Get a signed download URL for the original file */
  @Get(':id/download')
  async getDownloadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.svc.getDownloadUrl(user.orgId, id);
  }
}
