import { Controller, Get, Post, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole, IntegrationProvider } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { IsEnum, IsObject, IsOptional } from 'class-validator';

class ConnectIntegrationDto {
  @IsEnum(IntegrationProvider) provider: IntegrationProvider;
  @IsObject() credentials: Record<string, unknown>;
  @IsOptional() @IsObject() settings?: Record<string, unknown>;
}

@ApiTags('integrations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.integrationsService.findAll(user.orgId);
  }

  @Post('connect')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Connect a new integration (admin only)' })
  connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectIntegrationDto) {
    return this.integrationsService.connect(user.orgId, dto.provider, dto.credentials, dto.settings);
  }

  @Post(':integrationId/test')
  @Roles(UserRole.admin)
  testConnection(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.testConnection(user.orgId, integrationId);
  }

  @Post(':integrationId/sync')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Manually trigger evidence sync for an integration' })
  sync(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.sync(user.orgId, integrationId);
  }

  @Delete(':integrationId')
  @Roles(UserRole.admin)
  disconnect(@CurrentUser() user: JwtPayload, @Param('integrationId', ParseUUIDPipe) integrationId: string) {
    return this.integrationsService.disconnect(user.orgId, integrationId);
  }
}
