import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto, ChangePasswordDto } from './dto/update-user.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { UserRole } from '@prisma/client';

const BCRYPT_ROUNDS = 12;

const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  orgId: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, orgId },
      select: USER_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...USER_SELECT,
        organization: {
          select: { id: true, name: true, slug: true, plan: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(userId: string, orgId: string, dto: UpdateUserDto, requestingUserId: string, requestingRole: UserRole) {
    const target = await this.findById(userId, orgId);

    // Non-admins can only update themselves
    if (requestingRole !== UserRole.admin && requestingUserId !== userId) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Prevent non-admins from changing roles
    if (dto.role && requestingRole !== UserRole.admin) {
      throw new ForbiddenException('Only admins can change user roles');
    }

    // Prevent the last admin from being demoted
    if (dto.role && dto.role !== UserRole.admin && target.role === UserRole.admin) {
      const adminCount = await this.prisma.user.count({
        where: { orgId, role: UserRole.admin, isActive: true },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot remove the last admin from the organization');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName && { fullName: dto.fullName }),
        ...(dto.role && { role: dto.role }),
      },
      select: USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all sessions to force re-login everywhere
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    this.logger.log(`Password changed for user: ${user.email}`);
  }

  async invite(orgId: string, dto: InviteUserDto): Promise<{ user: any; temporaryPassword: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    // Generate a temporary password — in production, send via email instead
    const temporaryPassword = this.generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        orgId,
        email: dto.email.toLowerCase(),
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        isActive: true,
      },
      select: USER_SELECT,
    });

    this.logger.log(`User invited: ${user.email} to org: ${orgId}`);

    // TODO Phase 6: Send invitation email with temporary password
    return { user, temporaryPassword };
  }

  async deactivate(userId: string, orgId: string, requestingUserId: string) {
    if (userId === requestingUserId) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const target = await this.findById(userId, orgId);

    if (target.role === UserRole.admin) {
      const adminCount = await this.prisma.user.count({
        where: { orgId, role: UserRole.admin, isActive: true },
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Cannot deactivate the last admin');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    // Revoke all active sessions
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async getActiveSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
