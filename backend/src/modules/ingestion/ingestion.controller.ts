import {
  Controller, Post, Get, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles, BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IngestionService } from './ingestion.service';
import { ReviewIngestionFileDto, BulkReviewDto, CreatePresignedBatchDto } from './dto/ingestion.dto';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

@Controller('ingestion')
@UseGuards(JwtAuthGuard)
export class IngestionController {
  constructor(private readonly svc: IngestionService) {}

  /** Request presigned upload URLs for a batch of files (no server-side buffering) */
  @Post('batches/presigned')
  async createPresignedBatch(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePresignedBatchDto,
  ) {
    return this.svc.createPresignedBatch(user.orgId, dto);
  }

  /** Confirm that all files have been uploaded directly to S3 */
  @Post('batches/:batchId/confirm')
  async confirmBatch(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
  ) {
    return this.svc.confirmBatch(user.orgId, batchId);
  }

  /** Upload multiple files to start a new ingestion batch */
  @Post('batches')
  @UseInterceptors(FilesInterceptor('files', 500, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(`Unsupported file type: ${file.mimetype}`), false);
      }
    },
  }))
  async createBatch(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderPaths') folderPathsJson?: string,
  ) {
    let folderPaths: Record<string, string> = {};
    if (folderPathsJson) {
      try { folderPaths = JSON.parse(folderPathsJson); } catch {}
    }
    return this.svc.createBatch(user.orgId, files, folderPaths);
  }

  /** List all ingestion batches for this org */
  @Get('batches')
  async listBatches(@CurrentUser() user: JwtPayload) {
    return this.svc.listBatches(user.orgId);
  }

  /** Get status + summary for a specific batch */
  @Get('batches/:batchId')
  async getBatchStatus(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
  ) {
    return this.svc.getBatchStatus(user.orgId, batchId);
  }

  /** Get files for a batch, optionally filtered by status */
  @Get('batches/:batchId/files')
  async getBatchFiles(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.getBatchFiles(user.orgId, batchId, status);
  }

  /** Human review: confirm/override classification for one file */
  @Patch('files/:fileId/review')
  async reviewFile(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
    @Body() dto: ReviewIngestionFileDto,
  ) {
    return this.svc.reviewFile(user.orgId, fileId, dto);
  }

  /** Bulk review: apply same classification to multiple files */
  @Post('batches/:batchId/bulk-review')
  async bulkReview(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
    @Body() dto: BulkReviewDto,
  ) {
    return this.svc.bulkReview(user.orgId, batchId, dto);
  }
}
