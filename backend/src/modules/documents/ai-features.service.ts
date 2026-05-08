import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

export interface GapResult {
  section:   string;
  framework: string;
  severity:  'critical' | 'major' | 'minor';
  detail:    string;
}

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

@Injectable()
export class AiFeaturesService {
  private readonly logger = new Logger(AiFeaturesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // ── Token budget guard ──────────────────────────────────────────────────────

  private async checkAndIncrementBudget(orgId: string, estimatedTokens: number): Promise<void> {
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
    const now = new Date();

    // Reset monthly counter if needed
    if (!org.aiTokensResetAt || org.aiTokensResetAt < new Date(now.getFullYear(), now.getMonth(), 1)) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data:  { aiTokensUsedMonth: 0, aiTokensResetAt: now },
      });
      return; // fresh month, allow the call
    }

    const available = (org.aiTokenBudgetMonthly ?? 500000) - (org.aiTokensUsedMonth ?? 0);
    if (estimatedTokens > available) {
      throw new HttpException(
        `Monthly AI token budget exceeded. Used: ${org.aiTokensUsedMonth} / ${org.aiTokenBudgetMonthly}`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  private async incrementUsed(orgId: string, tokensUsed: number): Promise<void> {
    await this.prisma.organization.update({
      where: { id: orgId },
      data:  { aiTokensUsedMonth: { increment: tokensUsed } },
    });
  }

  // ── Improve selected text ───────────────────────────────────────────────────

  async improveText(
    orgId:        string,
    selectedHtml: string,
    instruction?: string,
  ): Promise<string> {
    await this.checkAndIncrementBudget(orgId, 1000);

    const system = `You are a compliance document editor. Rewrite the provided text to be clear, formal, and precise for enterprise compliance documentation. Output only the improved text (plain text or HTML matching the input format). Do not add commentary or wrap in markdown code blocks.`;

    const userMsg = instruction
      ? `Instruction: ${instruction}\n\nText to improve:\n${selectedHtml}`
      : `Improve this text for a compliance document:\n${selectedHtml}`;

    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: userMsg }],
      { model: HAIKU_MODEL, systemPrompt: system, maxTokens: 800, temperature: 0.2 },
    );

    const tokensUsed = (response.tokensIn ?? 0) + (response.tokensOut ?? 0);
    if (tokensUsed > 0) await this.incrementUsed(orgId, tokensUsed);

    return response.content;
  }

  // ── Detect missing ISO/SOC2 sections ────────────────────────────────────────

  async detectGaps(
    orgId:      string,
    content:    string,
    frameworks: string[],
  ): Promise<GapResult[]> {
    await this.checkAndIncrementBudget(orgId, 2000);

    const system = `You are a compliance expert. Given a compliance document and list of frameworks, identify which required sections or clauses are missing or incomplete. Return a JSON array of objects with fields: { "section": string, "framework": string, "severity": "critical"|"major"|"minor", "detail": string }. Output only valid JSON with no markdown fences.`;

    const userMsg = `Frameworks: ${frameworks.join(', ')}\n\nDocument content (plain text):\n${content.slice(0, 8000)}`;

    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: userMsg }],
      { model: HAIKU_MODEL, systemPrompt: system, maxTokens: 1500, temperature: 0.1 },
    );

    const tokensUsed = (response.tokensIn ?? 0) + (response.tokensOut ?? 0);
    if (tokensUsed > 0) await this.incrementUsed(orgId, tokensUsed);

    try {
      const json = response.content.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      return JSON.parse(json) as GapResult[];
    } catch {
      this.logger.warn('Failed to parse gap analysis response as JSON');
      return [];
    }
  }

  // ── Extract content from PDF (via AI) ───────────────────────────────────────

  async extractPdf(orgId: string, base64Pdf: string): Promise<string> {
    await this.checkAndIncrementBudget(orgId, 3000);

    const system = `Extract and reconstruct the content of this compliance document as clean structured Markdown, preserving headings, tables, and lists. Output only the Markdown.`;
    const userMsg = `Here is the PDF as base64. Extract and reconstruct as Markdown:\n${base64Pdf.slice(0, 4000)}`;

    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: userMsg }],
      { model: HAIKU_MODEL, systemPrompt: system, maxTokens: 2000, temperature: 0.1 },
    );

    const tokensUsed = (response.tokensIn ?? 0) + (response.tokensOut ?? 0);
    if (tokensUsed > 0) await this.incrementUsed(orgId, tokensUsed);

    return response.content;
  }
}
