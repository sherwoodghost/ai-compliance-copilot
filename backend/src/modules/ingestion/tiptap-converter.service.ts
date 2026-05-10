import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateJSON, generateHTML } = require('@tiptap/html/server');
import { SERVER_EXTENSIONS } from './tiptap-extensions';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { marked } = require('marked');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parse: csvParse } = require('csv-parse/sync');

export interface ConversionResult {
  json: Record<string, any>;  // TipTap JSON document
  html: string;                // Rendered HTML
  plainText: string;           // Plain text for search indexing
}

@Injectable()
export class TipTapConverterService {
  private readonly logger = new Logger(TipTapConverterService.name);

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  // ── Text Extraction (for classification) ──────────────────────────────────

  /**
   * Extract plain text from a file buffer for classification purposes.
   * Returns up to maxChars characters.
   */
  async extractText(buffer: Buffer, mimeType: string, maxChars = 2000): Promise<string> {
    try {
      let text = '';

      if (this.isDocx(mimeType)) {
        const result: any = await this.withTimeout(mammoth.extractRawText({ buffer }), 30000, 'DOCX extraction');
        text = result.value;
      } else if (this.isPdf(mimeType)) {
        const result: any = await this.withTimeout(pdfParse(buffer), 30000, 'PDF extraction');
        text = result.text;
      } else if (this.isCsv(mimeType)) {
        text = buffer.toString('utf-8');
      } else if (this.isMarkdown(mimeType)) {
        text = buffer.toString('utf-8');
      } else if (this.isPlainText(mimeType)) {
        text = buffer.toString('utf-8');
      } else if (this.isImage(mimeType)) {
        text = '[Image file — no text content]';
      } else {
        // Try as plain text
        text = buffer.toString('utf-8');
      }

      return text.slice(0, maxChars);
    } catch (err: any) {
      this.logger.warn(`Text extraction failed for ${mimeType}: ${err.message}`);
      return '';
    }
  }

  // ── Full Conversion to TipTap JSON ────────────────────────────────────────

  /**
   * Convert a file buffer to TipTap JSON, rendered HTML, and plain text.
   */
  async convert(buffer: Buffer, mimeType: string, filename: string): Promise<ConversionResult> {
    if (this.isDocx(mimeType)) {
      return this.convertDocx(buffer);
    }
    if (this.isPdf(mimeType)) {
      return this.convertPdf(buffer);
    }
    if (this.isMarkdown(mimeType) || filename.endsWith('.md')) {
      return this.convertMarkdown(buffer);
    }
    if (this.isCsv(mimeType) || filename.endsWith('.csv')) {
      return this.convertCsv(buffer);
    }
    if (this.isImage(mimeType)) {
      return this.convertImage(filename);
    }
    // Default: plain text
    return this.convertPlainText(buffer);
  }

  // ── DOCX ──────────────────────────────────────────────────────────────────

  private async convertDocx(buffer: Buffer): Promise<ConversionResult> {
    const htmlResult: any = await this.withTimeout(mammoth.convertToHtml(buffer, {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    }), 30000, 'DOCX HTML conversion');

    const html = this.sanitizeHtml(htmlResult.value);
    const json = generateJSON(html, SERVER_EXTENSIONS);
    const plainText: any = await this.withTimeout(mammoth.extractRawText({ buffer }), 30000, 'DOCX text extraction');

    return { json, html, plainText: plainText.value };
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  private async convertPdf(buffer: Buffer): Promise<ConversionResult> {
    const result: any = await this.withTimeout(pdfParse(buffer), 30000, 'PDF conversion');
    const text = result.text;

    // Build TipTap doc manually: split by double newlines, detect headings
    const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim());
    const content: any[] = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Heuristic: short ALL-CAPS lines are likely headings
      if (trimmed.length < 100 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: trimmed }],
        });
      } else {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: trimmed }],
        });
      }
    }

    const json = { type: 'doc', content };
    const html = generateHTML(json, SERVER_EXTENSIONS);

    return { json, html, plainText: text };
  }

  // ── Markdown ──────────────────────────────────────────────────────────────

  private async convertMarkdown(buffer: Buffer): Promise<ConversionResult> {
    const md = buffer.toString('utf-8');
    const html = this.sanitizeHtml(marked(md));
    const json = generateJSON(html, SERVER_EXTENSIONS);

    // Strip HTML for plain text
    const plainText = md;

    return { json, html, plainText };
  }

  // ── CSV ───────────────────────────────────────────────────────────────────

  private async convertCsv(buffer: Buffer): Promise<ConversionResult> {
    const text = buffer.toString('utf-8');
    const records: string[][] = csvParse(text, {
      relax_column_count: true,
      skip_empty_lines: true,
    });

    if (records.length === 0) {
      return this.convertPlainText(buffer);
    }

    const tableRows: any[] = records.map((row: string[], rowIndex: number) => {
      const cellType = rowIndex === 0 ? 'tableHeader' : 'tableCell';
      return {
        type: 'tableRow',
        content: row.map((cell: string) => ({
          type: cellType,
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: cell.trim() || ' ' }] },
          ],
        })),
      };
    });

    const json = {
      type: 'doc',
      content: [{ type: 'table', content: tableRows }],
    };
    const html = generateHTML(json, SERVER_EXTENSIONS);

    return { json, html, plainText: text };
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  private async convertImage(filename: string): Promise<ConversionResult> {
    // Image nodes reference the file by its storage key; the URL is resolved
    // at render time via a signed URL. For now, use the filename as a placeholder.
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'image',
              attrs: { src: `__STORAGE_REF__:${filename}`, alt: filename },
            },
          ],
        },
      ],
    };

    const safeName = this.escapeHtml(filename);
    const html = `<img src="__STORAGE_REF__:${safeName}" alt="${safeName}" />`;
    return { json, html, plainText: `[Image: ${filename}]` };
  }

  // ── Plain Text ────────────────────────────────────────────────────────────

  private async convertPlainText(buffer: Buffer): Promise<ConversionResult> {
    const text = buffer.toString('utf-8');
    const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());

    const content = paragraphs.map((para) => ({
      type: 'paragraph' as const,
      content: [{ type: 'text' as const, text: para.trim() }],
    }));

    const json = { type: 'doc', content };
    const html = generateHTML(json, SERVER_EXTENSIONS);

    return { json, html, plainText: text };
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private sanitizeHtml(html: string): string {
    // Strip script tags, event handlers, and dangerous attributes
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
      .replace(/<object[\s\S]*?<\/object>/gi, '')
      .replace(/<embed[\s\S]*?\/?>/gi, '');
  }

  private isDocx(mimeType: string): boolean {
    return mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || mimeType === 'application/msword';
  }

  private isPdf(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  private isCsv(mimeType: string): boolean {
    return mimeType === 'text/csv'
      || mimeType === 'application/vnd.ms-excel';
  }

  private isMarkdown(mimeType: string): boolean {
    return mimeType === 'text/markdown'
      || mimeType === 'text/x-markdown';
  }

  private isPlainText(mimeType: string): boolean {
    return mimeType === 'text/plain';
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
}
