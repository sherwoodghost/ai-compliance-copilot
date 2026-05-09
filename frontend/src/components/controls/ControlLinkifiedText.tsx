'use client';

import React from 'react';
import ControlChip from './ControlChip';

// Matches: CC6.1, A.5.1, A.5.1.2, PI1.1, C1.1, P1.1, A1.1
const CONTROL_CODE_REGEX =
  /\b(CC[1-9]\.\d+|A\.\d+\.\d+(?:\.\d+)?|PI\d+\.\d+|C\d+\.\d+|P\d+\.\d+|A1\.\d+)\b/g;

export interface ControlLinkifiedTextProps {
  text: string;
  className?: string;
}

/**
 * Splits a plain-text string on control code mentions and renders each
 * matching code as a <ControlChip>.  Newlines are preserved as <br />.
 */
export default function ControlLinkifiedText({
  text,
  className,
}: ControlLinkifiedTextProps) {
  const nodes = linkifyText(text);

  return (
    <span className={className}>
      {nodes}
    </span>
  );
}

/**
 * Converts a plain string into an array of React nodes where control codes
 * become <ControlChip> elements and newlines become <br /> elements.
 */
export function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(CONTROL_CODE_REGEX);
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    // Even indices are plain text, odd indices are captured groups (control codes)
    if (i % 2 === 1) {
      nodes.push(<ControlChip key={`chip-${i}`} code={part} />);
    } else {
      // Preserve newlines in plain text segments
      const lines = part.split('\n');
      lines.forEach((line, j) => {
        if (line) {
          nodes.push(<span key={`text-${i}-${j}`}>{line}</span>);
        }
        if (j < lines.length - 1) {
          nodes.push(<br key={`br-${i}-${j}`} />);
        }
      });
    }
  }

  return nodes;
}
