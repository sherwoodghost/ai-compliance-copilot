import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RagChunk } from './rag.service';

@Injectable()
export class RetrievalLogService {
  private readonly logger = new Logger(RetrievalLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log which RAG chunks were retrieved and whether they were included in the prompt.
   */
  async logRetrieval(
    llmCallId: string,
    chunks: RagChunk[],
    includedIds: Set<string>,
  ): Promise<void> {
    try {
      await this.prisma.llmRetrievalSource.createMany({
        data: chunks.map((chunk) => ({
          llmCallId,
          sourceType: chunk.sourceType,
          sourceId: chunk.sourceId ?? null,
          chunkId: chunk.id,
          similarityScore: chunk.similarityScore,
          includedInPrompt: includedIds.has(chunk.id),
        })),
        skipDuplicates: true,
      });
    } catch (error: any) {
      // Non-fatal — logging failure should not break the LLM call
      this.logger.warn(`Failed to log retrieval sources for call ${llmCallId}: ${error.message}`);
    }
  }
}
