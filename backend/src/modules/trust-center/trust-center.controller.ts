import {
  Controller, Get, Patch, Post, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { TrustCenterService, UpdateTrustCenterDto, CreateAccessLinkDto } from './trust-center.service';

@ApiTags('trust-center')
@Controller('trust-center')
export class TrustCenterController {
  constructor(private readonly trustCenter: TrustCenterService) {}

  // ─── Authenticated (admin) endpoints ─────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get or initialise the org trust center' })
  async getOrCreate(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getOrCreate(user.orgId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update trust center branding and settings' })
  async update(@CurrentUser() user: JwtPayload, @Body() dto: UpdateTrustCenterDto) {
    return this.trustCenter.update(user.orgId, dto);
  }

  @Post('publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish the trust center (make it publicly accessible)' })
  async publish(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.publish(user.orgId);
  }

  @Post('unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpublish the trust center (make it private)' })
  async unpublish(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.unpublish(user.orgId);
  }

  @Post('links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a shareable access link for auditors / customers' })
  async createLink(@CurrentUser() user: JwtPayload, @Body() dto: CreateAccessLinkDto) {
    return this.trustCenter.createAccessLink(user.orgId, dto);
  }

  @Get('links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all access links for the org trust center' })
  async listLinks(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.listAccessLinks(user.orgId);
  }

  @Get('pass-rate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor', 'member')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get control test pass rate summary for the org' })
  async passRate(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getControlPassRate(user.orgId);
  }

  @Get('checks')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'auditor', 'member')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get trust check items derived from control test results' })
  async getChecks(@CurrentUser() user: JwtPayload) {
    return this.trustCenter.getChecks(user.orgId);
  }
}

// ─── Public controller (no auth guard) ─────────────────────────────────────

@ApiTags('public')
@Controller('public/trust')
export class PublicTrustCenterController {
  constructor(private readonly trustCenter: TrustCenterService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Public trust center page data (no auth required)' })
  async getPublic(
    @Param('slug')   slug:  string,
    @Query('token')  token?: string,
  ) {
    return this.trustCenter.getPublicBySlug(slug, token);
  }
}
