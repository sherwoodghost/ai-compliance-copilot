import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, Req, UploadedFile, UseInterceptors, ParseIntPipe,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';
import { RetentionService } from './retention.service';
import {
  CreateDocumentDto,
  UpdateDocumentDto,
  RejectDocumentDto,
  NewVersionDto,
  AiImproveDto,
  ListDocumentsDto,
  SetLegalHoldDto,
} from './dto/documents.dto';

interface AuthRequest { user: { userId: string; orgId: string } }

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly docs:      DocumentsService,
    private readonly retention: RetentionService,
  ) {}

  // ── List ────────────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List documents (paginated, filterable, searchable)' })
  list(@Req() req: AuthRequest, @Query() filters: ListDocumentsDto) {
    return this.docs.list(req.user.orgId, filters);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a new document' })
  create(@Req() req: AuthRequest, @Body() dto: CreateDocumentDto) {
    return this.docs.create(req.user.orgId, req.user.userId, dto);
  }

  // ── Get one ─────────────────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get document by ID' })
  get(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.get(req.user.orgId, id);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update document content or metadata (409 if locked)' })
  update(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.docs.update(req.user.orgId, id, req.user.userId, dto);
  }

  // ── Approval workflow ────────────────────────────────────────────────────────

  @Post(':id/request-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request approval — locks document, sets status=review' })
  requestApproval(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.requestApproval(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve document — SoD enforced (approver ≠ owner), releases lock' })
  approve(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.approve(req.user.orgId, id, req.user.userId);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject approval request — releases lock, returns to draft' })
  reject(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: RejectDocumentDto) {
    return this.docs.reject(req.user.orgId, id, req.user.userId, dto.reason);
  }

  // ── Archive ─────────────────────────────────────────────────────────────────

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive document (423 if under legal hold)' })
  archive(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.archive(req.user.orgId, id, req.user.userId);
  }

  // ── Versions ────────────────────────────────────────────────────────────────

  @Post(':id/new-version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Snapshot current content → increment version → draft' })
  newVersion(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: NewVersionDto) {
    return this.docs.newVersion(req.user.orgId, id, req.user.userId, dto);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List version history for a document' })
  getVersions(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.getVersions(req.user.orgId, id);
  }

  @Post(':id/restore/:version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore document to a specific version' })
  restoreVersion(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.docs.restoreVersion(req.user.orgId, id, version, req.user.userId);
  }

  // ── AI features ─────────────────────────────────────────────────────────────

  @Post(':id/ai-improve')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Improve selected text using Claude Haiku (10/user/hour)' })
  aiImprove(@Req() req: AuthRequest, @Param('id') id: string, @Body() dto: AiImproveDto) {
    return this.docs.aiImprove(req.user.orgId, id, dto);
  }

  @Post(':id/ai-gaps')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Detect missing ISO/SOC2 sections (5/user/hour)' })
  aiGaps(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.docs.aiGaps(req.user.orgId, id);
  }

  // ── PDF import ───────────────────────────────────────────────────────────────

  @Post('import/pdf')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'AI-assisted PDF import — extracts content as Markdown' })
  importPdf(
    @Req() req: AuthRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.docs.importPdf(
      req.user.orgId,
      req.user.userId,
      file.buffer,
      file.originalname,
    );
  }

  // ── Legal hold ────────────────────────────────────────────────────────────────

  @Post(':id/legal-hold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set legal hold — blocks deletion/archival' })
  setLegalHold(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: SetLegalHoldDto,
  ) {
    return this.retention.setLegalHold(req.user.orgId, id, req.user.userId, dto.reason);
  }

  @Delete(':id/legal-hold')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Release legal hold (requires COMPLIANCE_LEAD or LEGAL role)' })
  releaseLegalHold(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.retention.releaseLegalHold(req.user.orgId, id, req.user.userId);
  }
}
