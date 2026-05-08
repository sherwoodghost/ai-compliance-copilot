import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SanitizerService } from './sanitizer.service';
import { RetentionService } from './retention.service';
import { AiFeaturesService } from './ai-features.service';
import { DocumentAuditListener } from './listeners/document-audit.listener';
import { DocumentEvidenceListener } from './listeners/document-evidence.listener';
import { DocumentNotificationListener } from './listeners/document-notification.listener';
import { DocumentWorker, DOCUMENT_QUEUE } from './workers/document.worker';
import { StorageModule } from '../../storage/storage.module';
import { EmbeddingModule } from '../../embeddings/embedding.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    EmbeddingModule,
    FeatureFlagsModule,
    BullModule.registerQueue({ name: DOCUMENT_QUEUE }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    SanitizerService,
    RetentionService,
    AiFeaturesService,
    DocumentAuditListener,
    DocumentEvidenceListener,
    DocumentNotificationListener,
    DocumentWorker,
  ],
  exports: [DocumentsService, SanitizerService],
})
export class DocumentsModule {}
