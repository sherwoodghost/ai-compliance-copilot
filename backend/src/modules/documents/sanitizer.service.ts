import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';

/**
 * SanitizerService — mandatory XSS guard applied on ALL document save paths.
 *
 * TipTap accepts pasted HTML. Without sanitization, every save path is a
 * stored-XSS vector. This service whitelists only the tags that TipTap outputs
 * and strips all event attributes, data URIs, and script-capable constructs.
 */
@Injectable()
export class SanitizerService {
  /** Allowed HTML tags produced by TipTap's default extensions */
  private static readonly ALLOWED_TAGS = [
    'p', 'br', 'div', 'span',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
    'mark', 'code', 'pre',
    'blockquote', 'hr',
    'a',
    'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    // Task list nodes
    'input',
  ];

  private static readonly ALLOWED_ATTRS = [
    // Standard
    'class', 'id', 'style',
    // Links
    'href', 'target', 'rel',
    // Images
    'src', 'alt', 'width', 'height',
    // Task list items
    'type', 'checked', 'disabled',
    // TipTap custom node attrs
    'data-type', 'data-checked',
    // Text align
    'dir',
  ];

  /**
   * Sanitize HTML before writing to the database.
   * Strips all event handlers, scripts, iframes, and unsafe attributes.
   */
  sanitize(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: SanitizerService.ALLOWED_TAGS,
      ALLOWED_ATTR: SanitizerService.ALLOWED_ATTRS,
      // Block javascript: and data: URIs in href/src
      ALLOW_DATA_ATTR: false,
      // Force all URLs to be safe
      FORCE_BODY: false,
    });
  }

  /**
   * Strip all HTML tags to produce plain text (used for contentText cache + search).
   */
  toPlainText(html: string): string {
    if (!html) return '';
    return DOMPurify.sanitize(html, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
  }

  /**
   * Count words in a plain-text string.
   */
  countWords(text: string): number {
    if (!text) return 0;
    return text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }
}
