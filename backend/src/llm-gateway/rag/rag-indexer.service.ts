import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RagService } from './rag.service';

/**
 * RagIndexerService — runs after all modules are initialized (OnApplicationBootstrap).
 * Indexes the control library into the vector store so it's available for RAG retrieval.
 * Safe to run repeatedly — indexing is idempotent (deletes + re-creates chunks).
 */
@Injectable()
export class RagIndexerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RagIndexerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Run indexing in the background so startup isn't blocked
    this.indexControlLibrary().catch((err) =>
      this.logger.warn(`Control library RAG indexing failed: ${err.message}`),
    );
  }

  /**
   * Index all controls from the database into the RAG vector store.
   * Controls are global (org_id = null) — shared across all tenants.
   */
  private async indexControlLibrary(): Promise<void> {
    try {
      const controls = await this.prisma.control.findMany({
        include: { framework: true },
        orderBy: { code: 'asc' },
      });

      if (!controls.length) {
        this.logger.warn('No controls found in database — skipping RAG indexing');
        return;
      }

      this.logger.log(`Starting RAG indexing of ${controls.length} controls...`);

      await this.rag.indexControlLibrary(
        controls.map((c) => ({
          id: c.id,
          code: c.code,
          title: c.title,
          description: c.description ?? '',
          framework: c.framework.type,
        })),
      );

      this.logger.log('Control library RAG indexing complete');
    } catch (error: any) {
      this.logger.error(`Failed to index control library: ${error.message}`);
    }
  }

  /**
   * Index a policy document when approved.
   * Called by PolicyService after approval.
   */
  async indexPolicy(orgId: string, policyId: string): Promise<void> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    if (!policy) return;

    const text = [
      `Policy: ${policy.title}`,
      `Status: ${policy.status}`,
      `Version: ${policy.version}`,
      policy.content ? `Content:\n${policy.content}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    await this.rag.indexDocument(orgId, 'policy_template', policyId, text, {
      title: policy.title,
      status: policy.status,
    });
  }

  /**
   * Index a risk register entry when created/updated.
   */
  async indexRisk(orgId: string, riskId: string): Promise<void> {
    const risk = await this.prisma.riskItem.findUnique({ where: { id: riskId } });
    if (!risk) return;

    const text = [
      `Risk: ${risk.title}`,
      `Description: ${risk.description ?? ''}`,
      `Severity: ${risk.severity ?? 'unknown'} | Score: ${risk.riskScore ?? 0}`,
      `Status: ${risk.status}`,
    ].join('\n');

    await this.rag.indexDocument(orgId, 'risk_register', riskId, text, {
      severity: risk.severity,
      status: risk.status,
    });
  }

  /**
   * Index evidence text when evidence is created/updated.
   */
  async indexEvidence(orgId: string, evidenceId: string): Promise<void> {
    const evidence = await this.prisma.evidence.findUnique({ where: { id: evidenceId } });
    if (!evidence) return;

    const text = [
      `Evidence: ${evidence.title}`,
      `Type: ${evidence.type}`,
      `Source: ${evidence.source}`,
    ].join('\n');

    await this.rag.indexDocument(orgId, 'evidence', evidenceId, text, {
      evidenceType: evidence.type,
    });
  }
}
