/**
 * GDPR (General Data Protection Regulation) — Seed Data
 * Source: Regulation (EU) 2016/679 (paraphrased for automated use)
 * Confidence: high
 *
 * Covers: Articles 5–7, 9, 12–13, 15–18, 20–22, 24–25, 28–30, 32–35, 37, 39, 44, 46, 49, 83
 */

import { ControlSeedRecord } from './soc2-controls.seed';

export const GDPR_DOMAINS = [
  { code: 'Principles',          name: 'Principles of Processing',        sortOrder: 1 },
  { code: 'DSR',                 name: 'Data Subject Rights',             sortOrder: 2 },
  { code: 'ControllerObl',       name: 'Controller Obligations',          sortOrder: 3 },
  { code: 'ProcessorRel',        name: 'Processor Relations',             sortOrder: 4 },
  { code: 'Security',            name: 'Security of Processing',          sortOrder: 5 },
  { code: 'BreachNotification',  name: 'Breach Notification',             sortOrder: 6 },
  { code: 'DPIA',                name: 'Data Protection Impact Assessment', sortOrder: 7 },
  { code: 'DPO',                 name: 'Data Protection Officer',         sortOrder: 8 },
  { code: 'IntlTransfers',       name: 'International Transfers',         sortOrder: 9 },
  { code: 'Enforcement',         name: 'Enforcement',                     sortOrder: 10 },
];

