import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { IngestionController } from './ingestion.controller';
import { IngestionService, INGESTION_QUEUE } from './ingestion.service';
import { IngestionClassifierService } from './ingestion-classifier.service';
import { IngestionNotificationService } from './ingestion-notification.service';
import { PiiRedactorService } from './pii-redactor.service';
import { TipTapConverterService } from './tiptap-converter.service';
import { IngestionWorker } from './workers/ingestion.worker';
import { ConversionWorker, INGESTION_CONVERT_QUEUE } from './workers/conversion.worker';
import { StorageModule } from '../storage/storage.module';
import { LlmGatewayModule } from '../../llm-gateway/llm-gateway.module';
import { GatewaysModule } from '../../gateways/gateways.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: INGESTION_QUEUE },
      { name: INGESTION_CONVERT_QUEUE },
    ),
    ConfigModule,
    StorageModule,
    LlmGatewayModule,
    GatewaysModule,
  ],
  controllers: [IngestionController],
  providers: [
    IngestionService,
    IngestionClassifierService,
    IngestionNotificationService,
    PiiRedactorService,
    TipTapConverterService,
    IngestionWorker,
    ConversionWorker,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
