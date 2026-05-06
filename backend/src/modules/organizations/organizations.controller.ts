import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Delete,
  Param,
  ParseUUIDPipe,
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
}
