import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FrameworksService } from './frameworks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('frameworks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('frameworks')
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Get()
  @ApiOperation({ summary: 'List all active compliance frameworks' })
  findAll() {
    return this.frameworksService.findAll();
  }

  @Get(':frameworkId')
  @ApiOperation({ summary: 'Get a specific framework by ID' })
  findOne(@Param('frameworkId', ParseUUIDPipe) frameworkId: string) {
    return this.frameworksService.findById(frameworkId);
  }

  @Get(':frameworkId/controls')
  @ApiOperation({ summary: 'List all controls for a framework, optionally filtered by category' })
  @ApiQuery({ name: 'category', required: false })
  getControls(
    @Param('frameworkId', ParseUUIDPipe) frameworkId: string,
    @Query('category') category?: string,
  ) {
    return this.frameworksService.getControls(frameworkId, category);
  }

  @Get(':frameworkId/categories')
  @ApiOperation({ summary: 'List control categories within a framework' })
  getCategories(@Param('frameworkId', ParseUUIDPipe) frameworkId: string) {
    return this.frameworksService.getCategories(frameworkId);
  }
}
