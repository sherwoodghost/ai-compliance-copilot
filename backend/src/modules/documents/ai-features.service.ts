import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GapResult {
  section:   string;
  framework: string;
  severity:  'critical' | 'major' | 'minor';
  detail:    string;
}

@Injectable()
export class AiFeaturesService {
  private readonly logger = new Logger(AiFeaturesService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    const available = org.aiTokenBudgetMonthly - org.aiTokensUsedMonth;
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

  // ── LLM call helper ─────────────────────────────────────────────────────────

  private async callLlm(
    systemPrompt: string,
    userMessage:  string,
    maxTokens = 800,
  ): Promise<{ text: string; tokensUsed: number }> {
    // Use the OpenRouter / Anthropic endpoint already configured in the project
    // The LlmGateway or equivalent service should be injected — we call it via HTTP
    // to avoid circular dependency. This is intentionally simple:
    const apiKey  = process.env.OPENROUTER_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '';
    const baseUrl = process.env.OPENROUTER_API_KEY
      ? 'https://openrouter.ai/api/v1'
      : 'https://api.anthropic.com/v1';

    const body = JSON.stringify({
      model:       'anthropic/claude-haiku-3-5',
      max_tokens:  maxTokens,
      messages:    [{ role: 'user', content: userMessage }],
      system:      systemPrompt,
    });

    const res = await fetch(`${baseUrl}/messages`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
        ...(process.env.OPENROUTER_API_KEY ? { 'HTTP-Referer': 'https://compliance-copilot.app' } : {}),
      },
      body,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`LLM call failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      text:       data.content?.[0]?.text ?? '',
      tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
    };
  }

  // ── Improve selected text ───────────────────────────────────────────────────

  async improveText(
    orgId:       string,
    selectedHtml: string,
    instruction?: string,
  ): Promise<string> {
    await this.checkAndIncrementBudget(orgId, 1000);

    const system = `You are a compliance document editor. Rewrite the provided text to be clear, formal, and precise for enterprise compliance documentation. Output only the improved HTML, preserving all tags. Do not add commentary or wrap in markdown.`;
    const user   = instruction
      ? `Instruction: ${instruction}\n\nHTML to improve:\n${selectedHtml}`
      : `Improve this text:\n${selectedHtml}`;

    const { text, tokensUsed } = await this.callLlm(system, user, 800);
    await this.incrementUsed(orgId, tokensUsed);
    return text;
  }

  // ── Detect missing ISO/SOC2 sections ────────────────────────────────────────

  async detectGaps(
    orgId:      string,
    content:    string,
    frameworks: string[],
  ): Promise<GapResult[]> {
    await this.checkAndIncrementBudget(orgId, 2000);

    const system = `You are a compliance expert. Given a compliance document and list of frameworks, identify which required sections or clauses are missing or incomplete. Return a JSON array of objects with fields: { "section": string, "framework": string, "severity": "critical"|"major"|"minor", "detail": string }. Output only valid JSON.`;
    const user   = `Frameworks: ${frameworks.join(', ')}\n\nDocument content (plain text):\n${content.slice(0, 8000)}`;

    const { text, tokensUsed } = await this.callLlm(system, user, 1500);
    await this.incrementUsed(orgId, tokensUsed);

    try {
      // Strip possible markdown code fences
      const json = text.replace(/```json\n?/, '').replace(/\n?```/, '').trim();
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
    const user   = `Here is the PDF as base64. Extract and reconstruct as Markdown:\n${base64Pdf.slice(0, 4000)}`;

    const { text, tokensUsed } = await this.callLlm(system, user, 2000);
    await this.incrementUsed(orgId, tokensUsed);
    return text;
  }
}
