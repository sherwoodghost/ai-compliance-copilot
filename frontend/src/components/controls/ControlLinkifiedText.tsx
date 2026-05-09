'use client';

import React from 'react';
import ControlChip from './ControlChip';

// Matches:
//   SOC 2:      CC6.1, CC1.1, PI1.1, C1.1, P1.1–P8.1, A1.1
//   ISO 27001:  A.5.1, A.5.1.2, A.8.24
//   GDPR:       GDPR-Art-5-1, GDPR-Art-33-1
//   ISO 9001:   ISO9001-4.1, ISO9001-10.2
//   HIPAA:      HIPAA-308-a-1-i, HIPAA-312-e-1
//   PCI-DSS:    PCI-1.1, PCI-10.3
//   FedRAMP:    AC-1, AC-2, SC-28
//   NIST CSF:   GV.OC-01, ID.AM-01, PR.AA-01, DE.CM-01, RS.MA-01, RC.RP-01
//   ISO 14001:  ISO14001-4.1, ISO14001-8.2
//   ISO 45001:  ISO45001-4.1, ISO45001-6.1
const CONTROL_CODE_REGEX =
  /\b(CC[1-9]\.\d+|A\.\d+\.\d+(?:\.\d+)?|PI\d+\.\d+|C\d+\.\d+|A1\.\d+|GDPR-Art-\d+(?:-\d+)*|ISO9001-\d+(?:\.\d+)*|HIPAA-\d{3}-[a-z0-9-]+|PCI-\d+(?:\.\d+)*|(?:AC|AT|AU|CA|CM|CP|IA|IR|MA|MP|PE|PL|PM|PS|RA|SA|SC|SI|SR)-\d+(?:\.\d+)*|(?:GV|ID|PR|DE|RS|RC)\.[A-Z]{2}-\d{2}|ISO14001-\d+(?:\.\d+)*|ISO45001-\d+(?:\.\d+)*|P[1-8]\.\d+)\b/g;

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
