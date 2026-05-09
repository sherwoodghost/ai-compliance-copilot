/**
 * NIST Cybersecurity Framework 2.0 — Control Seeds
 *
 * Based on NIST CSF 2.0 (February 2024), organized by the 6 core Functions:
 *   GV — Govern   (new in CSF 2.0)
 *   ID — Identify
 *   PR — Protect
 *   DE — Detect
 *   RS — Respond
 *   RC — Recover
 *
 * Controls follow the category.subcategory numbering (e.g. GV.OC-01).
 */

export interface NistCsfControlRecord {
  code:        string;
  title:       string;
  description: string;
  category:    string;
  guidance:    string;
  weight:      number;
}

export const NIST_CSF_CONTROLS: NistCsfControlRecord[] = [

  // ── GV — GOVERN ─────────────────────────────────────────────────────────────

  {
    code: 'GV.OC-01',
    title: 'Organizational Mission and Cybersecurity',
    description:
      'The organizational mission is understood and informs cybersecurity risk management.',
    category: 'Govern',
    guidance:
      'Ensure cybersecurity strategy is aligned with the organizational mission. Document how cybersecurity supports business objectives. Review and update alignment annually.',
    weight: 3,
  },
  {
    code: 'GV.OC-02',
    title: 'Internal and External Stakeholder Needs',
    description:
      'Internal and external stakeholder cybersecurity needs, expectations, and requirements are understood and considered when developing cybersecurity policy.',
    category: 'Govern',
    guidance:
      'Identify and document key stakeholders (customers, regulators, partners, board). Gather their cybersecurity requirements. Use this to shape your security program priorities.',
    weight: 2,
  },
  {
    code: 'GV.RM-01',
    title: 'Risk Management Strategy',
    description:
      'Risk management objectives are established and agreed upon by organizational stakeholders.',
    category: 'Govern',
    guidance:
      'Establish a formal risk management strategy with defined risk appetite and tolerance. Get executive sign-off. Review annually and after significant events.',
    weight: 5,
  },
  {
    code: 'GV.RM-02',
    title: 'Risk Appetite and Tolerance',
    description:
      'Risk tolerance and appetite statements are established, communicated, and maintained.',
    category: 'Govern',
    guidance:
      'Define quantitative and qualitative risk tolerance thresholds for different risk categories. Communicate to all control owners and risk owners. Revisit when business context changes.',
    weight: 4,
  },
  {
    code: 'GV.RM-03',
    title: 'Cybersecurity Risk Integration',
    description:
      'Cybersecurity risk management activities and outcomes are included in enterprise risk management processes.',
    category: 'Govern',
    guidance:
      'Integrate cybersecurity risks into the enterprise risk register. Report cybersecurity risk posture alongside financial and operational risks at the board level.',
    weight: 4,
  },
  {
    code: 'GV.RR-01',
    title: 'Organizational Leadership Accountability',
    description:
      'Organizational leadership is responsible and accountable for cybersecurity risk and fosters a culture that is risk-aware, ethical, and continually improving.',
    category: 'Govern',
    guidance:
      'Document cybersecurity accountabilities at the board, C-suite, and leadership level. Include cybersecurity responsibilities in executive job descriptions and performance reviews.',
    weight: 4,
  },
  {
    code: 'GV.RR-02',
    title: 'Cybersecurity Roles and Responsibilities',
    description:
      'Roles, responsibilities, and authorities for cybersecurity risk management are established, communicated, understood, and enforced.',
    category: 'Govern',
    guidance:
      'Maintain a RACI for cybersecurity roles. Define CISO/security team responsibilities clearly. Communicate roles to all staff. Review after organizational changes.',
    weight: 4,
  },
  {
    code: 'GV.PO-01',
    title: 'Cybersecurity Policy',
    description:
      'Cybersecurity policy is established based on organizational context, cybersecurity strategy, and priorities and is communicated and enforced.',
    category: 'Govern',
    guidance:
      'Maintain a comprehensive information security policy approved by leadership. Include sub-policies for key domains (access control, data protection, incident response). Review annually.',
    weight: 5,
  },
  {
    code: 'GV.PO-02',
    title: 'Policy Review and Update',
    description:
      'Cybersecurity policies are reviewed, updated, communicated, and enforced to reflect changes in requirements, threats, technology, and organizational mission.',
    category: 'Govern',
    guidance:
      'Implement a policy review schedule (minimum annual). Track policy versions. Notify affected staff of changes. Capture acknowledgement. Update after significant incidents or regulatory changes.',
    weight: 3,
  },
  {
    code: 'GV.SC-01',
    title: 'Cybersecurity Supply Chain Risk Management',
    description:
      'A cybersecurity supply chain risk management program, strategy, objectives, policies, and processes are established and agreed to by organizational stakeholders.',
    category: 'Govern',
    guidance:
      'Establish a vendor/supplier risk management program. Define criteria for assessing third-party cybersecurity posture. Include supply chain risk in the overall risk register.',
    weight: 4,
  },

  // ── ID — IDENTIFY ────────────────────────────────────────────────────────────

  {
    code: 'ID.AM-01',
    title: 'Hardware Asset Inventory',
    description:
      'Inventories of hardware managed by the organization are maintained.',
    category: 'Identify',
    guidance:
      'Maintain a complete, up-to-date hardware asset inventory. Include servers, workstations, network devices, mobile devices. Use automated discovery tools where possible. Review quarterly.',
    weight: 5,
  },
  {
    code: 'ID.AM-02',
    title: 'Software Asset Inventory',
    description:
      'Inventories of software, services, and systems managed by the organization are maintained.',
    category: 'Identify',
    guidance:
      'Maintain a software asset inventory covering all installed applications, cloud services, and SaaS tools. Include version numbers, license status, and criticality ratings.',
    weight: 5,
  },
  {
    code: 'ID.AM-03',
    title: 'Network Asset Representation',
    description:
      'Representations of the organization\'s authorized network communication and internal and external network data flows are maintained.',
    category: 'Identify',
    guidance:
      'Maintain up-to-date network diagrams and data flow diagrams. Document all ingress/egress points, third-party connections, and cloud connectivity. Review after infrastructure changes.',
    weight: 4,
  },
  {
    code: 'ID.AM-07',
    title: 'Data Asset Inventory',
    description:
      'Inventories of data and corresponding metadata for designated data types are maintained.',
    category: 'Identify',
    guidance:
      'Create and maintain a data inventory covering sensitive data types (PII, PHI, financial). Document storage locations, data flows, retention periods, and data owners.',
    weight: 5,
  },
  {
    code: 'ID.RA-01',
    title: 'Vulnerability Identification',
    description:
      'Vulnerabilities in assets are identified, validated, and recorded.',
    category: 'Identify',
    guidance:
      'Run vulnerability scans on all in-scope assets at least monthly. Use authenticated scans where possible. Track all discovered vulnerabilities in a remediation register with severity ratings.',
    weight: 5,
  },
  {
    code: 'ID.RA-02',
    title: 'Threat Intelligence Integration',
    description:
      'Cyber threat intelligence is received from information sharing forums and sources.',
    category: 'Identify',
    guidance:
      'Subscribe to relevant threat intelligence feeds (ISACs, CISA alerts, vendor advisories). Operationalize threat intelligence by mapping threats to your specific technology stack.',
    weight: 3,
  },
  {
    code: 'ID.RA-05',
    title: 'Threats, Vulnerabilities, Likelihoods, and Impacts',
    description:
      'Threats, vulnerabilities, likelihoods, and impacts are used to understand inherent and residual cybersecurity risk.',
    category: 'Identify',
    guidance:
      'Conduct formal risk assessments that combine threat data, vulnerability data, and impact analysis. Use a consistent risk scoring methodology. Document inherent vs residual risk after controls.',
    weight: 5,
  },
  {
    code: 'ID.IM-01',
    title: 'Improvement Plan Based on Assessments',
    description:
      'Improvements are identified from evaluations — including tests, exercises, incidents, and assessments.',
    category: 'Identify',
    guidance:
      'Conduct regular assessments (internal audits, penetration tests, tabletop exercises). Capture findings in an improvement plan. Track remediation to closure. Report progress to leadership.',
    weight: 4,
  },

  // ── PR — PROTECT ─────────────────────────────────────────────────────────────

  {
    code: 'PR.AA-01',
    title: 'User Identities and Credentials',
    description:
      'Identities and credentials for authorized users, services, and hardware are managed by the organization.',
    category: 'Protect',
    guidance:
      'Maintain a directory of all user and service accounts. Use an Identity Provider (IdP) as the single source of truth. Implement lifecycle management — provisioning, modification, and deprovisioning.',
    weight: 5,
  },
  {
    code: 'PR.AA-02',
    title: 'Identity Proofing and Binding',
    description:
      'Identities are proofed and bound to credentials based on the context of interactions.',
    category: 'Protect',
    guidance:
      'Implement identity proofing appropriate to the risk level of the system. Use strong authentication for privileged access. Bind credentials to verified identities before provisioning access.',
    weight: 4,
  },
  {
    code: 'PR.AA-03',
    title: 'Multi-Factor Authentication',
    description:
      'Users, services, and hardware are authenticated.',
    category: 'Protect',
    guidance:
      'Enforce MFA for all user accounts, especially privileged accounts and remote access. Use phishing-resistant MFA (FIDO2/WebAuthn) for high-risk access. Document MFA coverage and exceptions.',
    weight: 5,
  },
  {
    code: 'PR.AA-05',
    title: 'Access Permissions and Authorizations',
    description:
      'Access permissions, entitlements, and authorizations are defined in a policy, managed, enforced, and reviewed to cover the principles of least privilege and separation of duties.',
    category: 'Protect',
    guidance:
      'Implement least-privilege access. Define roles and assign minimum necessary permissions. Review access entitlements quarterly. Enforce separation of duties for critical functions.',
    weight: 5,
  },
  {
    code: 'PR.AT-01',
    title: 'Security Awareness Training',
    description:
      'Personnel are provided with awareness and training so they possess the knowledge and skills to perform general tasks with cybersecurity risks in mind.',
    category: 'Protect',
    guidance:
      'Deliver security awareness training to all staff annually (minimum). Include phishing simulations. Track completion. Provide role-specific training for IT, developers, and executives.',
    weight: 4,
  },
  {
    code: 'PR.DS-01',
    title: 'Data at Rest Protection',
    description:
      'The confidentiality, integrity, and availability of data-at-rest are protected.',
    category: 'Protect',
    guidance:
      'Encrypt sensitive data at rest using AES-256 or equivalent. Manage encryption keys securely (KMS). Apply protections based on data classification. Verify encryption is active on all sensitive stores.',
    weight: 5,
  },
  {
    code: 'PR.DS-02',
    title: 'Data in Transit Protection',
    description:
      'The confidentiality, integrity, and availability of data-in-transit are protected.',
    category: 'Protect',
    guidance:
      'Enforce TLS 1.2+ for all data in transit. Disable insecure protocols (TLS 1.0, 1.1, SSLv3). Use certificate pinning for critical mobile and API connections. Monitor for unencrypted transmissions.',
    weight: 5,
  },
  {
    code: 'PR.DS-10',
    title: 'Data Integrity',
    description:
      'The integrity of data is protected.',
    category: 'Protect',
    guidance:
      'Implement integrity controls such as checksums, digital signatures, or hashing for critical data. Detect unauthorized modifications. Log all data modification events for sensitive records.',
    weight: 3,
  },
  {
    code: 'PR.PS-01',
    title: 'Configuration Management',
    description:
      'Configuration management practices are established and applied.',
    category: 'Protect',
    guidance:
      'Define and enforce secure baseline configurations for all asset types. Use configuration management tools (Ansible, Terraform, Group Policy). Detect and alert on configuration drift.',
    weight: 4,
  },
  {
    code: 'PR.PS-02',
    title: 'Software Maintenance',
    description:
      'Software is maintained, replaced, and removed commensurate with risk.',
    category: 'Protect',
    guidance:
      'Maintain a patching program with defined SLAs by severity (Critical: 24h, High: 7d, Medium: 30d). Track patch status. Decommission unsupported software. Use automated patching where feasible.',
    weight: 5,
  },
  {
    code: 'PR.PS-04',
    title: 'Log Generation',
    description:
      'Logs of events are generated and made available for continuous monitoring.',
    category: 'Protect',
    guidance:
      'Enable comprehensive logging on all systems (OS, application, network, cloud). Forward logs to a centralized SIEM. Define minimum log retention (90 days hot, 1 year cold). Protect logs from tampering.',
    weight: 5,
  },
  {
    code: 'PR.IR-01',
    title: 'Network Integrity Protection',
    description:
      'Networks and environments are protected from unauthorized logical access and usage.',
    category: 'Protect',
    guidance:
      'Segment networks by trust zone. Use firewalls, security groups, and NACLs to enforce boundaries. Implement zero-trust principles for sensitive segments. Review firewall rules quarterly.',
    weight: 5,
  },

  // ── DE — DETECT ──────────────────────────────────────────────────────────────

  {
    code: 'DE.CM-01',
    title: 'Network Monitoring',
    description:
      'Networks and network services are monitored to find potentially adverse events.',
    category: 'Detect',
    guidance:
      'Deploy network monitoring tools (IDS/IPS, NDR). Monitor for anomalous traffic patterns, unauthorized connections, and data exfiltration indicators. Alert on deviations from baseline.',
    weight: 5,
  },
  {
    code: 'DE.CM-02',
    title: 'Physical Environment Monitoring',
    description:
      'The physical environment is monitored to find potentially adverse events.',
    category: 'Detect',
    guidance:
      'Monitor physical access to server rooms and data centers. Use badge readers and CCTV. Alert on unauthorized physical access attempts. Review physical access logs monthly.',
    weight: 3,
  },
  {
    code: 'DE.CM-03',
    title: 'User Activity Monitoring',
    description:
      'Personnel activity and technology usage are monitored to find potentially adverse events.',
    category: 'Detect',
    guidance:
      'Monitor user activity, especially for privileged accounts. Use UEBA tools to detect anomalous behavior. Review logs for policy violations, data exfiltration attempts, and credential abuse.',
    weight: 4,
  },
  {
    code: 'DE.CM-06',
    title: 'External Service Provider Activity Monitoring',
    description:
      'External service provider activities and services are monitored to find potentially adverse events.',
    category: 'Detect',
    guidance:
      'Monitor third-party access to your systems. Review vendor activity logs. Require vendors to notify you of security incidents affecting your data. Audit vendor access quarterly.',
    weight: 3,
  },
  {
    code: 'DE.CM-09',
    title: 'Vulnerability Monitoring',
    description:
      'Computing hardware and software, runtime environments, and their data are monitored to find potentially adverse events.',
    category: 'Detect',
    guidance:
      'Run continuous vulnerability scanning. Subscribe to vulnerability disclosure feeds for your technology stack. Monitor for new CVEs affecting deployed software. Correlate with asset inventory.',
    weight: 5,
  },
  {
    code: 'DE.AE-02',
    title: 'Potentially Adverse Events Analysis',
    description:
      'Potentially adverse events are analyzed to better characterize the events and detect cybersecurity incidents.',
    category: 'Detect',
    guidance:
      'Establish processes to analyze suspicious events and determine if they constitute incidents. Use correlation rules in your SIEM. Define escalation thresholds. Document analysis decisions.',
    weight: 4,
  },
  {
    code: 'DE.AE-06',
    title: 'Information Sharing',
    description:
      'Information on adverse events is provided to authorized staff and tools.',
    category: 'Detect',
    guidance:
      'Define who receives security alerts and how quickly. Ensure security events reach the right responders within defined timeframes. Integrate alert routing with your incident management system.',
    weight: 3,
  },

  // ── RS — RESPOND ─────────────────────────────────────────────────────────────

  {
    code: 'RS.MA-01',
    title: 'Incident Response Plan Execution',
    description:
      'The incident response plan is executed in coordination with relevant third parties once an incident is declared.',
    category: 'Respond',
    guidance:
      'Maintain and test an incident response plan covering detection, triage, containment, eradication, and recovery. Conduct tabletop exercises at least annually. Include third-party contacts.',
    weight: 5,
  },
  {
    code: 'RS.MA-02',
    title: 'Incident Reporting',
    description:
      'Incidents are reported to appropriate internal and external stakeholders in a timely manner.',
    category: 'Respond',
    guidance:
      'Define incident reporting requirements including internal escalation paths and external notification obligations (regulators, affected individuals). Track SLAs for required notifications.',
    weight: 4,
  },
  {
    code: 'RS.AN-03',
    title: 'Analysis to Establish Recovery Goals',
    description:
      'Analysis is performed to establish what has taken place during an incident and the root cause of the incident.',
    category: 'Respond',
    guidance:
      'Perform thorough root cause analysis for all significant incidents. Document a timeline of events, affected systems, data impacted, and the root cause. Use findings to prevent recurrence.',
    weight: 4,
  },
  {
    code: 'RS.CO-02',
    title: 'Internal Coordination During Incidents',
    description:
      'Personnel know their roles and order of operations when a response is needed.',
    category: 'Respond',
    guidance:
      'Define and document incident response roles (Incident Commander, Communications Lead, Technical Lead). Ensure all IRT members know their responsibilities. Test via exercises.',
    weight: 4,
  },
  {
    code: 'RS.MI-01',
    title: 'Incident Containment',
    description:
      'Incidents are contained.',
    category: 'Respond',
    guidance:
      'Define containment strategies for different incident types (isolate systems, revoke credentials, block IPs, disable accounts). Pre-authorize containment actions so responders can act quickly.',
    weight: 5,
  },
  {
    code: 'RS.MI-02',
    title: 'Incident Eradication',
    description:
      'Incidents are eradicated.',
    category: 'Respond',
    guidance:
      'Define eradication procedures for each incident type. Remove malware, close attack vectors, patch vulnerabilities, reset compromised credentials. Verify eradication before recovery.',
    weight: 5,
  },

  // ── RC — RECOVER ─────────────────────────────────────────────────────────────

  {
    code: 'RC.RP-01',
    title: 'Recovery Plan Execution',
    description:
      'The recovery portion of the incident response plan is executed once the threat has been eradicated.',
    category: 'Recover',
    guidance:
      'Maintain recovery runbooks for each critical system. Define RTO and RPO targets. Test recovery procedures through tabletop exercises and periodic restore drills.',
    weight: 5,
  },
  {
    code: 'RC.RP-02',
    title: 'Recovery Plan Validation',
    description:
      'Recovery actions are selected, scoped, prioritized, and performed.',
    category: 'Recover',
    guidance:
      'Prioritize recovery based on system criticality and business impact. Validate that restored systems are clean and functional before returning to production. Document recovery steps taken.',
    weight: 4,
  },
  {
    code: 'RC.CO-03',
    title: 'Recovery Activities Communication',
    description:
      'Recovery activities and progress in restoring operational capabilities are communicated to designated internal and external stakeholders.',
    category: 'Recover',
    guidance:
      'Communicate recovery status to stakeholders throughout the recovery process. Define update frequency and content. Notify customers and partners when services are restored.',
    weight: 3,
  },
  {
    code: 'RC.RP-04',
    title: 'Restoration of Capabilities',
    description:
      'The integrity of restored assets is verified, systems and services are restored, and normal operating status is confirmed and documented.',
    category: 'Recover',
    guidance:
      'Verify system integrity before restoring to production (file integrity checks, vulnerability scans). Confirm normal operation with stakeholders. Document the incident closure and lessons learned.',
    weight: 4,
  },
  {
    code: 'RC.RP-05',
    title: 'Recovery Plan Update',
    description:
      'The incident recovery plan and related organizational processes are updated based on lessons learned.',
    category: 'Recover',
    guidance:
      'Conduct a post-incident review after every significant event. Update recovery plans based on what worked and what did not. Share lessons learned with the broader security team.',
    weight: 4,
  },
];
