'use client';

import React from 'react';
import ControlLinkifiedText, { linkifyText } from './ControlLinkifiedText';

export interface MarkdownWithControlsProps {
  content: string;
  className?: string;
}

// ─── Attempt to import react-markdown ──────────────────────────────────────
// We do a conditional import at module level via a try/catch so the bundle
// gracefully falls back to ControlLinkifiedText when the package is absent.

let ReactMarkdown: React.ComponentType<{
  children: string;
  components?: Record<string, React.ComponentType<React.HTMLAttributes<HTMLElement>>>;
}> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ReactMarkdown = require('react-markdown').default ?? require('react-markdown');
} catch {
  ReactMarkdown = null;
}

// ─── Custom markdown component renderers ────────────────────────────────────

/**
 * Extracts the text content from React children (for passing into linkifyText).
 * react-markdown passes children as strings for text-only nodes.
 */
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<{ children?: React.ReactNode }>;
    return extractText(el.props.children);
  }
  return '';
}

function LinkifiedParagraph({ children, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  const text = extractText(children);
  // If linkifying would produce chips, render linkified; otherwise pass through
  const hasControlCode = /\b(CC[1-9]\.\d+|A\.\d+\.\d+(?:\.\d+)?|PI\d+\.\d+|C\d+\.\d+|P\d+\.\d+|A1\.\d+)\b/.test(text);
  return (
    <p {...rest}>
      {hasControlCode ? linkifyText(text) : children}
    </p>
  );
}

function LinkifiedListItem({ children, ...rest }: React.HTMLAttributes<HTMLLIElement>) {
  const text = extractText(children);
  const hasControlCode = /\b(CC[1-9]\.\d+|A\.\d+\.\d+(?:\.\d+)?|PI\d+\.\d+|C\d+\.\d+|P\d+\.\d+|A1\.\d+)\b/.test(text);
  return (
    <li {...rest}>
      {hasControlCode ? linkifyText(text) : children}
    </li>
  );
}

function LinkifiedCode({ children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  const text = extractText(children);
  const hasControlCode = /\b(CC[1-9]\.\d+|A\.\d+\.\d+(?:\.\d+)?|PI\d+\.\d+|C\d+\.\d+|P\d+\.\d+|A1\.\d+)\b/.test(text);
  // Inline code that looks like a control code → render as chip, otherwise keep <code>
  if (hasControlCode) {
    return <>{linkifyText(text)}</>;
  }
  return <code {...rest}>{children}</code>;
}

// Map of components passed to ReactMarkdown
const markdownComponents = {
  p: LinkifiedParagraph as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
  li: LinkifiedListItem as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
  code: LinkifiedCode as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
};

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Renders markdown content with control codes linkified as interactive chips.
 *
 * Uses `react-markdown` when available; falls back to `ControlLinkifiedText`
 * (plain-text linkification) when the package is not installed.
 */
export default function MarkdownWithControls({
  content,
  className,
}: MarkdownWithControlsProps) {
  const baseClass = [
    'prose prose-sm max-w-none',
    'prose-p:my-1.5 prose-li:my-0.5',
    'prose-headings:font-semibold prose-headings:text-gray-900',
    'prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (ReactMarkdown) {
    return (
      <div className={baseClass}>
        <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      </div>
    );
  }

  // Fallback: no react-markdown — just linkify raw text
  return (
    <div className={baseClass}>
      <ControlLinkifiedText text={content} />
    </div>
  );
}
