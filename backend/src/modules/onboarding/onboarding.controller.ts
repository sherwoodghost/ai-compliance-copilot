import { Controller, Get, Post, Patch, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class SendMessageDto {
  @IsString() @IsNotEmpty() message: string;
}

class ChatDto {
  @IsString() @IsOptional() message?: string;
}

class UpdateProfileDto {
  @IsObject() updates: Record<string, unknown>;
}

@ApiTags('onboarding')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('session')
  @ApiOperation({ summary: 'Get or create the onboarding session for the current org' })
  async getSession(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getOrCreateSession(user.orgId, user.sub);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get onboarding completion status and business profile status' })
  async getStatus(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getSessionStatus(user.orgId);
  }

  @Post('message')
  @ApiOperation({ summary: 'Send a message to the onboarding agent' })
  async sendMessage(@CurrentUser() user: JwtPayload, @Body() dto: SendMessageDto) {
    return this.onboardingService.sendMessage(user.orgId, user.sub, dto.message);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Synchronous onboarding chat — bypasses queue, returns AI response directly in the HTTP response' })
  async chat(@CurrentUser() user: JwtPayload, @Body() dto: ChatDto) {
    return this.onboardingService.chatSync(user.orgId, user.sub, dto.message ?? null);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get the completed business profile for this org' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getBusinessProfile(user.orgId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update business profile after onboarding (creates change log)' })
  async updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.onboardingService.updateBusinessProfile(user.orgId, user.sub, dto.updates);
  }

  @Get('profile/versions')
  @ApiOperation({ summary: 'Get all versions of the business profile' })
  async getProfileVersions(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getProfileVersions(user.orgId);
  }

  @Post('profile/rollback/:version')
  @ApiOperation({ summary: 'Rollback business profile to a previous version' })
  async rollbackProfile(
    @CurrentUser() user: JwtPayload,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.onboardingService.rollbackProfile(user.orgId, user.sub, version);
  }

  @Get('completeness')
  @ApiOperation({ summary: 'Get onboarding completeness score (0–100) and missing required fields' })
  async getCompleteness(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.getCompleteness(user.orgId);
  }

  @Post('finalize')
  @ApiOperation({ summary: 'Finalize onboarding and trigger the compliance assessment pipeline (requires ≥85% completeness)' })
  async finalizeOnboarding(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.finalizeOnboarding(user.orgId, user.sub);
  }

  @Post('reset')
  @ApiOperation({ summary: 'Reset onboarding session — marks existing session as abandoned and clears extracted data so the user can start fresh' })
  async resetSession(@CurrentUser() user: JwtPayload) {
    return this.onboardingService.resetSession(user.orgId);
  }
}