export const GDPR_CONTROLS: ControlSeedRecord[] = [
  // ── Principles ───────────────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-5-1',
    title: 'Principles of Processing (Lawfulness, Fairness, Transparency)',
    description:
      'Personal data must be processed lawfully, fairly, and in a transparent manner in relation to the data subject. Data must be collected for specified, explicit, and legitimate purposes and not further processed in a manner incompatible with those purposes. Data must be adequate, relevant, and limited to what is necessary (data minimisation), accurate, and kept in a form that permits identification no longer than necessary.',
    category: 'Principles',
    domain: 'Principles',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',       description: 'Data processing principles policy or data governance policy', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',       description: 'Data retention schedule demonstrating purpose limitation and storage limitation', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'attestation',      description: 'Management attestation confirming data minimisation practices', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Data Protection Policy',  description: 'Articulates all six processing principles and how the organisation upholds them' },
      { policyName: 'Data Retention Policy',   description: 'Defines retention periods per data category aligned to purpose limitation' },
    ],
  },
  {
    code: 'GDPR-Art-5-2',
    title: 'Accountability Principle',
    description:
      'The controller is responsible for, and must be able to demonstrate compliance with, the principles of processing set out in Article 5(1). Demonstrating accountability requires documented policies, procedures, training records, and technical and organisational measures proportionate to processing risks.',
    category: 'Principles',
    domain: 'Principles',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',       description: 'Data protection accountability framework or programme documentation', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record',  description: 'Staff data protection training completion records', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',     description: 'Internal or external GDPR compliance audit report', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Data Protection Policy', description: 'Top-level policy signed by senior management demonstrating accountability' },
    ],
  },

  // ── Controller Obligations — Lawful Basis & Consent ──────────────────────────
  {
    code: 'GDPR-Art-6-1',
    title: 'Lawful Basis for Processing',
    description:
      'Processing of personal data is only lawful if at least one of the six legal bases applies: consent of the data subject, performance of a contract, compliance with a legal obligation, protection of vital interests, public task, or legitimate interests of the controller or a third party (unless overridden by data subject interests).',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Legal basis register or data inventory mapping each processing activity to a lawful basis', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',  description: 'Legitimate Interests Assessment (LIA) where LI is relied upon', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Data Processing Register', description: 'Documents lawful basis for each processing activity' },
    ],
  },
  {
    code: 'GDPR-Art-7-1',
    title: 'Conditions for Consent',
    description:
      'Where processing is based on consent, the controller must be able to demonstrate that the data subject has consented. Consent must be freely given, specific, informed, and unambiguous indication of the data subject\'s wishes. Consent must be as easy to withdraw as to give, and pre-ticked boxes or silence do not constitute valid consent.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Consent management procedure and consent request templates', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Consent management platform or database showing timestamped consent records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Consent Management Policy', description: 'Defines how consent is obtained, recorded, and withdrawn' },
    ],
  },
  {
    code: 'GDPR-Art-9-1',
    title: 'Processing Special Categories of Personal Data',
    description:
      'Processing of special categories of personal data (revealing racial or ethnic origin, political opinions, religious or philosophical beliefs, trade union membership, genetic data, biometric data for unique identification, health data, sex life or sexual orientation data) is prohibited unless an explicit exception under Article 9(2) applies, such as explicit consent or substantial public interest.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Special categories policy identifying processing activities and the Article 9(2) exception relied upon', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',    description: 'Data Protection Impact Assessment where special categories are processed at scale', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Special Categories Data Policy', description: 'Governs lawful handling of Article 9 sensitive personal data' },
    ],
  },

  // ── Transparency & Privacy Notices ───────────────────────────────────────────
  {
    code: 'GDPR-Art-12-1',
    title: 'Transparent Communication to Data Subjects',
    description:
      'The controller must take appropriate measures to provide any information and communication relating to processing to data subjects in a concise, transparent, intelligible, and easily accessible form, using clear and plain language. Information must be provided in writing, or by other means, including electronically where appropriate.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Privacy notice readability assessment or plain-language review', isMandatory: false },
      { evidenceType: 'config_screenshot', description: 'Evidence of accessible privacy notice on website or application', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Privacy Notice Policy', description: 'Defines requirements for clarity and accessibility of data subject communications' },
    ],
  },
  {
    code: 'GDPR-Art-13-1',
    title: 'Privacy Notice at Collection',
    description:
      'Where personal data are collected directly from the data subject, the controller must provide: identity and contact details of the controller, contact details of the DPO (if applicable), purposes and legal basis for processing, legitimate interests pursued (if applicable), recipients, international transfer details, retention periods, and data subject rights — at the time the data are collected.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Published privacy notice covering all Article 13 mandatory elements', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Screenshot of privacy notice presented at point of data collection', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Privacy Notice', description: 'Meets all Article 13 disclosure requirements' },
    ],
  },

  // ── Data Subject Rights ───────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-15-1',
    title: 'Right of Access',
    description:
      'Data subjects have the right to obtain from the controller confirmation as to whether personal data concerning them are being processed and, where that is the case, access to the personal data and supplementary information. Responses must be provided within one month of receipt of the request, extensible by two further months where requests are complex or numerous.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Data subject access request (DSAR) procedure documenting intake, verification, and fulfilment steps', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'DSAR log showing request receipt dates and response dates within legal deadlines', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Covers all rights under Chapter III including right of access' },
    ],
  },
  {
    code: 'GDPR-Art-16-1',
    title: 'Right to Rectification',
    description:
      'Data subjects have the right to obtain from the controller, without undue delay, the rectification of inaccurate personal data. Taking into account the purposes of the processing, the data subject shall have the right to have incomplete personal data completed, including by means of providing a supplementary statement.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Rectification request procedure and data quality correction workflow', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Log of rectification requests received and actions taken', isMandatory: false, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Includes rectification process with response timelines' },
    ],
  },
  {
    code: 'GDPR-Art-17-1',
    title: 'Right to Erasure (Right to be Forgotten)',
    description:
      'Data subjects have the right to obtain from the controller the erasure of personal data without undue delay where: data are no longer necessary for the purpose collected, consent is withdrawn, data subject objects and there are no overriding legitimate grounds, data were processed unlawfully, erasure is required by law, or data relate to a child. The controller must communicate erasure to recipients unless disproportionate.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Erasure request procedure including technical deletion and backup handling', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Erasure request log with confirmation of deletion or documented legal exception', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Erasure process with downstream notification to processors and recipients' },
      { policyName: 'Data Retention Policy',          description: 'Retention exceptions that may override erasure requests' },
    ],
  },
  {
    code: 'GDPR-Art-18-1',
    title: 'Right to Restriction of Processing',
    description:
      'Data subjects have the right to obtain from the controller restriction of processing where: accuracy of data is contested, processing is unlawful but the data subject opposes erasure, the controller no longer needs the data but the data subject requires it for legal claims, or the data subject has objected to processing pending verification of legitimate grounds.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Restriction of processing procedure including technical controls to halt processing', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Evidence of technical mechanism to flag and restrict processing of specific records', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Restriction workflow including notification when restriction is lifted' },
    ],
  },
  {
    code: 'GDPR-Art-20-1',
    title: 'Right to Data Portability',
    description:
      'Data subjects have the right to receive personal data they have provided to a controller in a structured, commonly used, and machine-readable format, and to transmit that data to another controller, where processing is based on consent or contract and carried out by automated means. This includes the right to have data transmitted directly between controllers where technically feasible.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Data portability procedure specifying supported formats (e.g., CSV, JSON) and delivery mechanism', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Evidence of data export capability in the system or application', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Portability process covering format, timing, and secure delivery of data exports' },
    ],
  },
  {
    code: 'GDPR-Art-21-1',
    title: 'Right to Object',
    description:
      'Data subjects have the right to object, on grounds relating to their particular situation, at any time to processing of personal data concerning them based on legitimate interests or public task, including profiling. The controller must cease processing unless it demonstrates compelling legitimate grounds that override the interests of the data subject or for legal claims.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Objection handling procedure including assessment of compelling legitimate grounds', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Log of objection requests with documented outcomes', isMandatory: false, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Data Subject Rights Procedure', description: 'Objection process with decision framework for assessing override grounds' },
    ],
  },
  {
    code: 'GDPR-Art-22-1',
    title: 'Automated Decision-Making Including Profiling',
    description:
      'Data subjects have the right not to be subject to a decision based solely on automated processing, including profiling, that produces legal or similarly significant effects. Exceptions apply where the decision is necessary for a contract, authorised by law, or based on explicit consent. In such cases the controller must implement suitable safeguards including the right to human review.',
    category: 'Data Subject Rights',
    domain: 'DSR',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Automated decision-making register and safeguards documentation', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',    description: 'Human review process for contested automated decisions', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Automated Decision-Making Policy', description: 'Governs use of profiling and automated decisions with safeguards for data subjects' },
    ],
  },

  // ── Controller & Processor Obligations ───────────────────────────────────────
  {
    code: 'GDPR-Art-24-1',
    title: 'Controller Responsibility',
    description:
      'The controller must implement appropriate technical and organisational measures to ensure and be able to demonstrate that processing is performed in accordance with the GDPR. Measures must be reviewed and updated where necessary. Approved codes of conduct and certifications may be used as elements to demonstrate compliance.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Data protection accountability programme documentation with roles and responsibilities', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'GDPR compliance review or certification evidence', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Data Protection Policy',      description: 'Top-level controller accountability policy' },
      { policyName: 'Information Security Policy', description: 'Technical and organisational measures for GDPR compliance' },
    ],
  },
  {
    code: 'GDPR-Art-25-1',
    title: 'Data Protection by Design and by Default',
    description:
      'The controller must implement data protection principles and appropriate technical and organisational measures (such as pseudonymisation) in an effective manner by design, and ensure that by default only personal data necessary for each specific purpose are processed. This applies to the amount of data collected, extent of processing, storage periods, and accessibility.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',        description: 'Privacy by Design and Default policy or procedure', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Evidence of privacy-protective default settings in systems (e.g., opt-in, minimal data collection)', isMandatory: false },
      { evidenceType: 'audit_report',      description: 'Privacy review or checklist completed during system design or change management', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Privacy by Design Policy', description: 'Embeds privacy considerations into product and system development lifecycle' },
    ],
  },
  {
    code: 'GDPR-Art-28-1',
    title: 'Processor Contracts (Data Processing Agreements)',
    description:
      'Where processing is carried out on behalf of a controller, the controller must only use processors providing sufficient guarantees to implement appropriate technical and organisational measures. Processing by a processor must be governed by a binding contract or legal act — a Data Processing Agreement (DPA) — setting out the subject-matter, duration, nature, and purpose of the processing, and the obligations and rights of the controller.',
    category: 'Processor Relations',
    domain: 'ProcessorRel',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Executed Data Processing Agreements with all third-party processors', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',    description: 'Vendor assessment or due diligence records for processor selection', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Vendor Management Policy',       description: 'Requires DPAs with all processors before data transfer' },
      { policyName: 'Data Processing Agreement Template', description: 'Standard DPA template meeting Article 28 requirements' },
    ],
  },
  {
    code: 'GDPR-Art-29-1',
    title: 'Processing Under Controller or Processor Authority',
    description:
      'The processor and any person acting under the authority of the controller or processor who has access to personal data must not process those data except on instructions from the controller, unless required to do so by Union or Member State law.',
    category: 'Processor Relations',
    domain: 'ProcessorRel',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Processor instruction register or documented controller instructions to processors', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Staff data handling training records confirming processing-only-on-instruction principle', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Data Processing Agreement', description: 'Restricts processor activities to documented controller instructions' },
    ],
  },
  {
    code: 'GDPR-Art-30-1',
    title: 'Records of Processing Activities (ROPA)',
    description:
      'Each controller and, where applicable, the controller\'s representative, must maintain a record of processing activities. The record must contain: name and contact details of the controller, purposes of processing, categories of data subjects and personal data, recipients, international transfers, retention periods, and a general description of security measures. Records must be made available to the supervisory authority on request.',
    category: 'Controller Obligations',
    domain: 'ControllerObl',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Up-to-date Records of Processing Activities (ROPA) document covering all processing activities', isMandatory: true, freshnessDays: 180 },
      { evidenceType: 'audit_report',  description: 'ROPA review or update log showing periodic review', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Records of Processing Activities Policy', description: 'Mandates maintenance and regular review of the ROPA' },
    ],
  },

  // ── Security ──────────────────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-32-1',
    title: 'Security of Processing',
    description:
      'The controller and processor must implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including as appropriate: pseudonymisation and encryption of personal data; ongoing confidentiality, integrity, availability, and resilience of processing systems; ability to restore availability after an incident; and regular testing of security measures.',
    category: 'Security',
    domain: 'Security',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',        description: 'Information security policy covering encryption, access controls, and resilience', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',      description: 'Penetration test or vulnerability assessment report', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'config_screenshot', description: 'Evidence of encryption at rest and in transit for personal data stores', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Information Security Policy', description: 'Covers technical measures to protect personal data' },
      { policyName: 'Encryption Policy',           description: 'Mandates encryption standards for personal data' },
    ],
  },

  // ── Breach Notification ───────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-33-1',
    title: 'Notification of Personal Data Breach to Supervisory Authority (72-hour)',
    description:
      'In the case of a personal data breach, the controller must notify the competent supervisory authority without undue delay and, where feasible, not later than 72 hours after having become aware of it. Notifications must include: nature of the breach, categories and approximate numbers of data subjects and records affected, likely consequences, and measures taken or proposed. Where notification cannot be made within 72 hours, a reasoned justification for the delay must accompany the notification.',
    category: 'Breach Notification',
    domain: 'BreachNotification',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Incident response and data breach notification procedure with 72-hour timeline and supervisory authority contact details', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Breach register with notification dates and regulator correspondence for past incidents', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Incident response tabletop exercise or breach simulation records', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Incident Response Policy',        description: 'Covers detection, assessment, containment, and 72-hour notification workflow' },
      { policyName: 'Data Breach Notification Policy', description: 'Defines roles, timelines, and notification templates for supervisory authority reporting' },
    ],
  },
  {
    code: 'GDPR-Art-34-1',
    title: 'Communication of Personal Data Breach to Data Subjects',
    description:
      'Where a personal data breach is likely to result in a high risk to the rights and freedoms of natural persons, the controller must communicate the breach to the affected data subjects without undue delay. The communication must describe in clear and plain language the nature of the breach and contact information of the DPO, likely consequences, and measures taken or proposed to address the breach.',
    category: 'Breach Notification',
    domain: 'BreachNotification',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Data subject notification procedure including risk assessment criteria for "high risk" determination', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Records of data subject notifications made and risk assessments completed', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Data Breach Notification Policy', description: 'Criteria and process for notifying data subjects of high-risk breaches' },
    ],
  },

  // ── DPIA ──────────────────────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-35-1',
    title: 'Data Protection Impact Assessment (DPIA)',
    description:
      'Where a type of processing, in particular using new technologies, is likely to result in a high risk to the rights and freedoms of natural persons, the controller must carry out a Data Protection Impact Assessment (DPIA) prior to the processing. The DPIA must include a systematic description of the processing, an assessment of necessity and proportionality, the risks to rights and freedoms, and the measures envisaged to address those risks.',
    category: 'DPIA',
    domain: 'DPIA',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'DPIA policy and threshold assessment criteria for triggering a DPIA', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Completed DPIAs for high-risk processing activities with risk mitigation measures', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'DPIA Policy',    description: 'Defines when a DPIA is required, DPIA methodology, and approval process' },
    ],
  },
  {
    code: 'GDPR-Art-35-3',
    title: 'DPIA — High-Risk Processing List',
    description:
      'A DPIA is always required for: (a) systematic and extensive evaluation of personal aspects based on automated processing, including profiling, on which decisions are based that produce legal or similarly significant effects; (b) processing on a large scale of special categories of data or personal data relating to criminal convictions; and (c) systematic monitoring of publicly accessible areas on a large scale.',
    category: 'DPIA',
    domain: 'DPIA',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Processing inventory identifying activities falling into the mandatory DPIA categories', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Completed DPIAs for all mandatory category processing activities', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'DPIA Policy', description: 'Enumerates mandatory DPIA triggers per Article 35(3) and supervisory authority list' },
    ],
  },

  // ── DPO ───────────────────────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-37-1',
    title: 'Designation of a Data Protection Officer (DPO)',
    description:
      'The controller and processor must designate a DPO where: the processing is carried out by a public authority or body; the core activities consist of processing operations that require regular and systematic monitoring of data subjects on a large scale; or the core activities consist of large-scale processing of special categories of data or data relating to criminal convictions. The DPO must have expert knowledge of data protection law.',
    category: 'DPO',
    domain: 'DPO',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'DPO designation documentation and published DPO contact details', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'attestation', description: 'DPO appointment letter or contract evidencing expert qualifications', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'DPO Policy', description: 'Defines DPO designation criteria, role, independence, and reporting lines' },
    ],
  },
  {
    code: 'GDPR-Art-39-1',
    title: 'Tasks of the Data Protection Officer',
    description:
      'The DPO must at minimum: inform and advise the controller/processor and employees about their obligations under data protection law; monitor compliance; provide advice on DPIAs and monitor performance; cooperate with the supervisory authority; and act as a contact point for the supervisory authority and data subjects. The controller must support the DPO in performing tasks and ensure independence.',
    category: 'DPO',
    domain: 'DPO',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'DPO terms of reference or job description listing Article 39 tasks', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'DPO activity log or annual report evidencing fulfilment of advisory and monitoring tasks', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'DPO Policy', description: 'Formalises DPO tasks, reporting rights, and independence protections' },
    ],
  },

  // ── International Transfers ───────────────────────────────────────────────────
  {
    code: 'GDPR-Art-44-1',
    title: 'General Principle for International Transfers',
    description:
      'Any transfer of personal data to a third country or an international organisation may only take place if the conditions laid down in Chapter V are complied with by the controller and processor, including onward transfers. All provisions of Chapter V must be applied so as to ensure that the level of protection afforded to natural persons guaranteed by the GDPR is not undermined.',
    category: 'International Transfers',
    domain: 'IntlTransfers',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'International data transfer policy mapping all third-country transfers to a Chapter V mechanism', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',    description: 'Transfer impact assessments for high-risk destination countries', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'International Data Transfer Policy', description: 'Governs all cross-border transfers and required safeguards' },
    ],
  },
  {
    code: 'GDPR-Art-46-1',
    title: 'Appropriate Safeguards for International Transfers (SCCs/BCRs)',
    description:
      'In the absence of an adequacy decision, a controller or processor may transfer personal data to a third country only if appropriate safeguards are in place, including standard contractual clauses (SCCs) adopted by the European Commission, binding corporate rules (BCRs), approved codes of conduct, or approved certification mechanisms. Data subjects must have enforceable rights and effective legal remedies.',
    category: 'International Transfers',
    domain: 'IntlTransfers',
    trustServiceCategory: 'GDPR',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Executed Standard Contractual Clauses (SCCs) or BCR documentation for all relevant transfers', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Transfer impact assessment (TIA) supporting reliance on SCCs for high-risk destinations', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'International Data Transfer Policy', description: 'Mandates appropriate safeguards and transfer impact assessments where required' },
    ],
  },
  {
    code: 'GDPR-Art-49-1',
    title: 'Derogations for Specific Situations',
    description:
      'In the absence of an adequacy decision or appropriate safeguards, a transfer to a third country may take place only on specific derogations, including: explicit consent with full information of risks; necessity for contract performance; important reasons of public interest; establishment, exercise, or defence of legal claims; vital interests where the data subject cannot consent; or from a public register. Derogations must not be used for repetitive large-scale transfers.',
    category: 'International Transfers',
    domain: 'IntlTransfers',
    trustServiceCategory: 'GDPR',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Register of transfers relying on Article 49 derogations with justification for each', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'attestation',   description: 'Legal counsel opinion confirming permissibility of derogation relied upon', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'International Data Transfer Policy', description: 'Restricts derogation use to genuinely exceptional circumstances' },
    ],
  },

  // ── Enforcement ───────────────────────────────────────────────────────────────
  {
    code: 'GDPR-Art-83-4',
    title: 'Administrative Fines',
    description:
      'Infringements of the following provisions shall be subject to administrative fines up to EUR 10,000,000 or up to 2% of total worldwide annual turnover (whichever is higher): obligations of the controller and processor under Articles 8, 11, 25–39, 42, and 43; obligations of certification bodies; obligations of monitoring bodies. More serious infringements of core provisions (Articles 5, 6, 7, 9 etc.) attract fines up to EUR 20,000,000 or 4% of global turnover.',
    category: 'Enforcement',
    domain: 'Enforcement',
    trustServiceCategory: 'GDPR',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'GDPR compliance programme documentation demonstrating enterprise-wide adherence', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Annual GDPR compliance review and remediation tracking', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Data Protection Policy', description: 'Acknowledges enforcement powers and sets compliance obligations to mitigate fine risk' },
    ],
  },
];
