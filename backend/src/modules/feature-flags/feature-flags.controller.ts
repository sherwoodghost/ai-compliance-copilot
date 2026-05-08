import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FeatureFlagService } from './feature-flag.service';

interface AuthRequest { user: { orgId: string } }

@ApiTags('feature-flags')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagService) {}

  /** Return all feature flag states for the current org */
  @Get()
  getAll(@Req() req: AuthRequest) {
    return this.flags.getAll(req.user.orgId);
  }
}
