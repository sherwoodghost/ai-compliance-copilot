import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
  ListDocumentsDto,
  UpdateDocumentDto,
  CreateDocumentDto,
  CreateVersionDto,
} from './dto/documents.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard)
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
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.svc.create(user.orgId, dto, user.sub);
  }

  /** Update a document's content or metadata */
  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.svc.update(user.orgId, id, dto, user.sub);
  }

  /** Soft-delete a document */
  @Delete(':id')
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
  async createVersion(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    return this.svc.createVersion(user.orgId, id, user.sub, dto.changeNote);
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
