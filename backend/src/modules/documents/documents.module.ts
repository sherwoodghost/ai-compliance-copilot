import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SanitizerService } from './sanitizer.service';
import { RetentionService } from './retention.service';
import { AiFeaturesService } from './ai-features.service';
import { DocumentAuditListener } from './listeners/document-audit.listener';
import { DocumentEvidenceListener } from './listeners/document-evidence.listener';
@Module({
  imports: [],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    SanitizerService,
    RetentionService,
    AiFeaturesService,
    DocumentAuditListener,
    DocumentEvidenceListener,
  ],
  exports: [DocumentsService, SanitizerService],
})
export class DocumentsModule {}
