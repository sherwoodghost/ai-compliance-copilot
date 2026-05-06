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
  ParseBoolPipe,
  Optional,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceDto, UpdateEvidenceDto } from './dto/evidence.dto';
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

  @Delete(':evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
  ) {
    return this.evidenceService.delete(user.orgId, evidenceId);
  }
}
