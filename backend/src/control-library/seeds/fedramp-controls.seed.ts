/**
 * FedRAMP — Control Seed Data
 * Source: NIST SP 800-53 Rev 5 control families as implemented in FedRAMP
 *         Moderate baseline (the most common commercial cloud authorization).
 *
 * Control families covered:
 *   AC  — Access Control
 *   AU  — Audit and Accountability
 *   CA  — Assessment, Authorization, and Monitoring
 *   CM  — Configuration Management
 *   IA  — Identification and Authentication
 *   IR  — Incident Response
 *   PL  — Planning
 *   RA  — Risk Assessment
 *   SA  — System and Services Acquisition
 *   SC  — System and Communications Protection
 *   SI  — System and Information Integrity
 */

export interface FedRampControlRecord {
  code:        string;
  title:       string;
  description: string;
  category:    string;
  guidance:    string;
  weight:      number;
}

export const FEDRAMP_CONTROLS: FedRampControlRecord[] = [

  // ── AC — Access Control ───────────────────────────────────────────────────

  {
    code: 'AC-1',
    title: 'Access Control Policy and Procedures',
    description:
      'Develop, document, and disseminate an access control policy that addresses purpose, scope, roles, responsibilities, management commitment, coordination among organizational entities, and compliance.',
    category: 'Access Control',
    guidance:
      'Maintain a formal access control policy reviewed annually. Document all access control procedures. Ensure the policy is approved by senior leadership and distributed to all relevant personnel.',
    weight: 3,
  },
  {
    code: 'AC-2',
    title: 'Account Management',
    description:
      'Manage system accounts including establishment, activation, modification, review, disabling, and removal. Establish conditions for group and role membership.',
    category: 'Access Control',
    guidance:
      'Implement a formal account lifecycle process (create, modify, disable, remove). Review accounts at least annually. Notify account managers when accounts are no longer needed. Automate de-provisioning where possible. Document all privileged account justifications.',
    weight: 5,
  },
  {
    code: 'AC-3',
    title: 'Access Enforcement',
    description:
      'Enforce approved authorizations for logical access to information and system resources in accordance with applicable access control policies.',
    category: 'Access Control',
    guidance:
      'Implement role-based access control (RBAC) across all system components. Enforce least privilege — grant only the minimum access required. Deny access by default. Log all access enforcement decisions.',
    weight: 5,
  },
  {
    code: 'AC-6',
    title: 'Least Privilege',
    description:
      'Employ the principle of least privilege, allowing only authorized accesses for users and processes which are necessary to accomplish assigned organizational tasks.',
    category: 'Access Control',
    guidance:
      'Restrict privileged accounts to the minimum needed. Prohibit users from using privileged accounts for non-privileged activities. Review privilege assignments quarterly. Implement just-in-time privileged access where possible.',
    weight: 5,
  },
  {
    code: 'AC-7',
    title: 'Unsuccessful Logon Attempts',
    description:
      'Enforce a limit of consecutive invalid logon attempts and automatically lock accounts after that limit is exceeded.',
    category: 'Access Control',
    guidance:
      'Configure account lockout after no more than 5 consecutive failed attempts. Lock accounts for at least 15 minutes or until administrator reset. Alert security team on repeated lockouts. Document lockout thresholds in the access control policy.',
    weight: 4,
  },
  {
    code: 'AC-11',
    title: 'Device Lock',
    description:
      'Prevent further access to the system by initiating a session lock after a period of inactivity.',
    category: 'Access Control',
    guidance:
      'Configure automatic session lock after 15 minutes or less of inactivity for all systems processing federal data. Require re-authentication to unlock. Apply to workstations, servers, and mobile devices.',
    weight: 3,
  },
  {
    code: 'AC-17',
    title: 'Remote Access',
    description:
      'Establish and document usage restrictions, configuration requirements, and implementation guidance for remote access, and authorize remote access prior to allowing such connections.',
    category: 'Access Control',
    guidance:
      'Require MFA for all remote access. Use VPN or equivalent encryption for all remote connections. Monitor remote access sessions. Revoke remote access immediately upon employment termination.',
    weight: 4,
  },
  {
    code: 'AC-22',
    title: 'Publicly Accessible Content',
    description:
      'Designate individuals authorized to post information onto publicly accessible systems. Review proposed content prior to posting. Review publicly accessible system content annually.',
    category: 'Access Control',
    guidance:
      'Establish a formal content approval process for any federal information posted publicly. Review all public content annually for accuracy and sensitivity. Remove non-public information immediately upon discovery.',
    weight: 2,
  },

  // ── AU — Audit and Accountability ─────────────────────────────────────────

  {
    code: 'AU-1',
    title: 'Audit and Accountability Policy and Procedures',
    description:
      'Develop, document, and disseminate an audit and accountability policy that addresses purpose, scope, roles, and responsibilities.',
    category: 'Audit and Accountability',
    guidance:
      'Maintain a formal audit policy defining what is logged, retention periods, and review responsibilities. Review annually. Cover all cloud service components including IaaS/PaaS layers.',
    weight: 3,
  },
  {
    code: 'AU-2',
    title: 'Event Logging',
    description:
      'Identify the types of events that the system is capable of logging and coordinate the event logging function with other organizations requiring audit-related information.',
    category: 'Audit and Accountability',
    guidance:
      'Log at minimum: user logins/logouts, privilege escalation, account changes, configuration changes, data access, failed access attempts, and security alerts. Coordinate audit requirements with the authorizing official.',
    weight: 4,
  },
  {
    code: 'AU-3',
    title: 'Content of Audit Records',
    description:
      'Ensure that audit records contain information that establishes what type of event occurred, when it occurred, where it occurred, the source of the event, the outcome, and the identity of individuals associated with the event.',
    category: 'Audit and Accountability',
    guidance:
      'Audit records must include: timestamp (UTC), event type, success/failure, user ID, source IP, affected resource, and correlation ID. Ensure all components emit logs in a consistent, parseable format.',
    weight: 4,
  },
  {
    code: 'AU-6',
    title: 'Audit Record Review, Analysis, and Reporting',
    description:
      'Review and analyze system audit records at a defined frequency for indications of inappropriate or unusual activity and report findings to designated officials.',
    category: 'Audit and Accountability',
    guidance:
      'Review audit logs weekly at minimum. Use automated analysis (SIEM) to detect anomalies. Report high-severity findings within 24 hours. Maintain a log review SOP. Preserve evidence for at least 3 years.',
    weight: 4,
  },
  {
    code: 'AU-9',
    title: 'Protection of Audit Information',
    description:
      'Protect audit information and tools from unauthorized access, modification, and deletion.',
    category: 'Audit and Accountability',
    guidance:
      'Store audit logs in a separate, hardened system with restricted write access. Enable tamper detection (cryptographic hashing or WORM storage). Restrict log access to security personnel only. Back up logs to immutable storage.',
    weight: 5,
  },
  {
    code: 'AU-12',
    title: 'Audit Record Generation',
    description:
      'Provide audit record generation capability for events defined in AU-2 at all system components and allow designated personnel to select which events are to be logged.',
    category: 'Audit and Accountability',
    guidance:
      'Ensure every system component (OS, middleware, application, database) generates audit records for the required event types. Centralize log collection. Verify completeness quarterly via sampling.',
    weight: 4,
  },

  // ── CA — Assessment, Authorization, and Monitoring ────────────────────────

  {
    code: 'CA-1',
    title: 'Assessment, Authorization, and Monitoring Policy and Procedures',
    description:
      'Develop, document, and disseminate an assessment, authorization, and monitoring policy addressing purpose, scope, roles, and responsibilities.',
    category: 'Assessment and Authorization',
    guidance:
      'Document the A&A process aligned to FedRAMP requirements. Define roles (AO, ISSO, CSP). Review policy annually. Ensure all cloud service offerings have a current ATO or are in the authorization pipeline.',
    weight: 3,
  },
  {
    code: 'CA-2',
    title: 'Control Assessments',
    description:
      'Develop a control assessment plan, assess controls to determine if they are implemented correctly, operating as intended, and producing desired outcomes.',
    category: 'Assessment and Authorization',
    guidance:
      'Conduct annual control assessments aligned to the FedRAMP SAP/SAR methodology. Engage a 3PAO for the annual assessment. Track all POA&M items to closure. Share assessment results with the JAB/agency AO.',
    weight: 5,
  },
  {
    code: 'CA-3',
    title: 'Information Exchange',
    description:
      'Approve and manage the exchange of information between the system and other systems using system interconnection agreements.',
    category: 'Assessment and Authorization',
    guidance:
      'Document all system interconnections in ISAs/MOUs. Inventory all APIs that exchange federal data. Apply the same controls to interconnected systems. Review and re-authorize interconnections annually.',
    weight: 4,
  },
  {
    code: 'CA-5',
    title: 'Plan of Action and Milestones',
    description:
      'Develop a plan of action and milestones (POA&M) for the system to document planned remedial actions to correct weaknesses or deficiencies noted during security assessments.',
    category: 'Assessment and Authorization',
    guidance:
      'Maintain an active POA&M in the FedRAMP-required format. Update monthly. Escalate high/critical findings for 30-day remediation target. Report status to AO at least quarterly.',
    weight: 5,
  },
  {
    code: 'CA-7',
    title: 'Continuous Monitoring',
    description:
      'Develop a continuous monitoring strategy that includes metrics, frequencies, assessments of security controls, monitoring of security controls, reporting, and response.',
    category: 'Assessment and Authorization',
    guidance:
      'Implement the FedRAMP ConMon program: monthly vulnerability scans, annual pen test, real-time log monitoring, monthly POA&M updates, and monthly reporting to AOs. Use the FedRAMP-provided ConMon templates.',
    weight: 5,
  },

  // ── CM — Configuration Management ────────────────────────────────────────

  {
    code: 'CM-1',
    title: 'Configuration Management Policy and Procedures',
    description:
      'Develop, document, and disseminate a configuration management policy that addresses purpose, scope, roles, and responsibilities.',
    category: 'Configuration Management',
    guidance:
      'Maintain a configuration management policy aligned to the FedRAMP baseline. Define the Change Control Board (CCB) process. Review annually.',
    weight: 3,
  },
  {
    code: 'CM-2',
    title: 'Baseline Configuration',
    description:
      'Develop, document, and maintain under configuration control a current baseline configuration of the information system.',
    category: 'Configuration Management',
    guidance:
      'Maintain documented baseline configurations for all system components. Use infrastructure-as-code. Verify configurations against baselines at least quarterly. Store baselines in version control.',
    weight: 4,
  },
  {
    code: 'CM-6',
    title: 'Configuration Settings',
    description:
      'Establish and document configuration settings for information technology products employed within the information system that reflect the most restrictive mode consistent with operational requirements.',
    category: 'Configuration Management',
    guidance:
      'Apply CIS Benchmarks or DISA STIGs for all cloud components. Enforce settings via IaC (Terraform, CloudFormation). Scan for configuration drift weekly. Remediate deviations within 30 days.',
    weight: 4,
  },
  {
    code: 'CM-7',
    title: 'Least Functionality',
    description:
      'Configure the information system to provide only essential capabilities. Prohibit or restrict the use of functions, ports, protocols, and services not required.',
    category: 'Configuration Management',
    guidance:
      'Disable all non-essential services, ports, and protocols. Maintain a whitelist of approved ports/services. Review and justify all open ports quarterly. Apply cloud security groups/NACLs to enforce restrictions.',
    weight: 4,
  },
  {
    code: 'CM-8',
    title: 'System Component Inventory',
    description:
      'Develop and document an inventory of system components that accurately reflects the current system and is at a level of granularity deemed necessary for tracking and reporting.',
    category: 'Configuration Management',
    guidance:
      'Maintain a current, accurate asset inventory including: hardware, software, cloud resources, APIs, and data stores. Update within 30 days of changes. Reconcile with FedRAMP SSP system boundary quarterly.',
    weight: 4,
  },

  // ── IA — Identification and Authentication ─────────────────────────────────

  {
    code: 'IA-1',
    title: 'Identification and Authentication Policy and Procedures',
    description:
      'Develop, document, and disseminate an identification and authentication policy addressing purpose, scope, roles, and responsibilities.',
    category: 'Identification and Authentication',
    guidance:
      'Maintain a formal I&A policy defining authentication requirements for all user types. Review annually. Cover both human and non-human accounts.',
    weight: 3,
  },
  {
    code: 'IA-2',
    title: 'Identification and Authentication (Organizational Users)',
    description:
      'Uniquely identify and authenticate organizational users and associate that unique identification with processes acting on behalf of those users.',
    category: 'Identification and Authentication',
    guidance:
      'Assign unique identifiers to all users — no shared accounts. Implement MFA for all non-privileged access to federal information systems. Require phishing-resistant MFA (PIV/FIDO2) for privileged access.',
    weight: 5,
  },
  {
    code: 'IA-3',
    title: 'Device Identification and Authentication',
    description:
      'Uniquely identify and authenticate devices before establishing connections.',
    category: 'Identification and Authentication',
    guidance:
      'Implement device certificates for all endpoints connecting to federal systems. Use network access control (NAC) to enforce device authentication. Maintain an inventory of authorized devices.',
    weight: 4,
  },
  {
    code: 'IA-5',
    title: 'Authenticator Management',
    description:
      'Manage system authenticators by verifying the identity of individuals before distributing authenticators, establishing administrative procedures for initial authenticator distribution, and establishing minimum and maximum lifetime restrictions.',
    category: 'Identification and Authentication',
    guidance:
      'Enforce minimum 15-character passwords with complexity requirements. Prohibit password reuse for 24 generations. Rotate credentials for privileged accounts every 90 days. Store passwords using PBKDF2, bcrypt, or Argon2. Issue MFA tokens via a secure, verified process.',
    weight: 5,
  },
  {
    code: 'IA-8',
    title: 'Identification and Authentication (Non-Organizational Users)',
    description:
      'Uniquely identify and authenticate non-organizational users (or processes acting on behalf of non-organizational users).',
    category: 'Identification and Authentication',
    guidance:
      'Authenticate all external users before granting access to federal systems. Federate with approved identity providers (Login.gov, MAX.gov). Apply the same MFA requirements as organizational users for access to sensitive data.',
    weight: 4,
  },

  // ── IR — Incident Response ─────────────────────────────────────────────────

  {
    code: 'IR-1',
    title: 'Incident Response Policy and Procedures',
    description:
      'Develop, document, and disseminate an incident response policy and procedures that address purpose, scope, roles, and responsibilities.',
    category: 'Incident Response',
    guidance:
      'Maintain a FedRAMP-compliant IRP. Include escalation paths to US-CERT and the authorizing agency. Review and test annually. Ensure the IRP covers cloud-specific incident scenarios.',
    weight: 3,
  },
  {
    code: 'IR-4',
    title: 'Incident Handling',
    description:
      'Implement an incident handling capability that includes preparation, detection and analysis, containment, eradication, and recovery. Coordinate incident handling activities with contingency planning activities.',
    category: 'Incident Response',
    guidance:
      'Implement a documented incident lifecycle process. Notify US-CERT within 1 hour of confirmed incidents. Report to the authorizing agency within 1 hour for major incidents, 24 hours for significant incidents. Maintain forensic evidence. Conduct post-incident reviews.',
    weight: 5,
  },
  {
    code: 'IR-5',
    title: 'Incident Monitoring',
    description:
      'Track and document information system security incidents.',
    category: 'Incident Response',
    guidance:
      'Maintain an incident tracking system with full audit trail. Record incident timelines, evidence, actions taken, and outcomes. Submit monthly incident reports to the AO. Retain incident records for at least 3 years.',
    weight: 4,
  },
  {
    code: 'IR-6',
    title: 'Incident Reporting',
    description:
      'Require personnel to report suspected security incidents to the organizational incident response capability within a defined time period.',
    category: 'Incident Response',
    guidance:
      'Require all workforce to report suspected incidents within 1 hour of awareness. Provide multiple reporting channels (hotline, ticketing system, email). Train all staff on incident recognition and reporting procedures.',
    weight: 4,
  },
  {
    code: 'IR-8',
    title: 'Incident Response Plan',
    description:
      'Develop an incident response plan that provides organizational personnel with guidance on how to respond to incidents.',
    category: 'Incident Response',
    guidance:
      'Develop a comprehensive IRP including: organizational structure for incident response, roadmap for implementing IR capability, metrics for measuring effectiveness, and plan for maintaining IR capability. Test annually with a tabletop exercise. Review after every significant incident.',
    weight: 5,
  },

  // ── PL — Planning ─────────────────────────────────────────────────────────

  {
    code: 'PL-1',
    title: 'Planning Policy and Procedures',
    description:
      'Develop, document, and disseminate a security planning policy that addresses purpose, scope, roles, responsibilities, and compliance.',
    category: 'Planning',
    guidance:
      'Maintain a security planning policy aligned to FedRAMP requirements. Review annually. Coordinate with the agency CISO and AO.',
    weight: 2,
  },
  {
    code: 'PL-2',
    title: 'System Security and Privacy Plans',
    description:
      'Develop security and privacy plans for the system that describe the security and privacy controls in place or planned for the system.',
    category: 'Planning',
    guidance:
      'Maintain a current System Security Plan (SSP) using the FedRAMP SSP template. Update within 30 days of system changes. Include all required FedRAMP sections: system description, boundary, data flows, and all control implementations. Submit updates to AO for review.',
    weight: 5,
  },

  // ── RA — Risk Assessment ──────────────────────────────────────────────────

  {
    code: 'RA-1',
    title: 'Risk Assessment Policy and Procedures',
    description:
      'Develop, document, and disseminate a risk assessment policy that addresses purpose, scope, roles, and responsibilities.',
    category: 'Risk Assessment',
    guidance:
      'Maintain a risk assessment policy defining the methodology, frequency, and roles. Review annually.',
    weight: 2,
  },
  {
    code: 'RA-3',
    title: 'Risk Assessment',
    description:
      "Conduct a risk assessment, including the likelihood and magnitude of harm, from the unauthorized access, use, disclosure, disruption, modification, or destruction of the organization's operations.",
    category: 'Risk Assessment',
    guidance:
      'Conduct formal risk assessments at least annually and after significant system changes. Use the FedRAMP risk rating methodology (Critical/High/Moderate/Low). Document the risk register and track remediation. Brief results to the AO.',
    weight: 5,
  },
  {
    code: 'RA-5',
    title: 'Vulnerability Monitoring and Scanning',
    description:
      'Monitor and scan for vulnerabilities in the system and hosted applications at a defined frequency and when new vulnerabilities are identified.',
    category: 'Risk Assessment',
    guidance:
      'Conduct authenticated vulnerability scans monthly for operating systems and web applications. Use FedRAMP-approved scanning tools. Remediate Critical findings within 30 days, High within 90 days. Include scan results in monthly ConMon reporting to AOs.',
    weight: 5,
  },

  // ── SA — System and Services Acquisition ─────────────────────────────────

  {
    code: 'SA-1',
    title: 'System and Services Acquisition Policy and Procedures',
    description:
      'Develop, document, and disseminate an acquisition policy that addresses purpose, scope, roles, and responsibilities.',
    category: 'System and Services Acquisition',
    guidance:
      'Maintain an acquisition policy that requires security reviews for all new systems and services. Review annually.',
    weight: 2,
  },
  {
    code: 'SA-9',
    title: 'External System Services',
    description:
      'Require that providers of external system services comply with organizational security requirements and employ security controls in accordance with applicable federal laws, Executive Orders, and policies.',
    category: 'System and Services Acquisition',
    guidance:
      'Ensure all external service providers used in the FedRAMP boundary have their own FedRAMP authorization or equivalent. Include security requirements in contracts. Monitor external provider compliance annually.',
    weight: 4,
  },

  // ── SC — System and Communications Protection ─────────────────────────────

  {
    code: 'SC-1',
    title: 'System and Communications Protection Policy and Procedures',
    description:
      'Develop, document, and disseminate a system and communications protection policy addressing purpose, scope, roles, and responsibilities.',
    category: 'System and Communications Protection',
    guidance:
      'Maintain a communications protection policy covering encryption, network segmentation, and data-in-transit standards. Review annually.',
    weight: 2,
  },
  {
    code: 'SC-7',
    title: 'Boundary Protection',
    description:
      'Monitor and control communications at the external boundary of the system and at key internal boundaries; implement subnetworks for publicly accessible system components.',
    category: 'System and Communications Protection',
    guidance:
      'Implement firewalls, WAF, and intrusion detection at all boundary points. Use cloud security groups to enforce network segmentation. Separate public-facing components from internal systems. Document all boundary protection mechanisms in the SSP.',
    weight: 5,
  },
  {
    code: 'SC-8',
    title: 'Transmission Confidentiality and Integrity',
    description:
      'Implement cryptographic mechanisms to prevent unauthorized disclosure of information and to detect changes to information during transmission.',
    category: 'System and Communications Protection',
    guidance:
      'Enforce TLS 1.2+ (TLS 1.3 preferred) for all data in transit. Disable SSL and early TLS. Use FIPS 140-2 validated cryptographic modules for federal data. Implement certificate management processes including rotation.',
    weight: 5,
  },
  {
    code: 'SC-12',
    title: 'Cryptographic Key Establishment and Management',
    description:
      'Establish and manage cryptographic keys when cryptography is employed within the information system in accordance with federal laws, Executive Orders, and policies.',
    category: 'System and Communications Protection',
    guidance:
      'Use FIPS 140-2 validated key management solutions. Implement a formal key lifecycle (generation, distribution, storage, rotation, destruction). Rotate encryption keys at least annually. Store keys separately from the data they protect.',
    weight: 5,
  },
  {
    code: 'SC-28',
    title: 'Protection of Information at Rest',
    description:
      'Implement cryptographic mechanisms to prevent unauthorized disclosure and modification of information at rest.',
    category: 'System and Communications Protection',
    guidance:
      'Encrypt all federal data at rest using FIPS 140-2 validated AES-256. Apply to databases, file systems, backups, and logs. Manage encryption keys via a dedicated key management service (AWS KMS, Azure Key Vault).',
    weight: 5,
  },

  // ── SI — System and Information Integrity ────────────────────────────────

  {
    code: 'SI-1',
    title: 'System and Information Integrity Policy and Procedures',
    description:
      'Develop, document, and disseminate a system and information integrity policy addressing purpose, scope, roles, and responsibilities.',
    category: 'System and Information Integrity',
    guidance:
      'Maintain an integrity policy covering malware protection, software updates, and monitoring. Review annually.',
    weight: 2,
  },
  {
    code: 'SI-2',
    title: 'Flaw Remediation',
    description:
      'Identify, report, and correct information system flaws. Test software updates before installation. Install security-relevant software updates within a defined time period.',
    category: 'System and Information Integrity',
    guidance:
      'Remediate Critical vulnerabilities within 30 days, High within 90 days, Moderate within 180 days. Track all open vulnerabilities in the POA&M. Test patches in non-production before deployment. Document all patch actions.',
    weight: 5,
  },
  {
    code: 'SI-3',
    title: 'Malicious Code Protection',
    description:
      'Implement malicious code protection mechanisms at information system entry and exit points to detect and eradicate malicious code.',
    category: 'System and Information Integrity',
    guidance:
      'Deploy EDR/anti-malware on all endpoints and servers. Configure automatic signature updates. Scan all ingested files and executables. Alert on malware detection within 1 hour. Integrate malware alerts with the SIEM.',
    weight: 5,
  },
  {
    code: 'SI-4',
    title: 'System Monitoring',
    description:
      'Monitor the information system to detect attacks and indicators of potential attacks, and unauthorized local, network, and remote connections.',
    category: 'System and Information Integrity',
    guidance:
      'Deploy IDS/IPS at all network boundaries. Implement SIEM for centralized security event monitoring. Define use cases for attack detection aligned to the MITRE ATT&CK framework. Alert on suspicious activity within 15 minutes.',
    weight: 5,
  },
  {
    code: 'SI-12',
    title: 'Information Management and Retention',
    description:
      'Manage and retain information within the system and information output from the system in accordance with applicable federal laws, Executive Orders, and agency policies.',
    category: 'System and Information Integrity',
    guidance:
      'Define and enforce data retention schedules aligned to NARA and agency-specific requirements. Implement automated lifecycle management for federal data. Ensure secure deletion of data at end of retention period. Document retention schedules in the SSP.',
    weight: 3,
  },
];
