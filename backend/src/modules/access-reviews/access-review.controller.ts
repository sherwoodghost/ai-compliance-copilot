import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AccessReviewService, SignOffDto } from './access-review.service';

@ApiTags('access-reviews')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('access-reviews')
export class AccessReviewController {
  constructor(private readonly accessReviewService: AccessReviewService) {}

  @Get()
  @ApiOperation({ summary: 'List all access reviews for the org' })
  list(@CurrentUser() user: JwtPayload) {
    return this.accessReviewService.listReviews(user.orgId);
  }

  @Get(':reviewId')
  @ApiOperation({ summary: 'Get a specific access review' })
  getOne(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.accessReviewService.getReview(user.orgId, reviewId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate quarterly access reviews for all managers (ISO A.8.2 / SOC 2 CC6.3)' })
  generate(@CurrentUser() user: JwtPayload) {
    return this.accessReviewService.generateQuarterlyReviews(user.orgId, user.sub);
  }

  @Post(':reviewId/sign-off')
  @ApiOperation({ summary: 'Sign off on an access review — generates Evidence mapped to ISO A.8.2 + SOC2 CC6.3' })
  signOff(
    @CurrentUser() user: JwtPayload,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SignOffDto,
  ) {
    return this.accessReviewService.signOff(user.orgId, reviewId, user.sub, dto);
  }
}
