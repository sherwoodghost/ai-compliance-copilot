import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { TipTapConverterService } from '../tiptap-converter.service';
import { ComplianceGateway } from '../../../gateways/compliance.gateway';

export const INGESTION_CONVERT_QUEUE = 'ingestion.convert';

interface ConvertFileJob {
  fileId: string;
  orgId: string;
  batchId: string;
  storageKey: string;
  mimeType: string;
  documentId: string;
}

@Processor(INGESTION_CONVERT_QUEUE)
export class ConversionWorker {
  private readonly logger = new Logger(ConversionWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly converter: TipTapConverterService,
    private readonly gateway: ComplianceGateway,
  ) {}

  @Process('convert-file')
  async convertFile(job: Job<ConvertFileJob>) {
    const { fileId, orgId, storageKey, mimeType, documentId } = job.data;
    this.logger.log(`Converting file ${fileId} → document ${documentId}`);

    try {
      // Verify tenant isolation
      this.storage.assertOrgOwnership(orgId, storageKey);

      // Update file status to converting
      await this.prisma.ingestionFile.update({
        where: { id: fileId },
        data: { status: 'converting' },
      });

      // Download file from storage
      const buffer = await this.storage.download(storageKey);

      // Get the original filename for format detection
      const file = await this.prisma.ingestionFile.findUnique({
        where: { id: fileId },
        select: { originalName: true },
      });
      const filename = file?.originalName ?? 'unknown';

      // Convert to TipTap
      const result = await this.converter.convert(buffer, mimeType, filename);

      // Update Document with converted content
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          content: result.json,
          contentHtml: result.html,
          contentText: result.plainText.slice(0, 100000), // limit plain text size
          sourceStorageKey: storageKey,
        },
      });

      // Mark file as fully mapped
      await this.prisma.ingestionFile.update({
        where: { id: fileId },
        data: { status: 'mapped' },
      });

      // Emit real-time file converted event
      this.gateway.emitIngestionFileConverted(orgId, fileId, documentId);

      this.logger.log(`Successfully converted file ${fileId}`);
    } catch (err: any) {
      this.logger.error(`Conversion failed for file ${fileId}: ${err.message}`, err.stack);

      await this.prisma.ingestionFile.update({
        where: { id: fileId },
        data: {
          status: 'error',
          errorMessage: `Conversion failed: ${err.message}`,
        },
      }).catch(() => {});

      throw err;
    }
  }
}
