import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
  Delete,
  Param,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('organizations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  @ApiOperation({ summary: "Get the current user's organization" })
  async getMyOrg(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.findById(user.orgId);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get compliance stats for current organization' })
  async getStats(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getStats(user.orgId);
  }

  @Get('me/members')
  @ApiOperation({ summary: 'List all members of the current organization' })
  async getMembers(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getMembers(user.orgId);
  }

  @Patch('me')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update organization details (admin only)' })
  async updateMyOrg(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(user.orgId, dto);
  }

  @Delete('me/members/:userId')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Remove a member from the organization (admin only)' })
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) targetUserId: string,
  ) {
    return this.organizationsService.removeMember(user.orgId, targetUserId, user.sub);
  }

  @Get('me/llm-settings')
  @ApiOperation({ summary: 'Get LLM configuration for current org' })
  async getLlmSettings(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.getLlmSettings(user.orgId);
  }

  @Patch('me/llm-settings')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update LLM API key and model preferences (admin only)' })
  async updateLlmSettings(
    @CurrentUser() user: JwtPayload,
    @Body() body: { orgApiKey?: string; preferredModel?: string },
  ) {
    return this.organizationsService.updateLlmSettings(user.orgId, body);
  }

  @Post('me/llm-settings/test')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Test an OpenRouter API key' })
  async testLlmKey(
    @Body() body: { apiKey: string },
  ) {
    if (!body.apiKey) throw new BadRequestException('apiKey is required');
    return this.organizationsService.testLlmKey(body.apiKey);
  }

  @Post('me/reset-demo')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DANGER: Wipe all org compliance data to restart the demo from onboarding (admin only)' })
  async resetDemo(@CurrentUser() user: JwtPayload) {
    return this.organizationsService.resetDemoData(user.orgId);
  }

  @Get('me/audit-logs')
  @ApiOperation({ summary: 'Get audit log trail for the current organization' })
  async getAuditLogs(
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.organizationsService.getAuditLogs(
      user.orgId,
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }
}
