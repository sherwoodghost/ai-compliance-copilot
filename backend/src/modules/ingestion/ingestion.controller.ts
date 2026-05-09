import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles, Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IngestionService } from './ingestion.service';
import { ReviewFileDto, BulkReviewDto } from './dto/ingestion.dto';

@Controller('ingestion')
@UseGuards(JwtAuthGuard)
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(private readonly svc: IngestionService) {}

  /** POST /ingestion/batch — Upload files to start an ingestion batch */
  @Post('batch')
  @UseInterceptors(FilesInterceptor('files', 500))
  async createBatch(
    @CurrentUser() user: JwtPayload,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('folderPaths') folderPathsJson?: string,
  ) {
    const folderPaths: Record<string, string> = folderPathsJson
      ? JSON.parse(folderPathsJson)
      : {};

    const ingestFiles = files.map(f => ({
      originalname: f.originalname,
      buffer: f.buffer,
      mimetype: f.mimetype,
      size: f.size,
      folderPath: folderPaths[f.originalname],
    }));

    return this.svc.createBatch(user.orgId, ingestFiles);
  }

  /** GET /ingestion/batches — List all batches for this org */
  @Get('batches')
  listBatches(@CurrentUser() user: JwtPayload) {
    return this.svc.listBatches(user.orgId);
  }

  /** GET /ingestion/batch/:batchId — Get batch status */
  @Get('batch/:batchId')
  getBatch(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
  ) {
    return this.svc.getBatchStatus(user.orgId, batchId);
  }

  /** GET /ingestion/batch/:batchId/files — Get files in batch */
  @Get('batch/:batchId/files')
  getFiles(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.getBatchFiles(user.orgId, batchId, status);
  }

  /** PATCH /ingestion/files/:fileId/review — Review a single file */
  @Patch('files/:fileId/review')
  reviewFile(
    @CurrentUser() user: JwtPayload,
    @Param('fileId') fileId: string,
    @Body() dto: ReviewFileDto,
  ) {
    return this.svc.reviewFile(user.orgId, fileId, dto);
  }

  /** POST /ingestion/batch/:batchId/bulk-review — Bulk review files */
  @Post('batch/:batchId/bulk-review')
  bulkReview(
    @CurrentUser() user: JwtPayload,
    @Param('batchId') batchId: string,
    @Body() dto: BulkReviewDto,
  ) {
    return this.svc.bulkReview(user.orgId, batchId, dto.fileIds, dto.status);
  }
}
