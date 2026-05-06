/**
 * SOC 2 Trust Services Criteria — Seed Data
 * Source: AICPA Trust Services Criteria (paraphrased for automated use)
 * Confidence: high
 *
 * Covers: CC1–CC9 (Security), A1 (Availability), C1 (Confidentiality),
 *         PI1 (Processing Integrity), P1–P8 (Privacy)
 */

export interface ControlSeedRecord {
  code: string;
  title: string;
  description: string;
  category: string;
  domain: string;
  trustServiceCategory: string;
  weight: number;
  evidenceRequirements: Array<{ evidenceType: string; description: string; isMandatory: boolean; freshnessDays?: number }>;
  policyRequirements: Array<{ policyName: string; description: string }>;
}

export const SOC2_DOMAINS = [
  { code: 'CC1', name: 'Control Environment', trustServiceCategory: 'Security', sortOrder: 1 },
  { code: 'CC2', name: 'Communication and Information', trustServiceCategory: 'Security', sortOrder: 2 },
  { code: 'CC3', name: 'Risk Assessment', trustServiceCategory: 'Security', sortOrder: 3 },
  { code: 'CC4', name: 'Monitoring Activities', trustServiceCategory: 'Security', sortOrder: 4 },
  { code: 'CC5', name: 'Control Activities', trustServiceCategory: 'Security', sortOrder: 5 },
  { code: 'CC6', name: 'Logical and Physical Access Controls', trustServiceCategory: 'Security', sortOrder: 6 },
  { code: 'CC7', name: 'System Operations', trustServiceCategory: 'Security', sortOrder: 7 },
  { code: 'CC8', name: 'Change Management', trustServiceCategory: 'Security', sortOrder: 8 },
  { code: 'CC9', name: 'Risk Mitigation', trustServiceCategory: 'Security', sortOrder: 9 },
  { code: 'A1',  name: 'Availability', trustServiceCategory: 'Availability', sortOrder: 10 },
  { code: 'C1',  name: 'Confidentiality', trustServiceCategory: 'Confidentiality', sortOrder: 11 },
  { code: 'PI1', name: 'Processing Integrity', trustServiceCategory: 'Processing Integrity', sortOrder: 12 },
  { code: 'P1',  name: 'Privacy — Notice and Communication', trustServiceCategory: 'Privacy', sortOrder: 13 },
  { code: 'P2',  name: 'Privacy — Choice and Consent', trustServiceCategory: 'Privacy', sortOrder: 14 },
  { code: 'P3',  name: 'Privacy — Collection', trustServiceCategory: 'Privacy', sortOrder: 15 },
  { code: 'P4',  name: 'Privacy — Use, Retention, and Disposal', trustServiceCategory: 'Privacy', sortOrder: 16 },
  { code: 'P5',  name: 'Privacy — Access', trustServiceCategory: 'Privacy', sortOrder: 17 },
  { code: 'P6',  name: 'Privacy — Disclosure and Notification', trustServiceCategory: 'Privacy', sortOrder: 18 },
  { code: 'P7',  name: 'Privacy — Quality', trustServiceCategory: 'Privacy', sortOrder: 19 },
  { code: 'P8',  name: 'Privacy — Monitoring and Enforcement', trustServiceCategory: 'Privacy', sortOrder: 20 },
];

