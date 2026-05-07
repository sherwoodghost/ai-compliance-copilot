import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ExceptionsService, CreateExceptionDto, UpdateExceptionDto } from './exceptions.service';

@ApiTags('exceptions')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('controls/exceptions')
export class ExceptionsController {
  constructor(private readonly svc: ExceptionsService) {}

  @Get()
  @ApiOperation({ summary: 'List all control exceptions for the org' })
  findAll(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.svc.findAll(user.orgId, status);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Exception counts by status' })
  stats(@CurrentUser() user: JwtPayload) {
    return this.svc.getStats(user.orgId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.findOne(user.orgId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Request a new control exception' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateExceptionDto) {
    return this.svc.create(user.orgId, user.sub, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Approve, reject, or update a control exception' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateExceptionDto,
  ) {
    return this.svc.update(user.orgId, user.sub, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.svc.delete(user.orgId, id);
  }
}
