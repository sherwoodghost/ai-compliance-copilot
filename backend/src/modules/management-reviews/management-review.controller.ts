import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ManagementReviewService } from './management-review.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('management-reviews')
@UseGuards(JwtAuthGuard)
export class ManagementReviewController {
  constructor(private readonly service: ManagementReviewService) {}

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.listReviews(user.orgId);
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getReview(user.orgId, id);
  }

  @Post('schedule')
  schedule(
    @CurrentUser() user: any,
    @Body() dto: { scheduledAt: string; attendees: string[] },
  ) {
    return this.service.scheduleReview(user.orgId, user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      minutes?: string;
      actions?: { item: string; owner: string; dueDate: string; status: string }[];
      completedAt?: string;
    },
  ) {
    return this.service.updateReview(user.orgId, id, dto);
  }

  @Post(':id/sign-off')
  signOff(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.signOff(user.orgId, id, user.sub);
  }
}
