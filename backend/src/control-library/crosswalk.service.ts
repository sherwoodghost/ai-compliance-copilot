import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ControlLibraryService } from './control-library.service';

/**
 * Core SOC 2 ↔ ISO 27001 crosswalk mappings.
 * These are seeded once into the framework_crosswalks table.
 */
const SOC2_ISO_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // CC1 — Control Environment ↔ A.5 Organizational Controls
  { sourceCode: 'CC1.1', targetCode: 'A.5.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require documented IS policies with management commitment', automatable: true },
  { sourceCode: 'CC1.2', targetCode: 'A.5.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Both cover information security roles and responsibilities', automatable: true },
  { sourceCode: 'CC1.3', targetCode: 'A.5.4', mappingType: 'partial', confidence: 'high', rationale: 'CC1.3 board oversight partially maps to ISO management direction', automatable: false },
  { sourceCode: 'CC1.4', targetCode: 'A.6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both cover screening / personnel responsibilities', automatable: true },
  { sourceCode: 'CC1.5', targetCode: 'A.5.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address segregation of duties', automatable: true },

  // CC2 — Communication ↔ A.5 / A.6
  { sourceCode: 'CC2.1', targetCode: 'A.5.1', mappingType: 'partial', confidence: 'medium', rationale: 'Policy communication aligns with policy management', automatable: false },
  { sourceCode: 'CC2.2', targetCode: 'A.5.37', mappingType: 'partial', confidence: 'medium', rationale: 'External communication of objectives relates to documented procedures', automatable: false },
  { sourceCode: 'CC2.3', targetCode: 'A.6.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security event reporting lines', automatable: true },

  // CC3 — Risk Assessment ↔ A.5.7, A.5.8
  { sourceCode: 'CC3.1', targetCode: 'A.5.7', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require threat intelligence / risk identification processes', automatable: true },
  { sourceCode: 'CC3.2', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require IS risk management embedded in organizational processes', automatable: true },
  { sourceCode: 'CC3.3', targetCode: 'A.5.7', mappingType: 'partial', confidence: 'medium', rationale: 'Fraud risk partially covered by threat intelligence', automatable: false },
  { sourceCode: 'CC3.4', targetCode: 'A.5.8', mappingType: 'partial', confidence: 'medium', rationale: 'Change risk partially covered by risk management process', automatable: false },

  // CC4 — Monitoring Activities ↔ A.8 Technology Controls
  { sourceCode: 'CC4.1', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require ongoing monitoring of systems and networks', automatable: true },
  { sourceCode: 'CC4.2', targetCode: 'A.5.36', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address compliance evaluation and deficiency remediation', automatable: true },

  // CC5 — Control Activities ↔ A.5 / A.8
  { sourceCode: 'CC5.1', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address selecting controls to address risks', automatable: true },
  { sourceCode: 'CC5.2', targetCode: 'A.5.1', mappingType: 'partial', confidence: 'medium', rationale: 'Technology general controls partially mapped to policy requirements', automatable: false },
  { sourceCode: 'CC5.3', targetCode: 'A.5.5', mappingType: 'partial', confidence: 'medium', rationale: 'Both address liaison with regulators and relevant authorities', automatable: false },

  // CC6 — Logical Access ↔ A.5, A.6, A.8
  { sourceCode: 'CC6.1', targetCode: 'A.5.15', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require access control policies and user account management', automatable: true },
  { sourceCode: 'CC6.1', targetCode: 'A.5.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require identity management processes', automatable: true },
  { sourceCode: 'CC6.2', targetCode: 'A.5.17', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require authentication information management', automatable: true },
  { sourceCode: 'CC6.3', targetCode: 'A.5.18', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require access rights provisioning, review, and revocation', automatable: true },
  { sourceCode: 'CC6.4', targetCode: 'A.7.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address physical access restrictions', automatable: true },
  { sourceCode: 'CC6.5', targetCode: 'A.5.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address secure disposal and return of assets', automatable: true },
  { sourceCode: 'CC6.6', targetCode: 'A.8.21', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require network service security management', automatable: true },
  { sourceCode: 'CC6.7', targetCode: 'A.8.20', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address network security controls', automatable: true },
  { sourceCode: 'CC6.8', targetCode: 'A.8.7', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require malware protection controls', automatable: true },

  // CC7 — System Operations ↔ A.8
  { sourceCode: 'CC7.1', targetCode: 'A.8.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require management of technical vulnerabilities', automatable: true },
  { sourceCode: 'CC7.2', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require monitoring for anomalous behavior and events', automatable: true },
  { sourceCode: 'CC7.3', targetCode: 'A.5.26', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address response to information security incidents', automatable: true },
  { sourceCode: 'CC7.4', targetCode: 'A.5.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security incident management planning', automatable: true },
  { sourceCode: 'CC7.5', targetCode: 'A.5.30', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address ICT readiness for business continuity', automatable: true },

  // CC8 — Change Management ↔ A.8
  { sourceCode: 'CC8.1', targetCode: 'A.8.32', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require formal change management procedures', automatable: true },

  // CC9 — Risk Mitigation ↔ A.5
  { sourceCode: 'CC9.1', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address risk assessment and selection of mitigating controls', automatable: true },
  { sourceCode: 'CC9.2', targetCode: 'A.5.19', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security in supplier relationships', automatable: true },

  // Availability ↔ A.5.30, A.8.14
  { sourceCode: 'A1.1', targetCode: 'A.5.30', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address business continuity planning for ICT', automatable: true },
  { sourceCode: 'A1.2', targetCode: 'A.8.14', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require redundancy of information processing facilities', automatable: true },
  { sourceCode: 'A1.3', targetCode: 'A.8.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information backup procedures', automatable: true },

  // Privacy ↔ A.5.34
  { sourceCode: 'P1.1', targetCode: 'A.5.34', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require privacy and PII protection management', automatable: true },
];

// ── GDPR ↔ ISO 27001:2022 crosswalk mappings ──────────────────────────────────
const GDPR_ISO_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // Art. 5 Principles ↔ A.5 Organizational Controls
  { sourceCode: 'GDPR-Art-5-1', targetCode: 'A.5.34', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address privacy and protection of PII; data minimisation aligns with PII collection limitation', automatable: true },
  { sourceCode: 'GDPR-Art-5-2', targetCode: 'A.5.1',  mappingType: 'partial',    confidence: 'high', rationale: 'Accountability principle aligns with IS policy management commitment', automatable: false },

  // Art. 6-7 Lawful Basis / Consent ↔ A.5.34
  { sourceCode: 'GDPR-Art-6-1', targetCode: 'A.5.34', mappingType: 'partial',    confidence: 'medium', rationale: 'Lawful basis for processing relates to PII processing conditions in ISO A.5.34', automatable: false },
  { sourceCode: 'GDPR-Art-7-1', targetCode: 'A.5.34', mappingType: 'related',    confidence: 'medium', rationale: 'Consent management is part of PII subject consent handling', automatable: false },

  // Art. 24-25 Controller obligations / Privacy by Design ↔ A.5 / A.8
  { sourceCode: 'GDPR-Art-24-1', targetCode: 'A.5.1',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require implementing appropriate technical and organisational measures', automatable: false },
  { sourceCode: 'GDPR-Art-25-1', targetCode: 'A.8.27', mappingType: 'equivalent', confidence: 'high', rationale: 'Privacy by Design directly maps to secure system architecture and engineering principles', automatable: false },

  // Art. 28 Processor agreements ↔ A.5.19-A.5.22 Supplier security
  { sourceCode: 'GDPR-Art-28-1', targetCode: 'A.5.19', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security requirements in supplier/processor agreements', automatable: true },
  { sourceCode: 'GDPR-Art-29-1', targetCode: 'A.5.20', mappingType: 'partial',    confidence: 'high', rationale: 'Processing under authority mirrors requirements in ICT supplier agreements', automatable: false },

  // Art. 30 Records of Processing ↔ A.5.9, A.5.33
  { sourceCode: 'GDPR-Art-30-1', targetCode: 'A.5.9',  mappingType: 'equivalent', confidence: 'high', rationale: 'ROPA (inventory of assets/processing) maps to asset inventory requirements', automatable: true },
  { sourceCode: 'GDPR-Art-30-1', targetCode: 'A.5.33', mappingType: 'partial',    confidence: 'medium', rationale: 'Both require maintaining records — ROPA for processing, ISO for audit evidence', automatable: false },

  // Art. 32 Security of Processing ↔ A.8 Technical Controls
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'A.8.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Art. 32 pseudonymisation/encryption directly maps to ISO cryptography controls', automatable: true },
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'A.8.3',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information access restriction to authorised users', automatable: true },
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'A.8.5',  mappingType: 'partial',    confidence: 'high', rationale: 'Secure authentication is part of technical security measures under Art. 32', automatable: true },
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'A.5.8',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require ongoing risk assessment to determine appropriate security measures', automatable: false },

  // Art. 33-34 Breach Notification ↔ A.5.24-A.5.28 Incident Management
  { sourceCode: 'GDPR-Art-33-1', targetCode: 'A.5.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require planning and preparation for information security incident management', automatable: true },
  { sourceCode: 'GDPR-Art-33-1', targetCode: 'A.5.26', mappingType: 'equivalent', confidence: 'high', rationale: '72-hour breach notification aligns with incident response to IS events', automatable: true },
  { sourceCode: 'GDPR-Art-34-1', targetCode: 'A.5.26', mappingType: 'partial',    confidence: 'high', rationale: 'Data subject breach notification is an output of the incident response process', automatable: false },

  // Art. 35 DPIA ↔ A.5.7-A.5.8 Risk Assessment
  { sourceCode: 'GDPR-Art-35-1', targetCode: 'A.5.8',  mappingType: 'equivalent', confidence: 'high', rationale: 'DPIA is a specialised privacy risk assessment; both require systematic risk identification', automatable: false },
  { sourceCode: 'GDPR-Art-35-3', targetCode: 'A.5.7',  mappingType: 'partial',    confidence: 'medium', rationale: 'High-risk processing identification aligns with threat intelligence assessment', automatable: false },

  // Art. 37/39 DPO ↔ A.5.2 IS roles
  { sourceCode: 'GDPR-Art-37-1', targetCode: 'A.5.2',  mappingType: 'partial',    confidence: 'medium', rationale: 'DPO appointment mirrors IS roles and responsibilities requirement', automatable: false },
  { sourceCode: 'GDPR-Art-39-1', targetCode: 'A.5.2',  mappingType: 'equivalent', confidence: 'high', rationale: 'DPO tasks (monitoring, advising) map to IS roles and responsibilities obligations', automatable: false },

  // Art. 44/46 International Transfers ↔ A.5.19 Supplier security
  { sourceCode: 'GDPR-Art-44-1', targetCode: 'A.5.19', mappingType: 'related',    confidence: 'medium', rationale: 'Both address security requirements when sharing data with third parties outside EEA', automatable: false },
  { sourceCode: 'GDPR-Art-46-1', targetCode: 'A.5.20', mappingType: 'related',    confidence: 'medium', rationale: 'Transfer safeguards relate to contractual security requirements in supplier agreements', automatable: false },
];

// ── GDPR ↔ SOC 2 crosswalk mappings ──────────────────────────────────────────
const GDPR_SOC2_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // Art. 5 Principles ↔ Privacy TSC
  { sourceCode: 'GDPR-Art-5-1', targetCode: 'P3.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require personal data collection limited to stated purpose (purpose limitation / P3 collection limitation)', automatable: false },
  { sourceCode: 'GDPR-Art-5-1', targetCode: 'P4.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require data used only for specified purpose (P4 use, retention, disposal)', automatable: false },
  { sourceCode: 'GDPR-Art-5-1', targetCode: 'P2.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Transparency principle maps directly to P2 notice requirements', automatable: false },

  // Art. 6-7 Lawful Basis / Consent ↔ P2/P3
  { sourceCode: 'GDPR-Art-6-1', targetCode: 'P2.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require communicating the basis for collecting and using personal information', automatable: false },
  { sourceCode: 'GDPR-Art-7-1', targetCode: 'P3.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Consent requirement for collection maps to P3.2 implicit/explicit consent in collection', automatable: false },

  // Art. 15-22 Data Subject Rights ↔ P6 Access
  { sourceCode: 'GDPR-Art-15-1', targetCode: 'P6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Right of access maps to P6.1 access to personal information', automatable: false },
  { sourceCode: 'GDPR-Art-16-1', targetCode: 'P6.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Right to rectification maps to P6.2 correction of personal information', automatable: false },
  { sourceCode: 'GDPR-Art-17-1', targetCode: 'P4.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Right to erasure maps to P4.3 disposal of personal information', automatable: false },

  // Art. 24-25 Controller obligations / Privacy by Design ↔ CC5/P1
  { sourceCode: 'GDPR-Art-24-1', targetCode: 'CC5.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require selecting and implementing controls to address risks', automatable: false },
  { sourceCode: 'GDPR-Art-25-1', targetCode: 'P1.1',  mappingType: 'equivalent', confidence: 'high', rationale: 'Privacy by design aligns with P1.1 privacy policies and practices', automatable: false },

  // Art. 28 Processor agreements ↔ CC9.2
  { sourceCode: 'GDPR-Art-28-1', targetCode: 'CC9.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require vendor/processor agreements with security requirements', automatable: true },

  // Art. 32 Security ↔ CC6
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'CC6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Technical security measures for personal data map to logical access security controls', automatable: true },
  { sourceCode: 'GDPR-Art-32-1', targetCode: 'CC7.1', mappingType: 'partial',    confidence: 'high', rationale: 'Both require ongoing monitoring and identification of security vulnerabilities', automatable: true },

  // Art. 33-34 Breach Notification ↔ CC7.3-CC7.4
  { sourceCode: 'GDPR-Art-33-1', targetCode: 'CC7.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require timely response and notification for security incidents/breaches', automatable: true },
  { sourceCode: 'GDPR-Art-33-1', targetCode: 'CC7.4', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require incident management planning covering notification obligations', automatable: true },
  { sourceCode: 'GDPR-Art-34-1', targetCode: 'P8.1',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require notification to affected individuals in the event of a breach', automatable: false },

  // Art. 35 DPIA ↔ CC3 Risk Assessment
  { sourceCode: 'GDPR-Art-35-1', targetCode: 'CC3.1', mappingType: 'equivalent', confidence: 'high', rationale: 'DPIA process aligns with risk identification and assessment requirements', automatable: false },

  // Art. 5-2 Accountability ↔ P1
  { sourceCode: 'GDPR-Art-5-2', targetCode: 'P1.1',   mappingType: 'equivalent', confidence: 'high', rationale: 'Accountability principle maps to demonstrated privacy programme management', automatable: false },
];

// ── HIPAA ↔ ISO 27001:2022 crosswalk mappings ────────────────────────────────
const HIPAA_ISO_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // §164.308(a)(1) Security Management Process ↔ A.5.7-A.5.8
  { sourceCode: 'HIPAA-308-a-1-i',  targetCode: 'A.5.7', mappingType: 'equivalent', confidence: 'high', rationale: 'HIPAA risk analysis maps to ISO threat intelligence and risk identification', automatable: false },
  { sourceCode: 'HIPAA-308-a-1-i',  targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require systematic IS risk assessment with documented methodology', automatable: false },
  { sourceCode: 'HIPAA-308-a-1-ii', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Risk management plan aligns with IS risk treatment and residual risk acceptance', automatable: false },
  { sourceCode: 'HIPAA-308-a-1-iv', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Information system activity review maps to monitoring of system activities', automatable: true },

  // §164.308(a)(3) Workforce Security ↔ A.6 People Controls
  { sourceCode: 'HIPAA-308-a-3-i',  targetCode: 'A.6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require authorisation and supervision for workforce member access', automatable: false },
  { sourceCode: 'HIPAA-308-a-3-ii', targetCode: 'A.6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Workforce clearance procedure maps to pre-employment screening', automatable: false },
  { sourceCode: 'HIPAA-308-a-3-iii', targetCode: 'A.5.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Termination/transfer procedures map to asset return and access revocation', automatable: true },

  // §164.308(a)(4) Access Management ↔ A.5.15-A.5.18
  { sourceCode: 'HIPAA-308-a-4-i',   targetCode: 'A.5.15', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information access management based on need-to-know', automatable: true },
  { sourceCode: 'HIPAA-308-a-4-ii-a', targetCode: 'A.5.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Unique user identification maps to identity management controls', automatable: true },
  { sourceCode: 'HIPAA-308-a-4-ii-b', targetCode: 'A.5.18', mappingType: 'equivalent', confidence: 'high', rationale: 'Access authorisation maps to access rights management', automatable: true },

  // §164.308(a)(5) Security Awareness ↔ A.6.3
  { sourceCode: 'HIPAA-308-a-5-i',    targetCode: 'A.6.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require ongoing IS awareness and training programmes for all staff', automatable: true },
  { sourceCode: 'HIPAA-308-a-5-ii-a', targetCode: 'A.6.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Security reminders/training align with periodic IS awareness activities', automatable: true },

  // §164.308(a)(6) Security Incident Procedures ↔ A.5.24-A.5.28
  { sourceCode: 'HIPAA-308-a-6-i',   targetCode: 'A.5.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require documented incident response procedures', automatable: true },

  // §164.308(a)(7) Contingency Plan ↔ A.5.30, A.8.13-A.8.14
  { sourceCode: 'HIPAA-308-a-7-i',   targetCode: 'A.5.30', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require ICT/data availability planning for continuity', automatable: true },
  { sourceCode: 'HIPAA-308-a-7-ii',  targetCode: 'A.8.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information backup procedures and testing', automatable: true },
  { sourceCode: 'HIPAA-308-a-7-iv',  targetCode: 'A.8.14', mappingType: 'equivalent', confidence: 'high', rationale: 'Testing/revision plans align with redundancy requirements', automatable: false },

  // §164.310 Physical Safeguards ↔ A.7 Physical Controls
  { sourceCode: 'HIPAA-310-a-1',     targetCode: 'A.7.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require physical security perimeter controls for information systems', automatable: false },
  { sourceCode: 'HIPAA-310-b',       targetCode: 'A.7.7', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require clean desk/clear screen and workstation access controls', automatable: false },
  { sourceCode: 'HIPAA-310-c',       targetCode: 'A.7.10', mappingType: 'equivalent', confidence: 'high', rationale: 'Workstation use policies map to storage media and equipment controls', automatable: false },
  { sourceCode: 'HIPAA-310-d',       targetCode: 'A.5.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require secure disposal/re-use procedures for hardware containing sensitive data', automatable: false },

  // §164.312 Technical Safeguards ↔ A.8 Technological Controls
  { sourceCode: 'HIPAA-312-a-1',     targetCode: 'A.5.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require unique identifiers and authentication for access to ePHI/systems', automatable: true },
  { sourceCode: 'HIPAA-312-a-2-i',   targetCode: 'A.8.5',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require secure authentication before granting access', automatable: true },
  { sourceCode: 'HIPAA-312-a-2-iii', targetCode: 'A.8.15', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require logging of access to systems and data (audit logs)', automatable: true },
  { sourceCode: 'HIPAA-312-a-2-iv',  targetCode: 'A.8.3',  mappingType: 'equivalent', confidence: 'high', rationale: 'Automatic logoff aligns with information access restriction controls', automatable: true },
  { sourceCode: 'HIPAA-312-b',       targetCode: 'A.8.15', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require audit controls / logging of activity on systems containing sensitive data', automatable: true },
  { sourceCode: 'HIPAA-312-c-1',     targetCode: 'A.8.11', mappingType: 'partial',    confidence: 'high', rationale: 'ePHI integrity controls partially map to data masking/protection', automatable: false },
  { sourceCode: 'HIPAA-312-d',       targetCode: 'A.8.5',  mappingType: 'equivalent', confidence: 'high', rationale: 'Person/entity authentication maps to secure authentication controls', automatable: true },
  { sourceCode: 'HIPAA-312-e-1',     targetCode: 'A.8.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Transmission security encryption maps to cryptography controls', automatable: true },
  { sourceCode: 'HIPAA-312-e-2',     targetCode: 'A.8.20', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require network security controls for data in transit', automatable: true },

  // §164.314 Organisational Requirements ↔ A.5.19
  { sourceCode: 'HIPAA-314-a-1',     targetCode: 'A.5.19', mappingType: 'equivalent', confidence: 'high', rationale: 'Business associate agreements map to information security in supplier relationships', automatable: true },
  { sourceCode: 'HIPAA-314-b-1',     targetCode: 'A.5.20', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require security requirements in ICT/BA agreements', automatable: true },

  // §164.316 Policies & Procedures ↔ A.5.1
  { sourceCode: 'HIPAA-316-a',       targetCode: 'A.5.1',  mappingType: 'equivalent', confidence: 'high', rationale: 'Both require documented IS policies and procedures', automatable: true },
  { sourceCode: 'HIPAA-316-b-1',     targetCode: 'A.5.37', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require documented operating procedures accessible to relevant staff', automatable: false },
];

// ── HIPAA ↔ SOC 2 crosswalk mappings ─────────────────────────────────────────
const HIPAA_SOC2_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // §164.308 Administrative Safeguards ↔ SOC 2 TSC
  { sourceCode: 'HIPAA-308-a-1-i',   targetCode: 'CC1.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'HIPAA security officer requirement maps to SOC2 security role and responsibility assignment', automatable: true },
  { sourceCode: 'HIPAA-308-a-1-ii',  targetCode: 'CC3.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'HIPAA risk analysis maps to SOC2 risk identification and assessment process', automatable: true },
  { sourceCode: 'HIPAA-308-a-1-iii', targetCode: 'CC3.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'HIPAA risk management maps to SOC2 risk management and treatment', automatable: true },
  { sourceCode: 'HIPAA-308-a-1-iv',  targetCode: 'CC1.4', mappingType: 'equivalent', confidence: 'high',   rationale: 'HIPAA sanction policy maps to SOC2 personnel responsibility and accountability', automatable: true },
  { sourceCode: 'HIPAA-308-a-2',     targetCode: 'CC1.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'Both require an assigned individual responsible for information security', automatable: true },
  { sourceCode: 'HIPAA-308-a-3-i',   targetCode: 'CC6.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'Workforce access authorization maps to logical access security controls', automatable: true },
  { sourceCode: 'HIPAA-308-a-3-ii',  targetCode: 'CC1.4', mappingType: 'equivalent', confidence: 'high',   rationale: 'Workforce clearance procedures map to personnel screening and background checks', automatable: true },
  { sourceCode: 'HIPAA-308-a-4-i',   targetCode: 'CC6.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'Access authorization policies map to logical access security requirements', automatable: true },
  { sourceCode: 'HIPAA-308-a-4-ii-a', targetCode: 'CC6.3', mappingType: 'equivalent', confidence: 'high',  rationale: 'Access establishment and modification maps to access provisioning and de-provisioning', automatable: true },
  { sourceCode: 'HIPAA-308-a-5-i',   targetCode: 'CC6.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'Password management maps to SOC2 authentication control requirements', automatable: true },
  { sourceCode: 'HIPAA-308-a-5-ii-a', targetCode: 'CC6.2', mappingType: 'partial',   confidence: 'high',  rationale: 'Log-in monitoring maps to SOC2 logical access monitoring', automatable: true },
  { sourceCode: 'HIPAA-308-a-6-i',   targetCode: 'CC7.3', mappingType: 'equivalent', confidence: 'high',   rationale: 'Security incident procedures map directly to SOC2 incident response processes', automatable: true },
  { sourceCode: 'HIPAA-308-a-7-i',   targetCode: 'A1.2',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Contingency plan maps to SOC2 availability criteria environmental protection', automatable: true },
  { sourceCode: 'HIPAA-308-a-7-ii',  targetCode: 'A1.3',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Disaster recovery plan maps to SOC2 availability recovery procedures', automatable: true },
  { sourceCode: 'HIPAA-308-a-7-iv',  targetCode: 'A1.2',  mappingType: 'partial',    confidence: 'medium', rationale: 'Testing and revision of contingency plan partially maps to SOC2 availability testing', automatable: false },
  { sourceCode: 'HIPAA-308-a-8',     targetCode: 'CC4.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'Evaluation of safeguards maps to SOC2 ongoing monitoring and evaluation activities', automatable: true },
  { sourceCode: 'HIPAA-308-b-1',     targetCode: 'CC9.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'Business associate contracts map to SOC2 vendor and third-party management', automatable: true },

  // §164.310 Physical Safeguards ↔ SOC 2 CC6
  { sourceCode: 'HIPAA-310-a-1',     targetCode: 'CC6.4', mappingType: 'equivalent', confidence: 'high',   rationale: 'Facility access controls map to SOC2 physical access restrictions', automatable: true },
  { sourceCode: 'HIPAA-310-b',       targetCode: 'CC6.7', mappingType: 'partial',    confidence: 'medium', rationale: 'Workstation use policy partially maps to SOC2 data-in-motion and endpoint security', automatable: false },
  { sourceCode: 'HIPAA-310-d',       targetCode: 'CC6.5', mappingType: 'equivalent', confidence: 'high',   rationale: 'Device and media disposal maps to SOC2 secure disposal of media and equipment', automatable: true },

  // §164.312 Technical Safeguards ↔ SOC 2 CC6, CC7
  { sourceCode: 'HIPAA-312-a-1',     targetCode: 'CC6.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'Unique user identification maps to SOC2 logical access user identification requirements', automatable: true },
  { sourceCode: 'HIPAA-312-a-2-i',   targetCode: 'A1.2',  mappingType: 'partial',    confidence: 'medium', rationale: 'Emergency access procedures map to SOC2 availability — emergency access to critical systems', automatable: false },
  { sourceCode: 'HIPAA-312-a-2-iii', targetCode: 'CC6.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'Automatic logoff maps to SOC2 logical access session management controls', automatable: true },
  { sourceCode: 'HIPAA-312-b',       targetCode: 'CC7.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'Audit controls / logging maps to SOC2 system monitoring and anomaly detection', automatable: true },
  { sourceCode: 'HIPAA-312-c-1',     targetCode: 'CC7.1', mappingType: 'equivalent', confidence: 'high',   rationale: 'ePHI integrity controls map to SOC2 system integrity monitoring', automatable: true },
  { sourceCode: 'HIPAA-312-e-1',     targetCode: 'CC6.7', mappingType: 'equivalent', confidence: 'high',   rationale: 'Transmission security encryption maps to SOC2 transmission protection controls', automatable: true },

  // §164.314 Organizational Requirements ↔ SOC 2 CC9
  { sourceCode: 'HIPAA-314-a-1',     targetCode: 'CC9.2', mappingType: 'equivalent', confidence: 'high',   rationale: 'Business associate agreements map to SOC2 vendor risk management requirements', automatable: true },
];

// ── PCI-DSS v4.0 ↔ ISO 27001:2022 crosswalk mappings ─────────────────────────
const PCI_ISO_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // Req 1 — Network Security Controls
  { sourceCode: 'PCI-1.1', targetCode: 'A.8.20', mappingType: 'equivalent', confidence: 'high',   rationale: 'Network security controls policy maps to ISO network security management', automatable: true },
  { sourceCode: 'PCI-1.2', targetCode: 'A.8.21', mappingType: 'equivalent', confidence: 'high',   rationale: 'Restricting inbound/outbound traffic maps to security of network services', automatable: true },
  { sourceCode: 'PCI-1.3', targetCode: 'A.8.20', mappingType: 'partial',    confidence: 'high',   rationale: 'Network access between trusted and untrusted zones maps to network security', automatable: false },
  { sourceCode: 'PCI-1.4', targetCode: 'A.8.20', mappingType: 'partial',    confidence: 'medium', rationale: 'Network security controls for mobile/BYOD map to network security policies', automatable: false },

  // Req 2 — Secure Configurations
  { sourceCode: 'PCI-2.1', targetCode: 'A.8.9',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Changing vendor defaults maps to configuration management requirements', automatable: true },
  { sourceCode: 'PCI-2.2', targetCode: 'A.8.9',  mappingType: 'equivalent', confidence: 'high',   rationale: 'System configuration standards map to configuration management', automatable: true },
  { sourceCode: 'PCI-2.3', targetCode: 'A.7.7',  mappingType: 'partial',    confidence: 'medium', rationale: 'Wireless environment security partially maps to clear desk/wireless protection', automatable: false },

  // Req 3 — Account Data Protection
  { sourceCode: 'PCI-3.1', targetCode: 'A.5.33', mappingType: 'equivalent', confidence: 'high',   rationale: 'Storing only necessary cardholder data maps to protection of records requirement', automatable: true },
  { sourceCode: 'PCI-3.3', targetCode: 'A.8.24', mappingType: 'equivalent', confidence: 'high',   rationale: 'Rendering PAN unreadable maps to use of cryptography controls', automatable: true },
  { sourceCode: 'PCI-3.4', targetCode: 'A.8.24', mappingType: 'partial',    confidence: 'high',   rationale: 'Hashing/truncation of stored PANs maps to cryptographic key management', automatable: false },

  // Req 4 — Data in Transit
  { sourceCode: 'PCI-4.1', targetCode: 'A.8.24', mappingType: 'equivalent', confidence: 'high',   rationale: 'Strong cryptography for data in transit maps to use of cryptography', automatable: true },
  { sourceCode: 'PCI-4.2', targetCode: 'A.8.24', mappingType: 'partial',    confidence: 'medium', rationale: 'Preventing unprotected PANs over end-user messaging maps to cryptography policy', automatable: false },

  // Req 5 — Malware Protection
  { sourceCode: 'PCI-5.1', targetCode: 'A.8.7',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Anti-malware protection maps directly to ISO protection against malware', automatable: true },
  { sourceCode: 'PCI-5.2', targetCode: 'A.8.7',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Malware mechanism management maps to malware protection controls', automatable: true },
  { sourceCode: 'PCI-5.3', targetCode: 'A.8.7',  mappingType: 'partial',    confidence: 'medium', rationale: 'Anti-malware solution evaluation maps to malware protection evaluation', automatable: false },

  // Req 6 — Vulnerability Management
  { sourceCode: 'PCI-6.1', targetCode: 'A.8.8',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Identifying and managing vulnerabilities maps to technical vulnerability management', automatable: true },
  { sourceCode: 'PCI-6.2', targetCode: 'A.8.25', mappingType: 'equivalent', confidence: 'high',   rationale: 'Developing software securely maps to secure development lifecycle', automatable: true },
  { sourceCode: 'PCI-6.3', targetCode: 'A.8.29', mappingType: 'equivalent', confidence: 'high',   rationale: 'Protecting web-facing applications maps to security testing in development', automatable: true },
  { sourceCode: 'PCI-6.4', targetCode: 'A.8.32', mappingType: 'equivalent', confidence: 'high',   rationale: 'Public-facing web application protection maps to change management procedures', automatable: false },
  { sourceCode: 'PCI-6.5', targetCode: 'A.8.8',  mappingType: 'partial',    confidence: 'medium', rationale: 'Changes to all system components maps to vulnerability management on changes', automatable: false },

  // Req 7 — Access Control
  { sourceCode: 'PCI-7.1', targetCode: 'A.8.2',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Limiting access to system components maps to privileged access rights management', automatable: true },
  { sourceCode: 'PCI-7.2', targetCode: 'A.8.3',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Assigning access based on need-to-know maps to information access restriction', automatable: true },
  { sourceCode: 'PCI-7.3', targetCode: 'A.5.18', mappingType: 'equivalent', confidence: 'high',   rationale: 'Securing all access to system components maps to access rights management', automatable: true },

  // Req 8 — Authentication
  { sourceCode: 'PCI-8.1', targetCode: 'A.5.16', mappingType: 'equivalent', confidence: 'high',   rationale: 'Defining and managing user IDs and credentials maps to identity management', automatable: true },
  { sourceCode: 'PCI-8.2', targetCode: 'A.8.5',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Using strong authentication maps to secure authentication controls', automatable: true },

  // Req 9 — Physical Security
  { sourceCode: 'PCI-9.1', targetCode: 'A.7.1',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Restricting physical access maps to ISO physical security perimeter controls', automatable: true },

  // Req 10 — Logging and Monitoring
  { sourceCode: 'PCI-10.1', targetCode: 'A.8.15', mappingType: 'equivalent', confidence: 'high',   rationale: 'Logging all user access to system components maps to ISO logging controls', automatable: true },
  { sourceCode: 'PCI-10.2', targetCode: 'A.8.15', mappingType: 'equivalent', confidence: 'high',   rationale: 'Implementing audit logs maps to ISO logging requirements', automatable: true },
  { sourceCode: 'PCI-10.3', targetCode: 'A.8.15', mappingType: 'equivalent', confidence: 'high',   rationale: 'Protecting audit logs maps to ISO log protection requirements', automatable: true },
  { sourceCode: 'PCI-10.4', targetCode: 'A.5.33', mappingType: 'partial',    confidence: 'high',   rationale: 'Retaining audit log history maps to ISO protection of records', automatable: false },
  { sourceCode: 'PCI-10.6', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high',   rationale: 'Reviewing security policies and operational procedures maps to monitoring activities', automatable: false },

  // Req 11 — System Testing
  { sourceCode: 'PCI-11.1', targetCode: 'A.8.8',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Testing security systems and networks maps to technical vulnerability management', automatable: true },
  { sourceCode: 'PCI-11.2', targetCode: 'A.8.8',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Quarterly vulnerability scans map to vulnerability monitoring and scanning', automatable: true },
  { sourceCode: 'PCI-11.3', targetCode: 'A.8.8',  mappingType: 'partial',    confidence: 'high',   rationale: 'External and internal penetration testing maps to technical vulnerability management', automatable: false },

  // Req 12 — Security Policy
  { sourceCode: 'PCI-12.1', targetCode: 'A.5.1',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Establishing a comprehensive security policy maps to ISO IS policies control', automatable: true },
  { sourceCode: 'PCI-12.2', targetCode: 'A.5.8',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Implementing a risk assessment process maps to IS in project management / risk treatment', automatable: true },
  { sourceCode: 'PCI-12.5', targetCode: 'A.5.1',  mappingType: 'partial',    confidence: 'medium', rationale: 'PCI DSS scope documentation maps to IS policy management', automatable: false },
  { sourceCode: 'PCI-12.6', targetCode: 'A.6.3',  mappingType: 'equivalent', confidence: 'high',   rationale: 'Security awareness program maps to information security awareness training', automatable: true },
  { sourceCode: 'PCI-12.8', targetCode: 'A.5.19', mappingType: 'equivalent', confidence: 'high',   rationale: 'Managing third-party service providers maps to IS in supplier relationships', automatable: true },
  { sourceCode: 'PCI-12.9', targetCode: 'A.5.22', mappingType: 'equivalent', confidence: 'high',   rationale: 'Additional service provider requirements map to monitoring of supplier services', automatable: true },
];

// ── FedRAMP (NIST SP 800-53) ↔ NIST CSF 2.0 crosswalk mappings ───────────────
const FEDRAMP_NIST_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // AC — Access Control ↔ PR.AA (Protect: Identity Management, Authentication)
  { sourceCode: 'AC-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Access control policy maps to CSF organizational policies and procedures', automatable: true },
  { sourceCode: 'AC-2',  targetCode: 'PR.AA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Account management maps directly to CSF identity management subcategory', automatable: true },
  { sourceCode: 'AC-3',  targetCode: 'PR.AA-05', mappingType: 'equivalent', confidence: 'high',   rationale: 'Access enforcement maps to CSF access permissions and authorizations', automatable: true },
  { sourceCode: 'AC-6',  targetCode: 'PR.AA-05', mappingType: 'equivalent', confidence: 'high',   rationale: 'Least privilege maps to CSF access permissions based on need', automatable: true },
  { sourceCode: 'AC-7',  targetCode: 'PR.AA-02', mappingType: 'partial',    confidence: 'high',   rationale: 'Unsuccessful logon attempts control maps to CSF authentication management', automatable: true },
  { sourceCode: 'AC-11', targetCode: 'PR.AA-05', mappingType: 'partial',    confidence: 'medium', rationale: 'Session lock maps to CSF access permissions and session management', automatable: false },
  { sourceCode: 'AC-17', targetCode: 'PR.AA-05', mappingType: 'partial',    confidence: 'high',   rationale: 'Remote access maps to CSF access permissions for remote connections', automatable: true },
  { sourceCode: 'AC-22', targetCode: 'PR.AT-01', mappingType: 'related',    confidence: 'medium', rationale: 'Publicly accessible content policies relate to CSF workforce awareness', automatable: false },

  // AU — Audit and Accountability ↔ DE.CM (Detect: Continuous Monitoring)
  { sourceCode: 'AU-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Audit and accountability policy maps to CSF governance policy controls', automatable: true },
  { sourceCode: 'AU-2',  targetCode: 'DE.CM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Event logging maps directly to CSF networks and environments monitoring', automatable: true },
  { sourceCode: 'AU-3',  targetCode: 'DE.CM-03', mappingType: 'equivalent', confidence: 'high',   rationale: 'Audit record content maps to CSF monitoring of personnel activity', automatable: true },
  { sourceCode: 'AU-6',  targetCode: 'DE.AE-06', mappingType: 'equivalent', confidence: 'high',   rationale: 'Audit record review maps to CSF cybersecurity alerts evaluation', automatable: true },
  { sourceCode: 'AU-9',  targetCode: 'PR.DS-01', mappingType: 'partial',    confidence: 'high',   rationale: 'Audit record protection maps to CSF protection of data at rest', automatable: true },
  { sourceCode: 'AU-12', targetCode: 'DE.CM-09', mappingType: 'equivalent', confidence: 'high',   rationale: 'Audit record generation maps to CSF monitoring of computing hardware/software', automatable: true },

  // CA — Assessment, Authorization, Monitoring ↔ GV, ID
  { sourceCode: 'CA-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Assessment and authorization policy maps to CSF governance policy controls', automatable: true },
  { sourceCode: 'CA-2',  targetCode: 'ID.IM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Control assessments map to CSF improvements identified from evaluations', automatable: false },
  { sourceCode: 'CA-3',  targetCode: 'GV.SC-01', mappingType: 'partial',    confidence: 'high',   rationale: 'Information exchange maps to CSF supply chain risk management', automatable: false },
  { sourceCode: 'CA-5',  targetCode: 'ID.IM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Plan of action and milestones maps to CSF improvement identification', automatable: false },
  { sourceCode: 'CA-7',  targetCode: 'DE.CM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Continuous monitoring maps directly to CSF continuous monitoring subcategory', automatable: true },

  // CM — Configuration Management ↔ ID.AM, PR.PS
  { sourceCode: 'CM-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Configuration management policy maps to CSF governance policy controls', automatable: true },
  { sourceCode: 'CM-2',  targetCode: 'ID.AM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Baseline configuration maps to CSF hardware inventory maintenance', automatable: true },
  { sourceCode: 'CM-6',  targetCode: 'PR.PS-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Configuration settings maps directly to CSF configuration management practices', automatable: true },
  { sourceCode: 'CM-7',  targetCode: 'PR.PS-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Least functionality maps to CSF configuration management and hardening', automatable: true },
  { sourceCode: 'CM-8',  targetCode: 'ID.AM-02', mappingType: 'equivalent', confidence: 'high',   rationale: 'System component inventory maps to CSF software and platform inventory', automatable: true },

  // IA — Identification and Authentication ↔ PR.AA
  { sourceCode: 'IA-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Identification and authentication policy maps to CSF governance policy', automatable: true },
  { sourceCode: 'IA-2',  targetCode: 'PR.AA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'User identification and authentication maps to CSF identity management', automatable: true },
  { sourceCode: 'IA-3',  targetCode: 'PR.AA-01', mappingType: 'partial',    confidence: 'high',   rationale: 'Device identification maps to CSF identity management for devices', automatable: true },
  { sourceCode: 'IA-5',  targetCode: 'PR.AA-02', mappingType: 'equivalent', confidence: 'high',   rationale: 'Authenticator management maps directly to CSF authentication management', automatable: true },
  { sourceCode: 'IA-8',  targetCode: 'PR.AA-01', mappingType: 'partial',    confidence: 'high',   rationale: 'Non-organizational user identification maps to identity management practices', automatable: true },

  // IR — Incident Response ↔ RS (Respond)
  { sourceCode: 'IR-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Incident response policy maps to CSF governance policies', automatable: true },
  { sourceCode: 'IR-4',  targetCode: 'RS.MA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Incident handling maps directly to CSF incident management subcategory', automatable: true },
  { sourceCode: 'IR-5',  targetCode: 'DE.AE-06', mappingType: 'equivalent', confidence: 'high',   rationale: 'Incident monitoring maps to CSF evaluation of cybersecurity alerts', automatable: true },
  { sourceCode: 'IR-6',  targetCode: 'RS.CO-02', mappingType: 'equivalent', confidence: 'high',   rationale: 'Incident reporting maps to CSF incident response reporting', automatable: true },
  { sourceCode: 'IR-8',  targetCode: 'RS.MA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Incident response plan maps to CSF incident management planning', automatable: false },

  // PL — Planning ↔ GV
  { sourceCode: 'PL-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Security planning policy maps to CSF governance and policy control', automatable: true },
  { sourceCode: 'PL-2',  targetCode: 'GV.PO-02', mappingType: 'equivalent', confidence: 'high',   rationale: 'System security plan maps to CSF IS responsibilities and accountability', automatable: false },

  // RA — Risk Assessment ↔ ID.RA (Identify: Risk Assessment)
  { sourceCode: 'RA-1',  targetCode: 'GV.RM-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Risk assessment policy maps to CSF risk management strategy', automatable: true },
  { sourceCode: 'RA-3',  targetCode: 'ID.RA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Risk assessment maps directly to CSF vulnerability identification', automatable: true },
  { sourceCode: 'RA-5',  targetCode: 'ID.RA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Vulnerability monitoring maps to CSF vulnerability identification and documentation', automatable: true },

  // SA — System and Services Acquisition ↔ GV.SC
  { sourceCode: 'SA-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'System and services acquisition policy maps to CSF governance policy', automatable: true },
  { sourceCode: 'SA-9',  targetCode: 'GV.SC-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'External system services maps to CSF supply chain risk management', automatable: true },

  // SC — System and Communications Protection ↔ PR.DS, PR.IR
  { sourceCode: 'SC-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'System and communications protection policy maps to CSF governance', automatable: true },
  { sourceCode: 'SC-7',  targetCode: 'PR.IR-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Boundary protection maps to CSF networks and environments protected subcategory', automatable: true },
  { sourceCode: 'SC-8',  targetCode: 'PR.DS-02', mappingType: 'equivalent', confidence: 'high',   rationale: 'Transmission confidentiality maps to CSF data in transit protection', automatable: true },
  { sourceCode: 'SC-12', targetCode: 'PR.DS-01', mappingType: 'partial',    confidence: 'high',   rationale: 'Cryptographic key management maps to CSF data at rest protection', automatable: true },
  { sourceCode: 'SC-28', targetCode: 'PR.DS-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Protection of information at rest maps directly to CSF data at rest protection', automatable: true },

  // SI — System and Information Integrity ↔ DE.CM, ID.RA
  { sourceCode: 'SI-1',  targetCode: 'GV.PO-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'System and information integrity policy maps to CSF governance policy', automatable: true },
  { sourceCode: 'SI-2',  targetCode: 'ID.RA-01', mappingType: 'equivalent', confidence: 'high',   rationale: 'Flaw remediation maps to CSF vulnerability identification and remediation', automatable: true },
  { sourceCode: 'SI-3',  targetCode: 'DE.CM-09', mappingType: 'equivalent', confidence: 'high',   rationale: 'Malicious code protection maps to CSF monitoring of computing hardware/software', automatable: true },
];

@Injectable()
export class CrosswalkService implements OnModuleInit {
  private readonly logger = new Logger(CrosswalkService.name);

  constructor(
    private readonly library: ControlLibraryService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Seed crosswalks using direct DB lookups (not in-memory map) to avoid
    // initialization ordering race conditions.
    try {
      await this.seedCrosswalksFromDb();
    } catch (err) {
      this.logger.warn('Crosswalk seeding failed:', err.message);
    }
  }

  /**
   * Seeds crosswalk mappings by looking up control IDs directly from the DB.
   * This avoids the race condition where the in-memory map might not be ready.
   */
  private async seedCrosswalksFromDb(): Promise<void> {
    // Combine all crosswalk sets into one seeding pass
    const ALL_CROSSWALKS = [
      ...SOC2_ISO_CROSSWALKS,
      ...GDPR_ISO_CROSSWALKS,
      ...GDPR_SOC2_CROSSWALKS,
      ...HIPAA_ISO_CROSSWALKS,
      ...HIPAA_SOC2_CROSSWALKS,
      ...PCI_ISO_CROSSWALKS,
      ...FEDRAMP_NIST_CROSSWALKS,
    ];

    // Load all needed control codes in one query
    const allCodes = [
      ...new Set([
        ...ALL_CROSSWALKS.map((m) => m.sourceCode),
        ...ALL_CROSSWALKS.map((m) => m.targetCode),
      ]),
    ];

    const controls = await this.prisma.control.findMany({
      where: { code: { in: allCodes } },
      select: { id: true, code: true },
    });

    if (controls.length === 0) {
      this.logger.warn('Crosswalk seeding skipped — no controls found in DB yet');
      return;
    }

    const codeToId = new Map(controls.map((c) => [c.code, c.id]));
    let seeded = 0;
    let skipped = 0;

    for (const m of ALL_CROSSWALKS) {
      const sourceId = codeToId.get(m.sourceCode);
      const targetId = codeToId.get(m.targetCode);
      if (!sourceId || !targetId) {
        skipped++;
        continue;
      }

      await this.prisma.frameworkCrosswalk.upsert({
        where: { sourceControlId_targetControlId: { sourceControlId: sourceId, targetControlId: targetId } },
        create: {
          sourceControlId: sourceId,
          targetControlId: targetId,
          mappingType: m.mappingType,
          confidence: m.confidence,
          rationale: m.rationale ?? null,
          automatable: m.automatable ?? false,
        },
        update: {
          mappingType: m.mappingType,
          confidence: m.confidence,
          rationale: m.rationale ?? null,
          automatable: m.automatable ?? false,
        },
      });
      seeded++;
    }

    this.logger.log(`Crosswalk seeding: ${seeded} upserted, ${skipped} skipped (missing codes)`);
  }

  /**
   * Get cross-framework mappings for a given control code.
   */
  async getMappingsForCode(controlCode: string) {
    const control = await this.library.getControlByCode(controlCode);
    if (!control) return [];
    return this.library.getCrosswalks(control.id);
  }

  /**
   * For a set of SOC2 control codes, return the ISO27001 equivalents.
   */
  getSoc2ToIsoMappings(soc2Codes: string[]): Array<{ soc2: string; iso: string; type: string }> {
    return SOC2_ISO_CROSSWALKS.filter((m) => soc2Codes.includes(m.sourceCode)).map((m) => ({
      soc2: m.sourceCode,
      iso: m.targetCode,
      type: m.mappingType,
    }));
  }

  /**
   * For a set of ISO27001 codes, return the SOC2 equivalents.
   */
  getIsoToSoc2Mappings(isoCodes: string[]): Array<{ iso: string; soc2: string; type: string }> {
    return SOC2_ISO_CROSSWALKS.filter((m) => isoCodes.includes(m.targetCode)).map((m) => ({
      iso: m.targetCode,
      soc2: m.sourceCode,
      type: m.mappingType,
    }));
  }

  /**
   * Return all GDPR ↔ ISO 27001 mappings.
   */
  getGdprToIsoMappings(): Array<{ gdpr: string; iso: string; type: string; confidence: string }> {
    return GDPR_ISO_CROSSWALKS.map((m) => ({
      gdpr: m.sourceCode,
      iso: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return all GDPR ↔ SOC 2 mappings.
   */
  getGdprToSoc2Mappings(): Array<{ gdpr: string; soc2: string; type: string; confidence: string }> {
    return GDPR_SOC2_CROSSWALKS.map((m) => ({
      gdpr: m.sourceCode,
      soc2: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return all HIPAA ↔ ISO 27001 mappings.
   */
  getHipaaToIsoMappings(): Array<{ hipaa: string; iso: string; type: string; confidence: string }> {
    return HIPAA_ISO_CROSSWALKS.map((m) => ({
      hipaa: m.sourceCode,
      iso: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return all HIPAA ↔ SOC 2 mappings.
   */
  getHipaaToSoc2Mappings(): Array<{ hipaa: string; soc2: string; type: string; confidence: string }> {
    return HIPAA_SOC2_CROSSWALKS.map((m) => ({
      hipaa: m.sourceCode,
      soc2: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return all PCI-DSS ↔ ISO 27001 mappings.
   */
  getPciToIsoMappings(): Array<{ pci: string; iso: string; type: string; confidence: string }> {
    return PCI_ISO_CROSSWALKS.map((m) => ({
      pci: m.sourceCode,
      iso: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return all FedRAMP ↔ NIST CSF 2.0 mappings.
   */
  getFedrampToNistMappings(): Array<{ fedramp: string; nist: string; type: string; confidence: string }> {
    return FEDRAMP_NIST_CROSSWALKS.map((m) => ({
      fedramp: m.sourceCode,
      nist: m.targetCode,
      type: m.mappingType,
      confidence: m.confidence,
    }));
  }

  /**
   * Return summary stats for all crosswalk sets.
   */
  getCrosswalkStats(): {
    soc2Iso: number;
    gdprIso: number;
    gdprSoc2: number;
    hipaaIso: number;
    hipaaSoc2: number;
    pciIso: number;
    fedrampNist: number;
    total: number;
  } {
    return {
      soc2Iso:     SOC2_ISO_CROSSWALKS.length,
      gdprIso:     GDPR_ISO_CROSSWALKS.length,
      gdprSoc2:    GDPR_SOC2_CROSSWALKS.length,
      hipaaIso:    HIPAA_ISO_CROSSWALKS.length,
      hipaaSoc2:   HIPAA_SOC2_CROSSWALKS.length,
      pciIso:      PCI_ISO_CROSSWALKS.length,
      fedrampNist: FEDRAMP_NIST_CROSSWALKS.length,
      total: SOC2_ISO_CROSSWALKS.length + GDPR_ISO_CROSSWALKS.length
           + GDPR_SOC2_CROSSWALKS.length + HIPAA_ISO_CROSSWALKS.length
           + HIPAA_SOC2_CROSSWALKS.length + PCI_ISO_CROSSWALKS.length
           + FEDRAMP_NIST_CROSSWALKS.length,
    };
  }
}
