import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import slugify from 'slugify';
import { PrismaService } from '../../database/prisma.service';
import { ResendService } from '../../notifications/resend.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60; // 15 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly resend: ResendService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    // Check email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Generate unique org slug
    const slug = await this.generateUniqueSlug(dto.organizationName);

    // Create org + user in a single transaction
    const { user, organization } = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          slug,
          plan: 'starter',
        },
      });

      const newUser = await tx.user.create({
        data: {
          orgId: org.id,
          email: dto.email.toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
          role: 'admin',           // legacy role: first user is admin
          platformRole: 'owner',   // new ABAC role: first user is org owner
          status: 'active',
          isActive: true,
        },
      });

      return { user: newUser, organization: org };
    });

    this.logger.log(`New organization registered: ${organization.slug} | User: ${user.email}`);

    const tokens = await this.generateTokens(user.id, user.email, user.orgId, user.role, (user as any).platformRole ?? 'owner', (user as any).status ?? 'active');
    const session = await this.createSession(user.id, user.orgId, tokens.refreshToken, ipAddress, userAgent);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        platformRole: (user as any).platformRole ?? 'owner',
        orgId: user.orgId,
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(dto.password, '$2b$12$invalidhashfortimingattackprevention');
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Check if onboarding is complete
    const businessProfile = await this.prisma.businessProfile.findUnique({
      where: { orgId: user.orgId },
      select: { isComplete: true },
    });
    const onboardingComplete = businessProfile?.isComplete ?? false;

    const platformRole = (user as any).platformRole ?? 'contributor';
    const status = (user as any).status ?? 'active';
    const tokens = await this.generateTokens(user.id, user.email, user.orgId, user.role, platformRole, status);
    await this.createSession(user.id, user.orgId, tokens.refreshToken, ipAddress, userAgent);

    this.logger.log(`User logged in: ${user.email}`);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        platformRole: (user as any).platformRole ?? 'contributor',
        status: (user as any).status ?? 'active',
        orgId: user.orgId,
        onboardingComplete,
      },
    };
  }

  async refresh(
    userId: string,
    email: string,
    orgId: string,
    role: string,
    oldRefreshToken: string,
    platformRole?: string,
    status?: string,
  ): Promise<RefreshResponseDto> {
    const tokens = await this.generateTokens(userId, email, orgId, role, platformRole ?? 'contributor', status ?? 'active');

    // Rotate refresh token — revoke old, create new session
    await this.prisma.$transaction(async (tx) => {
      await tx.session.updateMany({
        where: { refreshToken: oldRefreshToken },
        data: { isRevoked: true },
      });

      await tx.session.create({
        data: {
          userId,
          orgId,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshToken },
      data: { isRevoked: true },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    this.logger.log(`All sessions revoked for user: ${userId}`);
  }

  async getMe(userId: string, email: string, orgId: string, role: string) {
    const businessProfile = await this.prisma.businessProfile.findUnique({
      where: { orgId },
      select: { isComplete: true },
    });
    return {
      id: userId,
      email,
      orgId,
      role,
      onboardingComplete: businessProfile?.isComplete ?? false,
    };
  }

  // ─── Invite Acceptance ──────────────────────────────────────────────────────

  async acceptInvite(
    rawToken: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invite = await this.prisma.inviteToken.findUnique({ where: { tokenHash } });

    if (!invite) {
      throw new BadRequestException('Invalid or expired invite link');
    }
    if (invite.usedAt) {
      throw new BadRequestException('This invite link has already been used');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('This invite link has expired. Ask your admin to resend the invite');
    }

    const user = await this.prisma.user.findUnique({ where: { id: invite.userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Activate the user + mark token used in a transaction
    const activated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          status:   'active',
          isActive: true,
          ndaSignedAt: (user as any).ndaSignedAt ?? null, // preserve if already set
        },
      });

      await tx.inviteToken.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return updated;
    });

    this.logger.log(`Invite accepted + account activated: ${activated.email}`);

    const platformRole = (activated as any).platformRole ?? 'contributor';
    const tokens = await this.generateTokens(activated.id, activated.email, activated.orgId, activated.role, platformRole, 'active');
    await this.createSession(activated.id, activated.orgId, tokens.refreshToken, ipAddress, userAgent);

    // Check onboarding status
    const businessProfile = await this.prisma.businessProfile.findUnique({
      where: { orgId: activated.orgId },
      select: { isComplete: true },
    });

    return {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn:    ACCESS_TOKEN_EXPIRY_SECONDS,
      user: {
        id:                activated.id,
        email:             activated.email,
        fullName:          activated.fullName,
        role:              activated.role,
        platformRole,
        orgId:             activated.orgId,
        onboardingComplete: businessProfile?.isComplete ?? false,
      },
    };
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async requestPasswordReset(email: string): Promise<void> {
    // Always return success — never leak whether an email exists
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, fullName: true, isActive: true },
    });

    if (!user || !user.isActive) {
      // Silently succeed — timing attack prevention
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));
      return;
    }

    // Invalidate any existing tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken  = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId:    user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const appUrl   = this.configService.get<string>('APP_URL') ?? 'http://localhost:3001';
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;

    await this.resend.sendPasswordResetEmail({
      to:        email,
      userName:  user.fullName,
      resetUrl,
      expiresIn: '1 hour',
    });

    this.logger.log(`Password reset email sent to ${email}`);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const record    = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record) {
      throw new BadRequestException('Invalid or expired reset link');
    }
    if (record.usedAt) {
      throw new BadRequestException('This reset link has already been used');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link has expired. Please request a new one');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });

      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Revoke all active sessions (security: force re-login after password change)
      await tx.session.updateMany({
        where: { userId: record.userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });

    this.logger.log(`Password reset completed for userId: ${record.userId}`);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    orgId: string,
    role: string,
    platformRole: string = 'contributor',
    status: string = 'active',
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const basePayload = { sub: userId, email, orgId, role, platformRole, status };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...basePayload, type: 'access' },
        {
          secret: this.configService.get<string>('jwt.accessSecret'),
          expiresIn: this.configService.get<string>('jwt.accessExpiresIn'),
        },
      ),
      this.jwtService.signAsync(
        { ...basePayload, type: 'refresh' },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    orgId: string,
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.session.create({
      data: {
        userId,
        orgId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
      },
    });
  }

  private async generateUniqueSlug(orgName: string): Promise<string> {
    const base = slugify(orgName, { lower: true, strict: true });
    let slug = base;
    let attempt = 0;

    while (true) {
      const existing = await this.prisma.organization.findUnique({ where: { slug } });
      if (!existing) return slug;
      attempt++;
      slug = `${base}-${attempt}`;
    }
  }
}
