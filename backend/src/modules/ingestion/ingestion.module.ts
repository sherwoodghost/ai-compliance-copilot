import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { StorageModule } from '../storage/storage.module';
import { IngestionController } from './ingestion.controller';
import { IngestionService, INGESTION_QUEUE } from './ingestion.service';
import { IngestionClassifierService } from './ingestion-classifier.service';
import { IngestionWorker } from './workers/ingestion.worker';

@Module({
  imports: [
    BullModule.registerQueue({ name: INGESTION_QUEUE }),
    StorageModule,
  ],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionClassifierService, IngestionWorker],
  exports: [IngestionService],
})
export class IngestionModule {}
