import { Module } from '@nestjs/common';
import { AccessReviewService } from './access-review.service';
import { AccessReviewController } from './access-review.controller';

@Module({
  providers: [AccessReviewService],
  controllers: [AccessReviewController],
  exports: [AccessReviewService],
})
export class AccessReviewModule {}
