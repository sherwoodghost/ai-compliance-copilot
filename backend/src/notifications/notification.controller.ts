import {
  Controller, Get, Post, Param, Query,
  ParseIntPipe, DefaultValuePipe, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationService } from './notification.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** Fetch last N notifications + unread count for the current user. */
  @Get()
  getMyNotifications(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notifications.getForUser(user.sub, Math.min(limit, 50));
  }

  /** Mark a single notification as read. */
  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  /** Mark all notifications as read for the current user. */
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@CurrentUser() user: any) {
    return this.notifications.markAllRead(user.sub);
  }
}
