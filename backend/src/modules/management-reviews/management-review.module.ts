import { Module } from '@nestjs/common';
import { ManagementReviewService } from './management-review.service';
import { ManagementReviewController } from './management-review.controller';

@Module({
  providers: [ManagementReviewService],
  controllers: [ManagementReviewController],
  exports: [ManagementReviewService],
})
export class ManagementReviewModule {}
