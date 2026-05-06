import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import slugify from 'slugify';
import { PrismaService } from '../../database/prisma.service';
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
          role: 'admin', // First user of an org is always admin
          isActive: true,
        },
      });

      return { user: newUser, organization: org };
    });

    this.logger.log(`New organization registered: ${organization.slug} | User: ${user.email}`);

    const tokens = await this.generateTokens(user.id, user.email, user.orgId, user.role);
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

    const tokens = await this.generateTokens(user.id, user.email, user.orgId, user.role);
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
        orgId: user.orgId,
      },
    };
  }

  async refresh(
    userId: string,
    email: string,
    orgId: string,
    role: string,
    oldRefreshToken: string,
  ): Promise<RefreshResponseDto> {
    const tokens = await this.generateTokens(userId, email, orgId, role);

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

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async generateTokens(
    userId: string,
    email: string,
    orgId: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const basePayload = { sub: userId, email, orgId, role };

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
