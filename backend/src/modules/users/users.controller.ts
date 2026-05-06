import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
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
import { UsersService } from './users.service';
import { UpdateUserDto, ChangePasswordDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get full profile of current user' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findMe(user.sub);
  }

  @Get('me/sessions')
  @ApiOperation({ summary: 'List active sessions for current user' })
  async getMySessions(@CurrentUser() user: JwtPayload) {
    return this.usersService.getActiveSessions(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile' })
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.sub, user.orgId, dto, user.sub, user.role as UserRole);
  }

  @Post('me/change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change own password (revokes all sessions)' })
  async changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(user.sub, dto);
  }

  @Get(':userId')
  @Roles(UserRole.admin, UserRole.auditor)
  @ApiOperation({ summary: 'Get a specific user by ID (admin/auditor only)' })
  async getUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.usersService.findById(userId, user.orgId);
  }

  @Patch(':userId')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Update a user (admin only)' })
  async updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(userId, user.orgId, dto, user.sub, user.role as UserRole);
  }

  @Post('invite')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Invite a new user to the organization (admin only)' })
  @ApiResponse({ status: 201, description: 'User invited. Returns user + temporary password.' })
  async inviteUser(@CurrentUser() user: JwtPayload, @Body() dto: InviteUserDto) {
    return this.usersService.invite(user.orgId, dto);
  }

  @Delete(':userId')
  @Roles(UserRole.admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a user (admin only)' })
  async deactivateUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.usersService.deactivate(userId, user.orgId, user.sub);
  }
}
