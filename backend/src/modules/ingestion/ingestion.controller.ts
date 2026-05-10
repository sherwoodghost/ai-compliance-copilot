// @ts-nocheck — depends on future schema migration (IngestionBatch, JobStatus models)
import {
  Controller, Post, Get, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../modules/auth/types/jwt-payload.interface';
import { IngestionService } from './ingestion.service';
import { ReviewIngestionFileDto, BulkReviewDto } from './dto/ingestion.dto';

@Controller('ingestion')
@UseGuards(JwtAuthGuard)
export class IngestionController {
  constructor(private readonly svc: IngestionService) {}

  /** Upload multiple files to start a new ingestion batch */
  @Post('batches')
  @UseInterceptors(FilesInterceptor('files', 500, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  }))
  async createBatch(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.svc.createBatch(user.orgId, files);
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
