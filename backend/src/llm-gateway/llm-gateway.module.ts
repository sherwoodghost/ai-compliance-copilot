import { Module } from '@nestjs/common';
import { LlmGatewayService } from './llm-gateway.service';
import { PromptRegistryService } from './prompt-registry.service';
import { ContextPackerService } from './context-packer.service';
import { OutputValidatorService } from './output-validator.service';
import { EmbeddingsService } from './rag/embeddings.service';
import { RagService } from './rag/rag.service';
import { RetrievalLogService } from './rag/retrieval-log.service';
import { RagIndexerService } from './rag/rag-indexer.service';
import { EvalHarnessService } from './eval/eval-harness.service';
import { DatabaseModule } from '../database/database.module';
import { LlmModule } from '../llm/llm.module';
import { ControlLibraryModule } from '../control-library/control-library.module';

@Module({
  imports: [DatabaseModule, LlmModule, ControlLibraryModule],
  providers: [
    LlmGatewayService,
    PromptRegistryService,
    ContextPackerService,
    OutputValidatorService,
    EmbeddingsService,
    RagService,
    RetrievalLogService,
    RagIndexerService,
    EvalHarnessService,
  ],
  exports: [LlmGatewayService, PromptRegistryService, RagService, EmbeddingsService, RagIndexerService, EvalHarnessService],
})
export class LlmGatewayModule {}
