import { Controller, Get, Post, Patch, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ComplianceJourneyService } from './compliance-journey.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';

class ResolveCheckpointDto {
  @IsEnum(['approved', 'rejected', 'override']) decision: 'approved' | 'rejected' | 'override';
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsString() overrideReason?: string;
}

@ApiTags('compliance-journey')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('compliance-journey')
export class ComplianceJourneyController {
  constructor(private readonly journeyService: ComplianceJourneyService) {}

  @Get()
  @ApiOperation({ summary: 'List all compliance journeys for the org' })
  listJourneys(@CurrentUser() user: JwtPayload) {
    return this.journeyService.listJourneys(user.orgId);
  }

  @Get('checkpoints/pending')
  @ApiOperation({ summary: 'Get all pending human checkpoints' })
  getPendingCheckpoints(@CurrentUser() user: JwtPayload) {
    return this.journeyService.getPendingCheckpoints(user.orgId);
  }

  @Get(':journeyId')
  @ApiOperation({ summary: 'Get full journey state with checkpoints and history' })
  getJourneyDetail(
    @CurrentUser() user: JwtPayload,
    @Param('journeyId', ParseUUIDPipe) journeyId: string,
  ) {
    return this.journeyService.getJourneyDetail(user.orgId, journeyId);
  }

  @Patch('checkpoints/:checkpointId/resolve')
  @ApiOperation({ summary: 'Resolve a human checkpoint (approve/reject/override)' })
  resolveCheckpoint(
    @CurrentUser() user: JwtPayload,
    @Param('checkpointId', ParseUUIDPipe) checkpointId: string,
    @Body() dto: ResolveCheckpointDto,
  ) {
    return this.journeyService.resolveCheckpoint(
      user.orgId,
      checkpointId,
      user.sub,
      dto.decision,
      dto.comments,
      dto.overrideReason,
    );
  }
}
