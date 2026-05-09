/**
 * HIPAA Security Rule — Control Seed Data
 * Source: 45 CFR Part 164 — Security Standards for the Protection of
 *         Electronic Protected Health Information (ePHI)
 *
 * Covers:
 *   Administrative Safeguards  §164.308  (11 required + 4 addressable standards)
 *   Physical Safeguards        §164.310  (4 standards)
 *   Technical Safeguards       §164.312  (5 standards)
 *   Organizational Requirements§164.314  (2 standards)
 *   Policies & Procedures      §164.316  (2 standards)
 */

export interface HipaaControlRecord {
  code:        string;
  title:       string;
  description: string;
  category:    string;
  guidance:    string;
  weight:      number;
}

export const HIPAA_CONTROLS: HipaaControlRecord[] = [

  // ── §164.308 Administrative Safeguards ────────────────────────────────────

  {
    code: 'HIPAA-308-a-1-i',
    title: 'Security Management Process — Risk Analysis',
    description:
      'Conduct an accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI held by the covered entity.',
    category: 'Administrative Safeguards',
    guidance:
      'Perform and document a formal risk analysis. Identify all systems that create, receive, maintain, or transmit ePHI. Assess likelihood and impact of threats. Update at least annually and after significant changes.',
    weight: 5,
  },
  {
    code: 'HIPAA-308-a-1-ii',
    title: 'Security Management Process — Risk Management',
    description:
      'Implement security measures sufficient to reduce risks and vulnerabilities to ePHI to a reasonable and appropriate level.',
    category: 'Administrative Safeguards',
    guidance:
      'Develop and implement a risk management plan with prioritized remediation actions. Track remediation status. Document residual risk acceptance decisions with management sign-off.',
    weight: 5,
  },
  {
    code: 'HIPAA-308-a-1-iii',
    title: 'Security Management Process — Sanction Policy',
    description:
      'Apply appropriate sanctions against workforce members who fail to comply with the security policies and procedures of the covered entity.',
    category: 'Administrative Safeguards',
    guidance:
      'Document a workforce sanction policy with graduated penalties. Ensure disciplinary procedures are consistently applied. Maintain records of sanctions imposed.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-1-iv',
    title: 'Security Management Process — Information System Activity Review',
    description:
      'Implement procedures to regularly review records of information system activity, such as audit logs, access reports, and security incident tracking reports.',
    category: 'Administrative Safeguards',
    guidance:
      'Establish a formal log review cadence (at minimum weekly for critical systems). Use SIEM or centralized logging. Assign ownership for review and track anomalies through to resolution.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-2',
    title: 'Assigned Security Responsibility',
    description:
      'Identify the security official who is responsible for the development and implementation of the policies and procedures required by the HIPAA Security Rule.',
    category: 'Administrative Safeguards',
    guidance:
      'Formally designate a HIPAA Security Officer in writing. Document their responsibilities, authority, and reporting relationship. Ensure contact information is current and accessible.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-3-i',
    title: 'Workforce Security — Authorization and Supervision',
    description:
      'Implement procedures for the authorization and/or supervision of workforce members who work with ePHI or in locations where it might be accessed.',
    category: 'Administrative Safeguards',
    guidance:
      'Document a formal access authorization procedure. Require manager approval before granting ePHI access. Implement supervisory controls for workforce in ePHI-handling roles.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-3-ii',
    title: 'Workforce Security — Workforce Clearance Procedure',
    description:
      'Implement procedures to determine that the access of a workforce member to ePHI is appropriate.',
    category: 'Administrative Safeguards',
    guidance:
      'Implement role-based access provisioning tied to job responsibilities. Conduct background checks for roles with ePHI access. Document clearance decisions and approvals.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-3-iii',
    title: 'Workforce Security — Termination Procedures',
    description:
      'Implement procedures for terminating access to ePHI when the employment of, or other arrangement with, a workforce member ends.',
    category: 'Administrative Safeguards',
    guidance:
      'Revoke all ePHI system access on or before last day of employment. Include in offboarding checklist: SSO deprovisioning, badge deactivation, password resets for shared accounts. Audit within 48 hours of termination.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-4-i',
    title: 'Information Access Management — Isolating Healthcare Clearinghouse Functions',
    description:
      'If a healthcare clearinghouse is part of a larger organization, implement policies and procedures that protect ePHI from unauthorized access by the larger organization.',
    category: 'Administrative Safeguards',
    guidance:
      'Implement network segmentation between clearinghouse and other business functions. Enforce separate access controls. Document data flow boundaries.',
    weight: 2,
  },
  {
    code: 'HIPAA-308-a-4-ii-a',
    title: 'Information Access Management — Access Authorization',
    description:
      'Implement policies and procedures for granting access to ePHI, for example, through access to a workstation, transaction, program, process, or other mechanism.',
    category: 'Administrative Safeguards',
    guidance:
      'Require formal access request and approval workflows. Apply principle of least privilege. Review access grants at least quarterly.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-4-ii-b',
    title: 'Information Access Management — Access Establishment and Modification',
    description:
      'Implement policies and procedures that, based upon the covered entity\'s access authorization policies, establish, document, review, and modify a user\'s right of access to a workstation, transaction, program, or process.',
    category: 'Administrative Safeguards',
    guidance:
      'Maintain a formal access provisioning and de-provisioning process. Log all access changes. Align modifications to role changes, not informal requests.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-5-i',
    title: 'Security Awareness and Training — Security Reminders',
    description:
      'Implement periodic security updates to all members of its workforce.',
    category: 'Administrative Safeguards',
    guidance:
      'Send regular security bulletins or newsletters covering current threats relevant to ePHI. Document delivery and track acknowledgement.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-5-ii-a',
    title: 'Security Awareness and Training — Protection from Malicious Software',
    description:
      'Implement procedures for guarding against, detecting, and reporting malicious software.',
    category: 'Administrative Safeguards',
    guidance:
      'Deploy endpoint anti-malware on all systems accessing ePHI. Ensure definitions are updated automatically. Document detection and response procedures.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-5-ii-b',
    title: 'Security Awareness and Training — Log-in Monitoring',
    description:
      'Implement procedures for monitoring log-in attempts and reporting discrepancies.',
    category: 'Administrative Safeguards',
    guidance:
      'Enable failed login alerting. Alert on unusual login patterns (off-hours, geography, multiple failures). Review alerts within one business day.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-5-ii-c',
    title: 'Security Awareness and Training — Password Management',
    description:
      'Implement procedures for creating, changing, and safeguarding passwords.',
    category: 'Administrative Safeguards',
    guidance:
      'Enforce password complexity (min 12 chars, no common patterns). Require password changes after suspected compromise. Prohibit password sharing. Prefer MFA over passwords alone for ePHI access.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-6-i',
    title: 'Security Incident Procedures — Response and Reporting',
    description:
      'Identify and respond to suspected or known security incidents; mitigate, to the extent practicable, harmful effects of security incidents that are known to the covered entity; and document security incidents and their outcomes.',
    category: 'Administrative Safeguards',
    guidance:
      'Maintain a documented incident response plan specific to ePHI breaches. Define severity levels, containment steps, and HIPAA Breach Notification Rule triggers. Test the plan at least annually with a tabletop exercise.',
    weight: 5,
  },
  {
    code: 'HIPAA-308-a-7-i',
    title: 'Contingency Plan — Data Backup Plan',
    description:
      'Establish and implement procedures to create and maintain retrievable exact copies of ePHI.',
    category: 'Administrative Safeguards',
    guidance:
      'Implement automated, encrypted backups of all ePHI. Test restores at least quarterly. Store backups in a geographically separate location. Document RPO and RTO targets.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-7-ii',
    title: 'Contingency Plan — Disaster Recovery Plan',
    description:
      'Establish and implement procedures to restore any loss of data.',
    category: 'Administrative Safeguards',
    guidance:
      'Document a formal DRP covering ePHI systems. Include recovery steps, responsible parties, and success criteria. Test annually and after major infrastructure changes.',
    weight: 4,
  },
  {
    code: 'HIPAA-308-a-7-iii',
    title: 'Contingency Plan — Emergency Mode Operation Plan',
    description:
      'Establish and implement procedures to enable continuation of critical business processes for protection of the security of ePHI while operating in emergency mode.',
    category: 'Administrative Safeguards',
    guidance:
      'Define which ePHI processes are critical and must operate during an emergency. Document manual procedures, temporary access controls, and security monitoring during emergency operations.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-7-iv',
    title: 'Contingency Plan — Testing and Revision Procedures',
    description:
      'Implement procedures for periodic testing and revision of contingency plans.',
    category: 'Administrative Safeguards',
    guidance:
      'Schedule and document annual contingency plan exercises. Review and update plans after every test and after significant changes. Track open findings to closure.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-a-7-v',
    title: 'Contingency Plan — Applications and Data Criticality Analysis',
    description:
      'Assess the relative criticality of specific applications and data in support of other contingency plan components.',
    category: 'Administrative Safeguards',
    guidance:
      'Maintain a system inventory with criticality ratings. Prioritize recovery order based on ePHI criticality and patient care dependencies.',
    weight: 2,
  },
  {
    code: 'HIPAA-308-a-8',
    title: 'Evaluation',
    description:
      'Perform a periodic technical and nontechnical evaluation, based initially upon the standards implemented under the Security Rule and subsequently, in response to environmental or operations changes affecting the security of ePHI.',
    category: 'Administrative Safeguards',
    guidance:
      'Conduct formal security evaluations annually and after significant changes. Document evaluation scope, findings, and remediation. Engage external assessors for independent review at least every 2 years.',
    weight: 3,
  },
  {
    code: 'HIPAA-308-b-1',
    title: 'Business Associate Contracts and Other Arrangements',
    description:
      'A covered entity may permit a business associate to create, receive, maintain, or transmit ePHI on the covered entity\'s behalf only if the covered entity obtains satisfactory assurances that the BA will appropriately safeguard the information.',
    category: 'Administrative Safeguards',
    guidance:
      'Execute a HIPAA-compliant Business Associate Agreement (BAA) with every vendor who handles ePHI. Maintain a BA inventory. Review BAAs at least annually. Terminate arrangements with non-compliant BAs.',
    weight: 5,
  },

  // ── §164.310 Physical Safeguards ──────────────────────────────────────────

  {
    code: 'HIPAA-310-a-1',
    title: 'Facility Access Controls',
    description:
      'Implement policies and procedures to limit physical access to its electronic information systems and the facility or facilities in which they are housed, while ensuring that properly authorized access is allowed.',
    category: 'Physical Safeguards',
    guidance:
      'Restrict physical access to ePHI systems to authorized personnel only. Use badge access, visitor logs, and security cameras for sensitive areas. Review access logs monthly.',
    weight: 4,
  },
  {
    code: 'HIPAA-310-b',
    title: 'Workstation Use',
    description:
      'Implement policies and procedures that specify the proper functions to be performed, the manner in which those functions are to be performed, and the physical attributes of the surroundings of a specific workstation or class of workstation that can access ePHI.',
    category: 'Physical Safeguards',
    guidance:
      'Document approved workstation use policies for ePHI access. Require privacy screens in public areas. Prohibit use of personal devices for ePHI without MDM controls. Position workstations to prevent visual eavesdropping.',
    weight: 3,
  },
  {
    code: 'HIPAA-310-c',
    title: 'Workstation Security',
    description:
      'Implement physical safeguards for all workstations that access ePHI, to restrict access to authorized users.',
    category: 'Physical Safeguards',
    guidance:
      'Lock workstations after inactivity (max 15 minutes). Enable full-disk encryption on all workstations handling ePHI. Physically secure workstations with cable locks in shared spaces.',
    weight: 3,
  },
  {
    code: 'HIPAA-310-d',
    title: 'Device and Media Controls',
    description:
      'Implement policies and procedures that govern the receipt and removal of hardware and electronic media that contain ePHI into and out of a facility, and the movement of these items within the facility.',
    category: 'Physical Safeguards',
    guidance:
      'Maintain an inventory of all devices storing ePHI. Require secure data wiping or physical destruction before device disposal. Prohibit removal of ePHI-bearing media without approval. Document chain of custody.',
    weight: 4,
  },

  // ── §164.312 Technical Safeguards ─────────────────────────────────────────

  {
    code: 'HIPAA-312-a-1',
    title: 'Access Control — Unique User Identification',
    description:
      'Assign a unique name and/or number for identifying and tracking user identity and require users to authenticate when accessing ePHI systems.',
    category: 'Technical Safeguards',
    guidance:
      'Enforce unique user IDs across all ePHI systems — prohibit shared accounts. Implement SSO where possible to reduce credential sprawl. Audit for shared accounts quarterly.',
    weight: 4,
  },
  {
    code: 'HIPAA-312-a-2-i',
    title: 'Access Control — Emergency Access Procedure',
    description:
      'Establish and implement as needed procedures for obtaining necessary ePHI during an emergency.',
    category: 'Technical Safeguards',
    guidance:
      'Define "break-glass" emergency access procedures for ePHI systems. Log all emergency access events with justification. Review emergency access usage within 24 hours.',
    weight: 3,
  },
  {
    code: 'HIPAA-312-a-2-iii',
    title: 'Access Control — Automatic Logoff',
    description:
      'Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity.',
    category: 'Technical Safeguards',
    guidance:
      'Configure automatic session timeout on all applications and workstations handling ePHI (recommended: 15 minutes or less for clinical applications). Test timeout functionality as part of change management.',
    weight: 3,
  },
  {
    code: 'HIPAA-312-a-2-iv',
    title: 'Access Control — Encryption and Decryption',
    description:
      'Implement a mechanism to encrypt and decrypt ePHI.',
    category: 'Technical Safeguards',
    guidance:
      'Encrypt ePHI at rest using AES-256 or equivalent. Encrypt ePHI in transit using TLS 1.2+. Manage encryption keys separately from the data they protect. Document key management procedures.',
    weight: 5,
  },
  {
    code: 'HIPAA-312-b',
    title: 'Audit Controls',
    description:
      'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.',
    category: 'Technical Safeguards',
    guidance:
      'Enable and retain audit logs for all ePHI systems (minimum 6 years per HIPAA retention). Include: user ID, date/time, action, record accessed. Protect log integrity — prevent tampering. Review logs for anomalies regularly.',
    weight: 5,
  },
  {
    code: 'HIPAA-312-c-1',
    title: 'Integrity — Authentication',
    description:
      'Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.',
    category: 'Technical Safeguards',
    guidance:
      'Implement checksums or cryptographic hashes for ePHI data integrity verification. Use database transaction integrity controls. Alert on unauthorized modification attempts.',
    weight: 4,
  },
  {
    code: 'HIPAA-312-d',
    title: 'Person or Entity Authentication',
    description:
      'Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.',
    category: 'Technical Safeguards',
    guidance:
      'Require multi-factor authentication (MFA) for all remote access to ePHI systems and for all privileged access. Prefer hardware tokens or authenticator apps over SMS. Document MFA exceptions with risk acceptance.',
    weight: 5,
  },
  {
    code: 'HIPAA-312-e-1',
    title: 'Transmission Security — Integrity Controls',
    description:
      'Implement security measures to ensure that electronically transmitted ePHI is not improperly modified without detection until disposed of.',
    category: 'Technical Safeguards',
    guidance:
      'Use TLS 1.2+ for all ePHI transmissions. Implement digital signatures or MACs for ePHI data exchange where integrity verification is critical.',
    weight: 4,
  },
  {
    code: 'HIPAA-312-e-2',
    title: 'Transmission Security — Encryption',
    description:
      'Implement a mechanism to encrypt ePHI whenever deemed appropriate.',
    category: 'Technical Safeguards',
    guidance:
      'Encrypt all ePHI transmitted over public networks (mandatory). Encrypt internal transmissions whenever technically feasible. Prohibit sending ePHI via unencrypted email. Document approved transmission channels.',
    weight: 5,
  },

  // ── §164.314 Organizational Requirements ─────────────────────────────────

  {
    code: 'HIPAA-314-a-1',
    title: 'Business Associate Contracts — Required Elements',
    description:
      'A contract between a covered entity and a business associate must meet the requirements of §164.314(a)(2).',
    category: 'Organizational Requirements',
    guidance:
      'Ensure all BAAs contain the required HIPAA provisions: permitted uses and disclosures, obligation to use safeguards, reporting breaches, ensuring subcontractors comply, and return/destruction of PHI at termination. Use a reviewed template.',
    weight: 4,
  },
  {
    code: 'HIPAA-314-b-1',
    title: 'Requirements for Group Health Plans',
    description:
      'Ensure adequate separation between plan sponsor and group health plan ePHI access.',
    category: 'Organizational Requirements',
    guidance:
      'If applicable, implement plan document amendments specifying who can access ePHI and for what purposes. Ensure plan sponsor employees with ePHI access have appropriate controls and training.',
    weight: 2,
  },

  // ── §164.316 Policies and Procedures ─────────────────────────────────────

  {
    code: 'HIPAA-316-a',
    title: 'Policies and Procedures',
    description:
      'Implement reasonable and appropriate policies and procedures to comply with the standards, implementation specifications, and other requirements of the HIPAA Security Rule.',
    category: 'Policies and Procedures',
    guidance:
      'Maintain a complete set of HIPAA security policies. Policies must be reviewed and updated at least annually, or when operations or regulations change. All policies must be approved by senior management.',
    weight: 4,
  },
  {
    code: 'HIPAA-316-b-1',
    title: 'Documentation — Time Limit',
    description:
      'Retain the documentation required by the HIPAA Security Rule for 6 years from the date of its creation or the date when it last was in effect, whichever is later.',
    category: 'Policies and Procedures',
    guidance:
      'Implement a 6-year minimum document retention policy for all HIPAA security documentation. Include policies, risk analyses, incident reports, training records, BAAs, and audit logs. Use immutable storage where possible.',
    weight: 3,
  },
  {
    code: 'HIPAA-316-b-2',
    title: 'Documentation — Availability',
    description:
      'Make documentation available to those persons responsible for implementing the procedures to which the documentation pertains.',
    category: 'Policies and Procedures',
    guidance:
      'Publish HIPAA security policies and procedures in an accessible internal knowledge base. Track acknowledgement by relevant workforce members. Ensure policies are accessible during emergencies.',
    weight: 2,
  },
  {
    code: 'HIPAA-316-b-3',
    title: 'Documentation — Updates',
    description:
      'Review documentation periodically, and update as needed, in response to environmental or operational changes affecting the security of ePHI.',
    category: 'Policies and Procedures',
    guidance:
      'Schedule annual policy reviews. Trigger immediate reviews after: security incidents, significant technology changes, organizational restructuring, or regulatory updates. Document review history and version control.',
    weight: 3,
  },
];