export const SOC2_CONTROLS: ControlSeedRecord[] = [
  // ── CC1: Control Environment ────────────────────────────────────────────────
  {
    code: 'CC1.1', title: 'Organizational Commitment to Integrity and Ethical Values',
    description: 'The entity demonstrates commitment to integrity and ethical values through its tone at the top, policies, and employee conduct standards.',
    category: 'Control Environment', domain: 'CC1', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Code of conduct or acceptable use policy', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Employee security awareness training completion records', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Acceptable Use Policy', description: 'Defines ethical and acceptable use of systems and data' }],
  },
  {
    code: 'CC1.2', title: 'Board Independence and Oversight',
    description: 'The board of directors demonstrates independence from management and exercises oversight of internal controls.',
    category: 'Control Environment', domain: 'CC1', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Board charter or governance documentation', isMandatory: false },
      { evidenceType: 'attestation', description: 'Management assertion of oversight activities', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC1.3', title: 'Management Structure and Assignment of Authority',
    description: 'Management establishes organizational structures, reporting lines, and assigns authority and responsibility.',
    category: 'Control Environment', domain: 'CC1', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Organization chart and role descriptions', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'RACI or responsibility assignment documentation', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Information Security Policy', description: 'Defines security roles and responsibilities' }],
  },
  {
    code: 'CC1.4', title: 'Commitment to Competence',
    description: 'The entity demonstrates commitment to attracting, developing, and retaining competent individuals.',
    category: 'Control Environment', domain: 'CC1', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'training_record', description: 'Security training completion records', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc', description: 'HR security onboarding/offboarding procedures', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'HR Security Policy', description: 'Covers hiring, termination, and training requirements' }],
  },
  {
    code: 'CC1.5', title: 'Accountability for Internal Control Responsibilities',
    description: 'The entity holds individuals accountable for their internal control responsibilities.',
    category: 'Control Environment', domain: 'CC1', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Performance management documentation referencing security responsibilities', isMandatory: false },
      { evidenceType: 'attestation', description: 'Evidence of accountability mechanisms (disciplinary process)', isMandatory: true },
    ],
    policyRequirements: [],
  },

  // ── CC2: Communication and Information ─────────────────────────────────────
  {
    code: 'CC2.1', title: 'Information Quality and Security',
    description: 'The entity uses relevant, quality information to support the functioning of its internal controls.',
    category: 'Communication and Information', domain: 'CC2', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Data classification scheme documentation', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Classification Policy', description: 'Classifies data by sensitivity and handling requirements' }],
  },
  {
    code: 'CC2.2', title: 'Internal Communication',
    description: 'The entity communicates internally about its objectives, responsibilities, and important matters for control.',
    category: 'Communication and Information', domain: 'CC2', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Security awareness communications or newsletter samples', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC2.3', title: 'External Communication',
    description: 'The entity communicates externally with parties affecting its controls, including customers and regulators.',
    category: 'Communication and Information', domain: 'CC2', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Privacy policy or security disclosure documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },

  // ── CC3: Risk Assessment ────────────────────────────────────────────────────
  {
    code: 'CC3.1', title: 'Risk Assessment Objective Specification',
    description: 'The entity specifies objectives clearly to enable identification and assessment of risks to those objectives.',
    category: 'Risk Assessment', domain: 'CC3', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Risk management policy or framework document', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Risk Management Policy', description: 'Defines risk assessment methodology and objectives' }],
  },
  {
    code: 'CC3.2', title: 'Risk Identification and Analysis',
    description: 'The entity identifies and analyzes risks to the achievement of its objectives to determine how those risks should be managed.',
    category: 'Risk Assessment', domain: 'CC3', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Risk register or risk assessment report', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC3.3', title: 'Fraud Risk Assessment',
    description: 'The entity considers the potential for fraud in assessing risks.',
    category: 'Risk Assessment', domain: 'CC3', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Fraud risk assessment documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC3.4', title: 'Risk Assessment of Changes',
    description: 'The entity identifies and assesses changes that could significantly impact its system of internal controls.',
    category: 'Risk Assessment', domain: 'CC3', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Change risk assessment process documentation', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Change Management Policy', description: 'Includes risk assessment for system changes' }],
  },

  // ── CC4: Monitoring Activities ──────────────────────────────────────────────
  {
    code: 'CC4.1', title: 'Ongoing and Separate Evaluations',
    description: 'The entity selects, develops, and performs ongoing or separate evaluations to determine controls are present and functioning.',
    category: 'Monitoring Activities', domain: 'CC4', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'log_file', description: 'Security monitoring logs or SIEM alerts', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'policy_doc', description: 'Internal audit reports or control testing results', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Logging and Monitoring Policy', description: 'Defines monitoring requirements and log retention' }],
  },
  {
    code: 'CC4.2', title: 'Evaluation and Communication of Deficiencies',
    description: 'The entity evaluates and communicates internal control deficiencies in a timely manner.',
    category: 'Monitoring Activities', domain: 'CC4', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'ticket', description: 'Deficiency tracking and remediation records', isMandatory: true },
    ],
    policyRequirements: [],
  },

  // ── CC5: Control Activities ─────────────────────────────────────────────────
  {
    code: 'CC5.1', title: 'Selection and Development of Control Activities',
    description: 'The entity selects and develops control activities that contribute to the mitigation of risks.',
    category: 'Control Activities', domain: 'CC5', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Control activity documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC5.2', title: 'Technology General Controls',
    description: 'The entity selects and develops general controls over technology to support the achievement of objectives.',
    category: 'Control Activities', domain: 'CC5', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Technology control configuration exports', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC5.3', title: 'Policies and Procedures',
    description: 'The entity deploys control activities through policies and procedures.',
    category: 'Control Activities', domain: 'CC5', trustServiceCategory: 'Security', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Approved policy documents with review dates', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Information Security Policy', description: 'Master security policy covering all control areas' }],
  },

  // ── CC6: Logical and Physical Access Controls ───────────────────────────────
  {
    code: 'CC6.1', title: 'Logical Access Security Measures',
    description: 'The entity implements logical access security software, infrastructure, and architectures to protect against threats.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Identity provider configuration export (Okta, AD, etc.)', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'config_export', description: 'MFA enforcement configuration', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'access_review', description: 'User access list and permissions review', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Defines access management, least privilege, and MFA requirements' }],
  },
  {
    code: 'CC6.2', title: 'New Internal and External User Registration',
    description: 'The entity registers and authorizes new internal and external users whose access is administered by the entity.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'User provisioning/onboarding procedures', isMandatory: true },
      { evidenceType: 'access_review', description: 'User access request and approval records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Covers user registration and provisioning' }],
  },
  {
    code: 'CC6.3', title: 'Logical Access Restrictions',
    description: 'The entity authorizes, modifies, or removes access based on roles and least-privilege principles.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'access_review', description: 'Periodic access review documentation (at least quarterly)', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'config_export', description: 'Role-based access control configuration', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Defines least-privilege, role-based access control' }],
  },
  {
    code: 'CC6.4', title: 'Physical Access Restrictions',
    description: 'The entity restricts physical access to facilities and protected information assets.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Physical access control documentation or cloud-shared responsibility statement', isMandatory: true },
      { evidenceType: 'screenshot', description: 'Physical access logs or data center provider SoC report', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'CC6.5', title: 'Logical and Physical Protections Against Security Threats',
    description: 'The entity discontinues logical and physical protections against potential security threats.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Termination/offboarding access revocation procedures', isMandatory: true },
      { evidenceType: 'access_review', description: 'Terminated user access revocation records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'HR Security Policy', description: 'Includes access revocation on termination' }],
  },
  {
    code: 'CC6.6', title: 'Logical Access Security Measures Over External Transmissions',
    description: 'The entity implements controls to prevent unauthorized access during transmission of information.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'TLS/encryption configuration for APIs and data in transit', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Encryption Policy', description: 'Defines encryption standards for data in transit' }],
  },
  {
    code: 'CC6.7', title: 'Logical Access Security Measures Over Protected Information',
    description: 'The entity restricts access to protected information by dividing duties and implementing technology.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Encryption at rest configuration', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'Data handling and encryption standards', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Encryption Policy', description: 'Covers encryption at rest requirements' }],
  },
  {
    code: 'CC6.8', title: 'Prevention and Detection of Unauthorized Software',
    description: 'The entity implements controls to prevent or detect and act upon the introduction of unauthorized software.',
    category: 'Logical and Physical Access Controls', domain: 'CC6', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Endpoint detection or MDM configuration', isMandatory: true },
      { evidenceType: 'scan_report', description: 'Vulnerability or endpoint scan report', isMandatory: false, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Vulnerability Management Policy', description: 'Covers endpoint protection and vulnerability scanning' }],
  },

  // ── CC7: System Operations ──────────────────────────────────────────────────
  {
    code: 'CC7.1', title: 'Vulnerability Detection Procedures',
    description: 'The entity uses detection and monitoring procedures to identify changes to configurations that introduce vulnerabilities.',
    category: 'System Operations', domain: 'CC7', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'scan_report', description: 'Vulnerability scan or penetration test report', isMandatory: true, freshnessDays: 180 },
      { evidenceType: 'config_export', description: 'Vulnerability management tool configuration', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Vulnerability Management Policy', description: 'Defines scanning frequency and remediation SLAs' }],
  },
  {
    code: 'CC7.2', title: 'Monitoring System Components for Anomalous Behavior',
    description: 'The entity monitors system components for anomalous behavior that might indicate a security threat.',
    category: 'System Operations', domain: 'CC7', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'log_file', description: 'Security monitoring/alerting system logs or SIEM export', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'config_export', description: 'Alerting and monitoring configuration', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Logging and Monitoring Policy', description: 'Defines anomaly detection and alerting requirements' }],
  },
  {
    code: 'CC7.3', title: 'Incident Evaluation and Response',
    description: 'The entity evaluates security events to determine whether they qualify as incidents and responds accordingly.',
    category: 'System Operations', domain: 'CC7', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Incident response log or post-mortem records', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc', description: 'Incident response plan', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Incident Response Policy', description: 'Defines incident classification, response, and escalation' }],
  },
  {
    code: 'CC7.4', title: 'Incident Response and Recovery',
    description: 'The entity responds to identified security incidents by executing a defined incident response program.',
    category: 'System Operations', domain: 'CC7', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Documented incident response activities', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'Incident response runbook', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Incident Response Policy', description: 'Covers response procedures and recovery steps' }],
  },
  {
    code: 'CC7.5', title: 'Post-Incident Recovery Activities',
    description: 'The entity identifies and addresses root causes of security incidents and restores operations.',
    category: 'System Operations', domain: 'CC7', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Post-incident review/root cause analysis documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },

  // ── CC8: Change Management ──────────────────────────────────────────────────
  {
    code: 'CC8.1', title: 'Change Management Process',
    description: 'The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to infrastructure and software.',
    category: 'Change Management', domain: 'CC8', trustServiceCategory: 'Security', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'ticket', description: 'Change request tickets with approvals and test evidence', isMandatory: true, freshnessDays: 180 },
      { evidenceType: 'config_export', description: 'Branch protection and PR review configuration', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'Change management procedure document', isMandatory: true },
    ],
    policyRequirements: [
      { policyName: 'Change Management Policy', description: 'Defines change authorization, testing, and approval workflow' },
      { policyName: 'Secure SDLC Policy', description: 'Covers secure development lifecycle requirements' },
    ],
  },

  // ── CC9: Risk Mitigation ────────────────────────────────────────────────────
  {
    code: 'CC9.1', title: 'Risk Mitigation Activities',
    description: 'The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.',
    category: 'Risk Mitigation', domain: 'CC9', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Business continuity or disaster recovery plan', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'backup_test', description: 'Backup and recovery test results', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Business Continuity and Disaster Recovery Policy', description: 'Covers BCP/DR planning and testing' }],
  },
  {
    code: 'CC9.2', title: 'Vendor and Business Partner Risk Management',
    description: 'The entity assesses and manages risks associated with vendors and business partners.',
    category: 'Risk Mitigation', domain: 'CC9', trustServiceCategory: 'Security', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'vendor_review', description: 'Vendor risk assessments or third-party security reviews', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'contract', description: 'Data processing agreements (DPAs) with key vendors', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Vendor Risk Management Policy', description: 'Defines vendor assessment and DPA requirements' }],
  },

  // ── A1: Availability ────────────────────────────────────────────────────────
  {
    code: 'A1.1', title: 'Availability Objectives and Policies',
    description: 'The entity maintains performance monitoring and service level agreements to meet its availability commitments.',
    category: 'Availability', domain: 'A1', trustServiceCategory: 'Availability', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Uptime monitoring configuration and SLA documentation', isMandatory: true },
      { evidenceType: 'log_file', description: 'Availability/uptime monitoring reports', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A1.2', title: 'Infrastructure and Availability',
    description: 'The entity monitors and maintains the availability of its infrastructure to meet its commitments.',
    category: 'Availability', domain: 'A1', trustServiceCategory: 'Availability', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Infrastructure redundancy and auto-scaling configuration', isMandatory: true },
      { evidenceType: 'backup_test', description: 'Disaster recovery test results', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Business Continuity and Disaster Recovery Policy', description: 'Covers infrastructure availability requirements' }],
  },
  {
    code: 'A1.3', title: 'Recovery Testing',
    description: 'The entity tests recovery plan procedures to ensure systems can be recovered in accordance with its commitments.',
    category: 'Availability', domain: 'A1', trustServiceCategory: 'Availability', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'backup_test', description: 'Documented DR/BCP test results with RTO/RPO validation', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },

  // ── C1: Confidentiality ─────────────────────────────────────────────────────
  {
    code: 'C1.1', title: 'Confidential Information Identification',
    description: 'The entity identifies and maintains confidential information to meet its confidentiality commitments.',
    category: 'Confidentiality', domain: 'C1', trustServiceCategory: 'Confidentiality', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data classification policy identifying confidential data categories', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Classification Policy', description: 'Defines confidential data classification and handling' }],
  },
  {
    code: 'C1.2', title: 'Confidential Information Disposal',
    description: 'The entity disposes of confidential information to meet its confidentiality commitments.',
    category: 'Confidentiality', domain: 'C1', trustServiceCategory: 'Confidentiality', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data retention and disposal policy', isMandatory: true },
      { evidenceType: 'attestation', description: 'Evidence of secure data disposal (certificates or logs)', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Defines retention schedules and secure disposal procedures' }],
  },

  // ── PI1: Processing Integrity ───────────────────────────────────────────────
  {
    code: 'PI1.1', title: 'Processing Integrity Policies and Procedures',
    description: 'The entity obtains and uses quality information to meet its processing integrity commitments.',
    category: 'Processing Integrity', domain: 'PI1', trustServiceCategory: 'Processing Integrity', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'log_file', description: 'Transaction processing logs or integrity checksums', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [],
  },
  {
    code: 'PI1.2', title: 'System Processing Completeness and Accuracy',
    description: 'The entity implements controls over system inputs, processing, and outputs to address completeness and accuracy.',
    category: 'Processing Integrity', domain: 'PI1', trustServiceCategory: 'Processing Integrity', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'log_file', description: 'Error handling logs and exception reports', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [],
  },

  // ── P1-P8: Privacy ──────────────────────────────────────────────────────────
  {
    code: 'P1.1', title: 'Privacy Notice',
    description: 'The entity provides notice about its privacy practices to data subjects.',
    category: 'Privacy — Notice', domain: 'P1', trustServiceCategory: 'Privacy', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Published privacy policy or notice', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'P2.1', title: 'Choice and Consent',
    description: 'The entity communicates choices available regarding the collection, use, retention, and disclosure of personal information.',
    category: 'Privacy — Choice', domain: 'P2', trustServiceCategory: 'Privacy', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Consent management documentation or cookie banner configuration', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'P3.1', title: 'Personal Information Collection',
    description: 'The entity collects personal information only for the purposes identified in its privacy notice.',
    category: 'Privacy — Collection', domain: 'P3', trustServiceCategory: 'Privacy', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data inventory or personal data mapping documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'P4.1', title: 'Use, Retention, and Disposal of Personal Information',
    description: 'The entity limits the use of personal information to the purposes identified in its privacy notice and retains it only as long as necessary.',
    category: 'Privacy — Use and Retention', domain: 'P4', trustServiceCategory: 'Privacy', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data retention schedule', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Covers personal data retention and disposal' }],
  },
  {
    code: 'P5.1', title: 'Access to Personal Information',
    description: 'The entity grants data subjects the ability to access their stored personal information for review or update.',
    category: 'Privacy — Access', domain: 'P5', trustServiceCategory: 'Privacy', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data subject access request (DSAR) procedure', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'P6.1', title: 'Disclosure and Notification',
    description: 'The entity discloses personal information to third parties with the consent of data subjects or as required by law.',
    category: 'Privacy — Disclosure', domain: 'P6', trustServiceCategory: 'Privacy', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'contract', description: 'Data processing agreements with third-party processors', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'P7.1', title: 'Data Quality',
    description: 'The entity maintains accurate and complete personal information.',
    category: 'Privacy — Quality', domain: 'P7', trustServiceCategory: 'Privacy', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data quality and accuracy procedures', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'P8.1', title: 'Privacy Monitoring and Enforcement',
    description: 'The entity monitors compliance with its privacy policies and procedures and addresses privacy-related complaints.',
    category: 'Privacy — Monitoring', domain: 'P8', trustServiceCategory: 'Privacy', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Privacy compliance monitoring documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
];
