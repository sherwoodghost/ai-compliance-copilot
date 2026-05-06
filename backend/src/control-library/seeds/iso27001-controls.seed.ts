/**
 * ISO/IEC 27001:2022 Annex A Controls — Seed Data
 * Source: ISO/IEC 27001:2022 Annex A (paraphrased for automated use)
 * Confidence: high
 *
 * Covers: A.5 Organizational, A.6 People, A.7 Physical, A.8 Technological
 */

import { ControlSeedRecord } from './soc2-controls.seed';

export const ISO27001_DOMAINS = [
  { code: 'A.5', name: 'Organizational Controls', sortOrder: 1 },
  { code: 'A.6', name: 'People Controls', sortOrder: 2 },
  { code: 'A.7', name: 'Physical Controls', sortOrder: 3 },
  { code: 'A.8', name: 'Technological Controls', sortOrder: 4 },
];

export const ISO27001_CONTROLS: ControlSeedRecord[] = [
  // ── A.5 Organizational Controls ─────────────────────────────────────────────
  {
    code: 'A.5.1', title: 'Policies for Information Security',
    description: 'Information security policy and topic-specific policies shall be defined, approved by management, published, communicated, and reviewed at planned intervals.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Approved information security policy with management sign-off', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc', description: 'Policy review schedule and last review date', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Information Security Policy', description: 'Top-level security policy approved by management' }],
  },
  {
    code: 'A.5.2', title: 'Information Security Roles and Responsibilities',
    description: 'Information security roles and responsibilities shall be defined and allocated according to organizational needs.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'RACI matrix or security roles and responsibilities document', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Information Security Policy', description: 'Includes roles and responsibilities section' }],
  },
  {
    code: 'A.5.3', title: 'Segregation of Duties',
    description: 'Conflicting duties and conflicting areas of responsibility shall be segregated.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'access_review', description: 'Access review confirming segregation of duties', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Includes segregation of duties requirements' }],
  },
  {
    code: 'A.5.4', title: 'Management Responsibilities',
    description: 'Management shall require all personnel to apply information security in accordance with established policies.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'training_record', description: 'Management acknowledgment of security responsibilities', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.5', title: 'Contact with Authorities',
    description: 'Appropriate contacts with relevant authorities shall be maintained.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Documented contacts for regulatory and law enforcement bodies', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Incident Response Policy', description: 'Includes regulatory notification procedures' }],
  },
  {
    code: 'A.5.6', title: 'Contact with Special Interest Groups',
    description: 'Appropriate contacts with special interest groups, security forums, and professional associations shall be maintained.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 1,
    evidenceRequirements: [
      { evidenceType: 'attestation', description: 'Membership or participation evidence in security groups', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.7', title: 'Threat Intelligence',
    description: 'Information relating to information security threats shall be collected and analyzed to produce threat intelligence.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Threat intelligence process or subscription documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.8', title: 'Information Security in Project Management',
    description: 'Information security shall be integrated into project management.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Project management security requirements documentation', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Secure SDLC Policy', description: 'Covers security in project and development lifecycle' }],
  },
  {
    code: 'A.5.9', title: 'Inventory of Information and Other Associated Assets',
    description: 'An inventory of information and associated assets shall be developed and maintained.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Asset inventory list with owner and classification', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [{ policyName: 'Asset Management Policy', description: 'Defines asset inventory and classification requirements' }],
  },
  {
    code: 'A.5.10', title: 'Acceptable Use of Information and Associated Assets',
    description: 'Rules for the acceptable use and procedures for handling information and associated assets shall be identified, documented, and implemented.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Acceptable use policy acknowledged by all staff', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Acceptable Use Policy', description: 'Defines acceptable use of assets and data' }],
  },
  {
    code: 'A.5.11', title: 'Return of Assets',
    description: 'Personnel and external parties shall return all organizational assets upon termination.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Offboarding checklist requiring asset return', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'HR Security Policy', description: 'Covers asset return on termination' }],
  },
  {
    code: 'A.5.12', title: 'Classification of Information',
    description: 'Information shall be classified according to the information security needs of the organization.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data classification scheme with labels and handling requirements', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Classification Policy', description: 'Defines classification levels and handling procedures' }],
  },
  {
    code: 'A.5.13', title: 'Labelling of Information',
    description: 'An appropriate set of procedures for information labelling shall be developed and implemented.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Information labelling procedures', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.14', title: 'Information Transfer',
    description: 'Information transfer rules, procedures, or agreements shall be in place for all types of transfer facilities.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data transfer policy or acceptable transfer methods documentation', isMandatory: true },
      { evidenceType: 'config_export', description: 'Secure file transfer or DLP configuration', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.15', title: 'Access Control',
    description: 'Rules to control physical and logical access to information and associated assets shall be established and implemented.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Access control policy defining RBAC and least privilege', isMandatory: true },
      { evidenceType: 'access_review', description: 'Quarterly or semi-annual access review records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Comprehensive access control requirements' }],
  },
  {
    code: 'A.5.16', title: 'Identity Management',
    description: 'The full lifecycle of identities shall be managed.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Identity provider (IdP) configuration showing lifecycle management', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Covers identity lifecycle management' }],
  },
  {
    code: 'A.5.17', title: 'Authentication Information',
    description: 'Allocation and management of authentication information shall be controlled.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Password policy and MFA configuration export', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Includes password and authentication requirements' }],
  },
  {
    code: 'A.5.18', title: 'Access Rights',
    description: 'Access rights to information and associated assets shall be provisioned, reviewed, modified, and removed.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'access_review', description: 'Access provisioning and deprovisioning records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.19', title: 'Information Security in Supplier Relationships',
    description: 'Processes and procedures shall be defined and implemented to manage information security risks associated with suppliers.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'vendor_review', description: 'Supplier risk assessments and security questionnaires', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'contract', description: 'Supplier contracts with security clauses', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Vendor Risk Management Policy', description: 'Covers supplier security requirements' }],
  },
  {
    code: 'A.5.20', title: 'Addressing Information Security in Supplier Agreements',
    description: 'Relevant information security requirements shall be established and agreed with each supplier.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'contract', description: 'Data processing agreements (DPAs) with key suppliers', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.21', title: 'Managing Information Security in the ICT Supply Chain',
    description: 'Processes and procedures shall be defined and implemented to manage information security risks associated with the ICT product and service supply chain.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'ICT supply chain risk management documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.22', title: 'Monitoring, Review, and Change Management of Supplier Services',
    description: 'The organization shall regularly monitor, review, evaluate, and manage change in supplier information security practices.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'vendor_review', description: 'Annual supplier security review records', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.23', title: 'Information Security for Use of Cloud Services',
    description: 'Processes for acquisition, use, management, and exit of cloud services shall be established.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Cloud usage policy or cloud security standards', isMandatory: true },
      { evidenceType: 'vendor_review', description: 'Cloud provider shared responsibility documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.24', title: 'Information Security Incident Management Planning and Preparation',
    description: 'The organization shall plan and prepare for managing information security incidents.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Incident response plan', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'incident_record', description: 'Incident response exercises or tabletop test records', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Incident Response Policy', description: 'Covers incident planning and response procedures' }],
  },
  {
    code: 'A.5.25', title: 'Assessment and Decision on Information Security Events',
    description: 'The organization shall assess information security events and decide if they are to be classified as incidents.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Security event triage and classification records', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.26', title: 'Response to Information Security Incidents',
    description: 'Information security incidents shall be responded to in accordance with documented procedures.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Incident response and containment records', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.27', title: 'Learning from Information Security Incidents',
    description: 'Knowledge gained from information security incidents shall be used to strengthen controls.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'incident_record', description: 'Post-incident review and lessons learned documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.28', title: 'Collection of Evidence',
    description: 'The organization shall establish and implement procedures for the identification, collection, acquisition, and preservation of evidence.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Digital forensics or evidence preservation procedures', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.29', title: 'Information Security During Disruption',
    description: 'The organization shall plan how to maintain information security at an appropriate level during disruption.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Business continuity plan with security considerations', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Business Continuity and Disaster Recovery Policy', description: 'Covers security during disruption' }],
  },
  {
    code: 'A.5.30', title: 'ICT Readiness for Business Continuity',
    description: 'ICT readiness shall be planned, implemented, maintained, and tested based on business continuity objectives.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'backup_test', description: 'ICT recovery test results', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.31', title: 'Legal, Statutory, Regulatory, and Contractual Requirements',
    description: 'Legal, statutory, regulatory, and contractual requirements relevant to information security shall be identified.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Legal and regulatory compliance register', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.32', title: 'Intellectual Property Rights',
    description: 'The organization shall implement appropriate procedures to protect intellectual property rights.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Software licensing and IP rights policy', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.33', title: 'Protection of Records',
    description: 'Records shall be protected from loss, destruction, falsification, unauthorized access, and unauthorized release.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Record retention and protection policy', isMandatory: true },
      { evidenceType: 'config_export', description: 'Backup and record storage configuration', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Covers record retention and protection' }],
  },
  {
    code: 'A.5.34', title: 'Privacy and Protection of Personally Identifiable Information',
    description: 'The organization shall identify and meet requirements for preserving privacy and protection of PII.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Privacy policy and PII handling procedures', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'Data subject rights procedures (DSAR)', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.35', title: 'Independent Review of Information Security',
    description: 'The organization shall conduct independent reviews of its approach to managing information security.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Internal audit report or independent security review', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.36', title: 'Compliance with Policies, Rules, and Standards',
    description: 'Compliance with information security policies, rules, and standards shall be regularly reviewed.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Compliance review or internal audit records', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.5.37', title: 'Documented Operating Procedures',
    description: 'Operating procedures for information processing facilities shall be documented and made available.',
    category: 'Organizational Controls', domain: 'A.5', trustServiceCategory: 'Organizational', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Documented operational procedures and runbooks', isMandatory: true },
    ],
    policyRequirements: [],
  },

  // ── A.6 People Controls ──────────────────────────────────────────────────────
  {
    code: 'A.6.1', title: 'Screening',
    description: 'Background verification checks on all candidates shall be carried out prior to joining.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Background check policy and process documentation', isMandatory: true },
      { evidenceType: 'attestation', description: 'Evidence of background checks for recent hires', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'HR Security Policy', description: 'Covers pre-employment screening requirements' }],
  },
  {
    code: 'A.6.2', title: 'Terms and Conditions of Employment',
    description: 'Employment contracts shall state responsibilities for information security.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Employment contract template with security clause', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.6.3', title: 'Information Security Awareness, Education, and Training',
    description: 'Personnel shall receive appropriate security awareness education, training, and regular updates.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'training_record', description: 'Security awareness training completion records for all staff', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.6.4', title: 'Disciplinary Process',
    description: 'A disciplinary process shall be in place to take action against personnel who have committed a security violation.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Disciplinary policy referencing security violations', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.6.5', title: 'Responsibilities After Termination or Change of Employment',
    description: 'Security responsibilities shall remain valid after termination or change of employment.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Offboarding checklist with access revocation and NDA requirements', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'HR Security Policy', description: 'Covers post-employment security responsibilities' }],
  },
  {
    code: 'A.6.6', title: 'Confidentiality or Non-Disclosure Agreements',
    description: 'Confidentiality or non-disclosure agreements shall be identified, documented, and regularly reviewed.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'contract', description: 'NDA templates and signed NDA records', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.6.7', title: 'Remote Working',
    description: 'Security measures shall be implemented when personnel work remotely.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Remote working security policy', isMandatory: true },
      { evidenceType: 'config_export', description: 'VPN or endpoint management configuration', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.6.8', title: 'Information Security Event Reporting',
    description: 'Personnel shall report information security events through appropriate channels promptly.',
    category: 'People Controls', domain: 'A.6', trustServiceCategory: 'People', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Incident reporting procedure communicated to all staff', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Incident Response Policy', description: 'Includes staff reporting procedures' }],
  },

  // ── A.7 Physical Controls ────────────────────────────────────────────────────
  {
    code: 'A.7.1', title: 'Physical Security Perimeters',
    description: 'Security perimeters shall be defined and used to protect areas that contain information and information processing facilities.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Physical security policy or data center shared responsibility documentation', isMandatory: true },
      { evidenceType: 'screenshot', description: 'Physical access control evidence or cloud SOC report covering physical security', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.2', title: 'Physical Entry',
    description: 'Secure areas shall be protected by appropriate entry controls to ensure only authorized personnel are allowed access.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'screenshot', description: 'Physical access logs or cloud provider SOC 2 Type 2 report', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.3', title: 'Securing Offices, Rooms, and Facilities',
    description: 'Physical security for offices, rooms, and facilities shall be designed and applied.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Office security policy', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.4', title: 'Physical Security Monitoring',
    description: 'Premises shall be continuously monitored for unauthorized physical access.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'attestation', description: 'CCTV or physical monitoring documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.5', title: 'Protecting Against Physical and Environmental Threats',
    description: 'Protection against physical and environmental threats shall be designed and applied.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Environmental controls documentation (UPS, fire suppression, etc.)', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.6', title: 'Working in Secure Areas',
    description: 'Security measures for working in secure areas shall be designed and applied.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 1,
    evidenceRequirements: [],
    policyRequirements: [],
  },
  {
    code: 'A.7.7', title: 'Clear Desk and Clear Screen',
    description: 'Clear desk and clear screen rules shall be defined and enforced.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Clear desk and screen lock policy', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Acceptable Use Policy', description: 'Includes clear desk and screen lock requirements' }],
  },
  {
    code: 'A.7.8', title: 'Equipment Siting and Protection',
    description: 'Equipment shall be sited and protected to reduce risks from environmental threats.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'attestation', description: 'Equipment placement and protection documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.9', title: 'Security of Assets Off-Premises',
    description: 'Off-site assets shall be protected taking into account the risks of working outside the organization\'s premises.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Mobile device and remote working security policy', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.10', title: 'Storage Media',
    description: 'Storage media shall be managed through its lifecycle including acquisition, use, transportation, and disposal.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Media handling and disposal policy', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Covers media disposal requirements' }],
  },
  {
    code: 'A.7.11', title: 'Supporting Utilities',
    description: 'Information processing facilities shall be protected from power failures and other disruptions.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'attestation', description: 'UPS and power redundancy documentation or cloud provider SoC report', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.7.12', title: 'Cabling Security',
    description: 'Cables carrying power and telecommunications shall be protected from interception or damage.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 1,
    evidenceRequirements: [],
    policyRequirements: [],
  },
  {
    code: 'A.7.13', title: 'Equipment Maintenance',
    description: 'Equipment shall be maintained correctly to ensure availability and integrity.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 1,
    evidenceRequirements: [],
    policyRequirements: [],
  },
  {
    code: 'A.7.14', title: 'Secure Disposal or Re-Use of Equipment',
    description: 'Items of equipment containing storage media shall be verified to ensure that sensitive data has been removed before disposal.',
    category: 'Physical Controls', domain: 'A.7', trustServiceCategory: 'Physical', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'attestation', description: 'Equipment disposal or sanitization certificates', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Covers equipment disposal and data wiping' }],
  },

  // ── A.8 Technological Controls ───────────────────────────────────────────────
  {
    code: 'A.8.1', title: 'User Endpoint Devices',
    description: 'Information stored on or processed by user endpoint devices shall be protected.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'MDM or endpoint management configuration (Jamf, Intune)', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Acceptable Use Policy', description: 'Covers endpoint security requirements' }],
  },
  {
    code: 'A.8.2', title: 'Privileged Access Rights',
    description: 'The allocation and use of privileged access rights shall be restricted and managed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'access_review', description: 'Privileged access inventory and review records', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'config_export', description: 'Privileged access management (PAM) or admin console configuration', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Covers privileged access management' }],
  },
  {
    code: 'A.8.3', title: 'Information Access Restriction',
    description: 'Access to information and other associated assets shall be restricted in accordance with the access control policy.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Role-based access control (RBAC) configuration', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.4', title: 'Access to Source Code',
    description: 'Read and write access to source code shall be appropriately managed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Source code repository access controls and branch protection configuration', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Secure SDLC Policy', description: 'Covers source code access controls' }],
  },
  {
    code: 'A.8.5', title: 'Secure Authentication',
    description: 'Secure authentication technologies and procedures shall be implemented.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 5,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'MFA and SSO configuration export', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Access Control Policy', description: 'Defines MFA and authentication requirements' }],
  },
  {
    code: 'A.8.6', title: 'Capacity Management',
    description: 'The use of resources shall be monitored and adjusted to meet current and future capacity requirements.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'log_file', description: 'Infrastructure capacity monitoring reports', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.7', title: 'Protection Against Malware',
    description: 'Protection against malware shall be implemented and supported by appropriate user awareness.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Antivirus/EDR configuration and deployment evidence', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Vulnerability Management Policy', description: 'Covers malware protection requirements' }],
  },
  {
    code: 'A.8.8', title: 'Management of Technical Vulnerabilities',
    description: 'Information about technical vulnerabilities of systems in use shall be obtained in a timely manner.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'scan_report', description: 'Vulnerability scan reports (at least quarterly)', isMandatory: true, freshnessDays: 90 },
      { evidenceType: 'ticket', description: 'Vulnerability remediation tracking records', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Vulnerability Management Policy', description: 'Defines scanning frequency and SLAs' }],
  },
  {
    code: 'A.8.9', title: 'Configuration Management',
    description: 'Configurations of hardware, software, services, and networks shall be established, documented, implemented, monitored, and reviewed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Infrastructure as code or configuration management documentation', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.10', title: 'Information Deletion',
    description: 'Information stored in information systems shall be deleted when no longer required.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Data deletion procedures and retention schedule', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Data Retention and Disposal Policy', description: 'Covers data deletion requirements' }],
  },
  {
    code: 'A.8.11', title: 'Data Masking',
    description: 'Data masking shall be used in accordance with the organization\'s topic-specific policy on access control.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Data masking or anonymization configuration for non-production environments', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.12', title: 'Data Leakage Prevention',
    description: 'Data leakage prevention measures shall be applied to systems and networks that process, store, or transmit sensitive information.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'DLP tool configuration or evidence of controls preventing data exfiltration', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.13', title: 'Information Backup',
    description: 'Backup copies of information shall be made, maintained, and tested regularly.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Backup configuration and schedule', isMandatory: true },
      { evidenceType: 'backup_test', description: 'Backup restore test results', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [{ policyName: 'Backup Policy', description: 'Defines backup frequency, retention, and testing' }],
  },
  {
    code: 'A.8.14', title: 'Redundancy of Information Processing Facilities',
    description: 'Sufficient redundancy shall be implemented in information processing facilities to meet availability requirements.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Multi-region or multi-AZ infrastructure configuration', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.15', title: 'Logging',
    description: 'Logs that record activities, exceptions, faults, and other relevant events shall be produced, stored, protected, and analyzed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Logging configuration and retention settings', isMandatory: true },
      { evidenceType: 'log_file', description: 'Sample security event logs', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [{ policyName: 'Logging and Monitoring Policy', description: 'Defines log collection, retention, and review' }],
  },
  {
    code: 'A.8.16', title: 'Monitoring Activities',
    description: 'Networks, systems, and applications shall be monitored for anomalous behaviour.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'SIEM or monitoring tool configuration', isMandatory: true },
      { evidenceType: 'log_file', description: 'Monitoring alert and investigation records', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.17', title: 'Clock Synchronization',
    description: 'Clocks of information processing systems shall be synchronized to an approved time source.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 1,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'NTP configuration or cloud provider time sync evidence', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.18', title: 'Use of Privileged Utility Programs',
    description: 'The use of utility programs that can override system and application controls shall be restricted.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Privileged utility program access controls', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.19', title: 'Installation of Software on Operational Systems',
    description: 'Procedures and measures shall be implemented to securely manage software installation on operational systems.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Software installation policy and approval workflow', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Change Management Policy', description: 'Covers software installation controls' }],
  },
  {
    code: 'A.8.20', title: 'Networks Security',
    description: 'Networks shall be secured, managed, and controlled to protect information in systems and applications.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Network segmentation and firewall configuration', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.21', title: 'Security of Network Services',
    description: 'Security mechanisms and levels of service for all network services shall be identified, implemented, and monitored.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Network service security controls configuration', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.22', title: 'Segregation of Networks',
    description: 'Groups of information services, users, and information systems shall be segregated in the organization\'s networks.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Network segmentation diagram or VPC/subnet configuration', isMandatory: true },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.23', title: 'Web Filtering',
    description: 'Access to external websites shall be managed to reduce exposure to malicious content.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Web filtering configuration or DNS security settings', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.24', title: 'Use of Cryptography',
    description: 'Rules for the effective use of cryptography shall be defined and implemented.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Encryption configuration for data at rest and in transit', isMandatory: true },
      { evidenceType: 'policy_doc', description: 'Cryptography policy', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Encryption Policy', description: 'Defines cryptographic standards and key management' }],
  },
  {
    code: 'A.8.25', title: 'Secure Development Lifecycle',
    description: 'Rules for the secure development of software and systems shall be established and applied.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Secure SDLC policy and development guidelines', isMandatory: true },
      { evidenceType: 'config_export', description: 'SAST/DAST tool integration in CI/CD pipeline', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Secure SDLC Policy', description: 'Defines secure development lifecycle requirements' }],
  },
  {
    code: 'A.8.26', title: 'Application Security Requirements',
    description: 'Security requirements shall be identified, specified, and approved when developing or acquiring applications.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Application security requirements documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.27', title: 'Secure System Architecture and Engineering Principles',
    description: 'Principles for engineering secure systems shall be established, documented, maintained, and applied.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Security architecture principles documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.28', title: 'Secure Coding',
    description: 'Secure coding principles shall be applied to software development.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Secure coding guidelines or OWASP reference documentation', isMandatory: true },
      { evidenceType: 'config_export', description: 'Code review or SAST scan configuration', isMandatory: false },
    ],
    policyRequirements: [{ policyName: 'Secure SDLC Policy', description: 'Includes secure coding requirements' }],
  },
  {
    code: 'A.8.29', title: 'Security Testing in Development and Acceptance',
    description: 'Security testing processes shall be defined and implemented in the development lifecycle.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 3,
    evidenceRequirements: [
      { evidenceType: 'scan_report', description: 'Penetration test or security assessment report', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.30', title: 'Outsourced Development',
    description: 'The organization shall direct, monitor, and review the activities related to outsourced system development.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'contract', description: 'Outsourced development contracts with security requirements', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.31', title: 'Separation of Development, Test, and Production Environments',
    description: 'Development, testing, and production environments shall be separated and secured.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'config_export', description: 'Environment separation configuration (separate accounts, VPCs, etc.)', isMandatory: true },
    ],
    policyRequirements: [{ policyName: 'Change Management Policy', description: 'Covers environment separation requirements' }],
  },
  {
    code: 'A.8.32', title: 'Change Management',
    description: 'Changes to information processing facilities and information systems shall be subject to change management procedures.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 4,
    evidenceRequirements: [
      { evidenceType: 'ticket', description: 'Change request tickets with approval and testing evidence', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [{ policyName: 'Change Management Policy', description: 'Defines change control process and approvals' }],
  },
  {
    code: 'A.8.33', title: 'Test Information',
    description: 'Test information shall be appropriately selected, protected, and managed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Test data management policy', isMandatory: false },
    ],
    policyRequirements: [],
  },
  {
    code: 'A.8.34', title: 'Protection of Information Systems During Audit Testing',
    description: 'Audit tests and other assurance activities involving assessment of operational systems shall be planned and agreed.',
    category: 'Technological Controls', domain: 'A.8', trustServiceCategory: 'Technological', weight: 2,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Audit testing procedures and system protection documentation', isMandatory: false },
    ],
    policyRequirements: [],
  },
];
