import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Optional,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto, UpdateEvidenceDto, UploadEvidenceDto } from './dto/evidence.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('evidence')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('evidence')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Get()
  @ApiQuery({ name: 'controlId', required: false })
  @ApiQuery({ name: 'isValid', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('controlId') controlId?: string,
    @Query('isValid') isValid?: string,
  ) {
    const isValidBool = isValid === undefined ? undefined : isValid === 'true';
    return this.evidenceService.findAll(user.orgId, controlId, isValidBool);
  }

  @Get('expiry-report')
  @ApiOperation({ summary: 'Get expired and soon-to-expire evidence' })
  getExpiryReport(@CurrentUser() user: JwtPayload) {
    return this.evidenceService.getExpiryReport(user.orgId);
  }

  @Get(':evidenceId')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.findOne(user.orgId, evidenceId);
  }

  @Post()
  @ApiOperation({ summary: 'Manually add evidence to a control' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEvidenceDto) {
    return this.evidenceService.create(user.orgId, dto, user.sub);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file as evidence for a control' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'controlId', 'title', 'type'],
      properties: {
        file:      { type: 'string', format: 'binary' },
        controlId: { type: 'string' },
        title:     { type: 'string' },
        type:      { type: 'string' },
        expiresAt: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'image/jpeg', 'image/png', 'image/gif', 'image/webp',
          'application/pdf',
          'text/plain', 'text/csv',
          'application/json',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`), false);
        }
      },
    }),
  )
  uploadEvidence(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadEvidenceDto,
  ) {
    return this.evidenceService.uploadEvidence(user.orgId, file, dto, user.sub);
  }

  @Get(':evidenceId/download')
  @ApiOperation({ summary: 'Get a presigned download URL for uploaded evidence' })
  getDownloadUrl(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.getDownloadUrl(user.orgId, evidenceId);
  }

  @Patch(':evidenceId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Body() dto: UpdateEvidenceDto,
  ) {
    return this.evidenceService.update(user.orgId, evidenceId, dto, user.sub);
  }

  @Patch(':evidenceId/invalidate')
  @ApiOperation({ summary: 'Mark evidence as invalid' })
  markInvalid(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.markInvalid(user.orgId, evidenceId, user.sub);
  }

  @Post(':evidenceId/revalidate')
  @ApiOperation({ summary: 'Re-trigger AI validation for this evidence item' })
  revalidate(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.revalidate(user.orgId, evidenceId);
  }

  @Get(':evidenceId/suggest-mappings')
  @ApiOperation({ summary: 'AI-suggest additional controls this evidence might satisfy' })
  suggestMappings(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.suggestControlMappings(user.orgId, evidenceId);
  }

  @Delete(':evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.delete(user.orgId, evidenceId);
  }
}
