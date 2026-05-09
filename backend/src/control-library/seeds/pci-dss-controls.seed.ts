/**
 * PCI DSS v4.0 — Control Seed Data
 * Source: Payment Card Industry Data Security Standard, Version 4.0 (March 2022)
 *
 * Covers all 12 Requirements organized by PCI DSS domain groups:
 *   Build and Maintain a Secure Network        Req 1–2
 *   Protect Account Data                       Req 3–4
 *   Maintain a Vulnerability Management Program Req 5–6
 *   Implement Strong Access Control Measures   Req 7–9
 *   Regularly Monitor and Test Networks        Req 10–11
 *   Maintain an Information Security Policy    Req 12
 */

export interface PciControlRecord {
  code:        string;
  title:       string;
  description: string;
  category:    string;
  guidance:    string;
  weight:      number;
}

export const PCI_DSS_CONTROLS: PciControlRecord[] = [

  // ── Requirement 1: Install and Maintain Network Security Controls ──────────

  {
    code: 'PCI-1.1',
    title: 'Processes and Mechanisms for Network Security Controls Are Defined',
    description:
      'All security policies and operational procedures for managing network security controls are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Network Security Controls',
    guidance:
      'Maintain documented network security policies. Review and update at least once every 12 months. Ensure all relevant personnel are aware of current policies.',
    weight: 3,
  },
  {
    code: 'PCI-1.2',
    title: 'Network Security Controls Are Configured and Maintained',
    description:
      'Restrict inbound and outbound traffic to only that which is necessary, and deny all other traffic. Network security controls must be reviewed at least once every six months.',
    category: 'Network Security Controls',
    guidance:
      'Implement firewalls with deny-all default posture. Document all firewall rule justifications with owner and business justification. Review all rules semi-annually and remove unnecessary rules. Apply to all CDE-connected networks.',
    weight: 5,
  },
  {
    code: 'PCI-1.3',
    title: 'Network Access Controls Between Trusted and Untrusted Networks',
    description:
      'Restrict inbound and outbound traffic to only that which is necessary for the cardholder data environment, and specifically deny all other traffic.',
    category: 'Network Security Controls',
    guidance:
      'Implement a DMZ to separate internet-facing systems from the CDE. Prohibit direct internet-to-CDE traffic. Use stateful inspection firewalls. Document all permitted traffic flows with business justification.',
    weight: 5,
  },
  {
    code: 'PCI-1.4',
    title: 'Network Connections Between Trusted and Untrusted Networks Are Controlled',
    description:
      'Controls are in place to restrict connections between trusted and untrusted networks, including wireless networks.',
    category: 'Network Security Controls',
    guidance:
      'Isolate wireless networks from the CDE unless encryption and strong authentication are implemented. Treat wireless as untrusted. Document all wireless-to-CDE connections.',
    weight: 4,
  },
  {
    code: 'PCI-1.5',
    title: 'Risks to the CDE from Computing Devices That Can Connect to Both Untrusted Networks and the CDE Are Mitigated',
    description:
      'Security controls are in place for all devices that connect to both untrusted networks (including the internet) and the CDE.',
    category: 'Network Security Controls',
    guidance:
      'Implement personal firewall or equivalent on all employee-owned and company-owned mobile devices. Enable split-tunneling controls. Document all devices with dual-network connectivity.',
    weight: 3,
  },

  // ── Requirement 2: Apply Secure Configurations ────────────────────────────

  {
    code: 'PCI-2.1',
    title: 'Processes and Mechanisms for Applying Secure Configurations Are Defined',
    description:
      'All security policies and operational procedures for applying secure configurations to all system components are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Secure Configurations',
    guidance:
      'Maintain a system hardening policy aligned to a recognized standard (CIS Benchmarks, NIST). Review annually. Assign ownership for each system type.',
    weight: 3,
  },
  {
    code: 'PCI-2.2',
    title: 'System Components Are Configured and Managed Securely',
    description:
      'System configuration standards are developed for all system components. All vendor default passwords are changed and unnecessary default accounts are disabled.',
    category: 'Secure Configurations',
    guidance:
      'Develop and maintain hardening standards for every system type in the CDE. Change all default passwords before deployment. Disable/remove unused services, protocols, and accounts. Apply CIS Benchmarks as baseline.',
    weight: 5,
  },
  {
    code: 'PCI-2.3',
    title: 'Wireless Environments Are Configured and Managed Securely',
    description:
      'All wireless vendor defaults are changed, and wireless networks are managed securely.',
    category: 'Secure Configurations',
    guidance:
      'Change all wireless default SSIDs, passwords, and SNMP community strings. Implement WPA3 or WPA2-Enterprise. Conduct wireless scans quarterly to detect rogue access points.',
    weight: 3,
  },

  // ── Requirement 3: Protect Stored Account Data ────────────────────────────

  {
    code: 'PCI-3.1',
    title: 'Processes and Mechanisms for Protecting Stored Account Data Are Defined',
    description:
      'All security policies and operational procedures for protecting stored account data are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Protect Stored Account Data',
    guidance:
      'Document data retention and disposal policies. Define what account data is stored, where it is stored, how long it is retained, and how it is disposed of.',
    weight: 3,
  },
  {
    code: 'PCI-3.2',
    title: 'Storage of Account Data Is Kept to a Minimum',
    description:
      'Account data storage is limited to the minimum needed for legal, regulatory, and/or business requirements. A data retention and disposal policy is in place and a process exists for the secure deletion of data when no longer needed.',
    category: 'Protect Stored Account Data',
    guidance:
      'Implement automated purging of cardholder data exceeding the retention period. Quarterly, scan all storage locations for CHD that should have been deleted. Document data flow diagrams showing all CHD storage locations.',
    weight: 4,
  },
  {
    code: 'PCI-3.3',
    title: 'Sensitive Authentication Data Is Not Stored After Authorization',
    description:
      'SAD (full track data, card verification codes, PINs) is not retained after authorization, even if encrypted.',
    category: 'Protect Stored Account Data',
    guidance:
      'Verify through code review and system scans that SAD is not stored after transaction authorization. This includes track data, CVV/CVC, and PINs. Implement automated scans using PANscan or similar tools.',
    weight: 5,
  },
  {
    code: 'PCI-3.4',
    title: 'Primary Account Numbers Are Protected Wherever Stored',
    description:
      'Primary account numbers (PAN) are rendered unreadable anywhere they are stored by using strong cryptography, truncation, tokenization, or one-way hashes.',
    category: 'Protect Stored Account Data',
    guidance:
      'Implement tokenization or strong encryption (AES-256) for all stored PANs. Store only the minimum PAN digits needed for business purposes. Mask PAN when displayed — show only last 4 digits in UIs and logs.',
    weight: 5,
  },
  {
    code: 'PCI-3.5',
    title: 'Primary Account Numbers Are Secured with Cryptography',
    description:
      'The primary account number is secured with strong cryptography, and the cryptographic keys used to protect the PAN are secured and managed appropriately.',
    category: 'Protect Stored Account Data',
    guidance:
      'Implement a formal key management lifecycle (generation, distribution, storage, rotation, destruction). Restrict key access to the minimum necessary custodians. Rotate encryption keys at least annually.',
    weight: 5,
  },

  // ── Requirement 4: Protect Cardholder Data with Strong Cryptography in Transit

  {
    code: 'PCI-4.1',
    title: 'Processes and Mechanisms for Protecting Cardholder Data with Strong Cryptography in Transit Are Defined',
    description:
      'All security policies and operational procedures for protecting cardholder data in transit are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Cardholder Data in Transit',
    guidance:
      'Document all transmission paths for cardholder data. Specify approved encryption protocols and versions. Assign ownership for certificate management.',
    weight: 3,
  },
  {
    code: 'PCI-4.2',
    title: 'PAN Is Protected with Strong Cryptography During Transmission',
    description:
      'Strong cryptography is used to safeguard PAN during transmission over open, public networks (and on all trusted internal networks if transmitted).',
    category: 'Cardholder Data in Transit',
    guidance:
      'Enforce TLS 1.2 minimum (TLS 1.3 preferred) for all PAN transmissions. Disable SSL and early TLS. Implement certificate pinning for mobile applications. Scan for cleartext PAN in network traffic annually.',
    weight: 5,
  },

  // ── Requirement 5: Protect All Systems and Networks from Malicious Software ─

  {
    code: 'PCI-5.1',
    title: 'Processes and Mechanisms for Protecting All Systems Against Malware Are Defined',
    description:
      'All security policies and operational procedures for protecting all systems against malware are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Malware Protection',
    guidance:
      'Maintain an anti-malware policy that defines coverage requirements, update frequency, and response procedures.',
    weight: 3,
  },
  {
    code: 'PCI-5.2',
    title: 'Malware (Malicious Software) Is Prevented, or Detected and Addressed',
    description:
      'Anti-malware solutions are deployed on all system components, except for those that are not at risk from malware. Solutions perform periodic scans and generate audit logs.',
    category: 'Malware Protection',
    guidance:
      'Deploy endpoint detection and response (EDR) on all systems in the CDE. Configure automatic updates with maximum 24-hour signature latency. Run real-time scanning. Document any system with a risk-based malware exclusion.',
    weight: 5,
  },
  {
    code: 'PCI-5.3',
    title: 'Anti-Malware Mechanisms and Processes Are Active, Maintained, and Monitored',
    description:
      'Anti-malware solutions are enabled and cannot be disabled by users, unless specifically authorized by management for a limited time period.',
    category: 'Malware Protection',
    guidance:
      'Centrally manage and enforce anti-malware policy. Alert on any agent that goes offline. Require manager approval for temporary disablement. Log all disable events.',
    weight: 4,
  },
  {
    code: 'PCI-5.4',
    title: 'Anti-Phishing Mechanisms Protect Users Against Phishing Attacks',
    description:
      'Processes and automated mechanisms are in place to detect and protect personnel against phishing attacks.',
    category: 'Malware Protection',
    guidance:
      'Implement email filtering with phishing detection. Enable DMARC, DKIM, and SPF. Conduct phishing simulation training annually. Report click rates and track improvement.',
    weight: 3,
  },

  // ── Requirement 6: Develop and Maintain Secure Systems and Software ────────

  {
    code: 'PCI-6.1',
    title: 'Processes and Mechanisms for Developing and Maintaining Secure Systems and Software Are Defined',
    description:
      'All security policies and operational procedures for developing and maintaining secure systems are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Secure Development',
    guidance:
      'Document a Secure Development Lifecycle (SDLC) policy covering: threat modeling, secure coding standards, code review, and release testing.',
    weight: 3,
  },
  {
    code: 'PCI-6.2',
    title: 'Bespoke and Custom Software Are Developed Securely',
    description:
      'Bespoke and custom software are developed securely, and security vulnerabilities are addressed throughout the software lifecycle.',
    category: 'Secure Development',
    guidance:
      'Train developers on OWASP Top 10 and PCI-specific secure coding. Conduct code reviews for payment-related code. Implement SAST and DAST in the CI/CD pipeline. Address critical findings before production deployment.',
    weight: 5,
  },
  {
    code: 'PCI-6.3',
    title: 'Security Vulnerabilities Are Identified and Addressed',
    description:
      'Security vulnerabilities are identified and protected against by subscribing to vulnerability information sources, applying risk rankings, and patching critical vulnerabilities within defined timeframes.',
    category: 'Secure Development',
    guidance:
      'Subscribe to CVE feeds and vendor security bulletins. Apply critical patches within 1 month, other patches within 3 months. Maintain a vulnerability tracking register. Document risk acceptances for delayed patches.',
    weight: 5,
  },
  {
    code: 'PCI-6.4',
    title: 'Public-Facing Web Applications Are Protected Against Attacks',
    description:
      'Public-facing web applications are protected against attacks via a web application firewall (WAF) or automated technical solution.',
    category: 'Secure Development',
    guidance:
      'Deploy a WAF in front of all public-facing payment applications. Configure to block OWASP Top 10. Review WAF rules semi-annually. Alternatively, perform manual penetration testing at least annually.',
    weight: 5,
  },
  {
    code: 'PCI-6.5',
    title: 'Changes to All System Components Are Managed Securely',
    description:
      'All changes to system components in the production environment are made securely and per a formal change management process.',
    category: 'Secure Development',
    guidance:
      'Implement a formal change management process with documented approval, testing in non-production, and rollback procedures. Separate development, test, and production environments for CDE systems.',
    weight: 4,
  },

  // ── Requirement 7: Restrict Access to System Components and Cardholder Data ─

  {
    code: 'PCI-7.1',
    title: 'Processes and Mechanisms for Restricting Access to System Components and Cardholder Data Are Defined',
    description:
      'All access control policies and procedures are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Access Control',
    guidance:
      'Document an access control policy for the CDE. Define access roles, approval workflows, and review cadences.',
    weight: 3,
  },
  {
    code: 'PCI-7.2',
    title: 'Access to System Components and Data Is Appropriately Defined and Assigned',
    description:
      'Access to all system components and cardholder data is appropriately defined based on business need and aligned with the principle of least privilege.',
    category: 'Access Control',
    guidance:
      'Implement role-based access control (RBAC) for all CDE systems. Grant access only to what is needed for the job. Document access needs for every role. Prohibit generic/shared accounts.',
    weight: 5,
  },
  {
    code: 'PCI-7.3',
    title: 'Access to System Components and Data Is Managed via an Access Control System',
    description:
      'Access to in-scope system components is managed through an access control system(s) that restricts access based on a user\'s need to know and is set to "deny all" unless specifically allowed.',
    category: 'Access Control',
    guidance:
      'Implement an IAM system with deny-by-default for all CDE access. Enable quarterly access reviews. Automate de-provisioning upon role change or termination.',
    weight: 4,
  },

  // ── Requirement 8: Identify Users and Authenticate Access ─────────────────

  {
    code: 'PCI-8.1',
    title: 'Processes and Mechanisms for Identifying Users and Authenticating Access to System Components Are Defined',
    description:
      'All security policies and operational procedures for identifying users and authenticating access to system components are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Authentication',
    guidance:
      'Document authentication policies covering: unique ID requirements, password standards, MFA requirements, and account lockout thresholds.',
    weight: 3,
  },
  {
    code: 'PCI-8.2',
    title: 'User Identification and Related Accounts for Users and Administrators Are Strictly Managed Throughout an Account\'s Lifecycle',
    description:
      'User accounts are managed throughout their lifecycle: created with proper justification, modified per access change, disabled or deleted immediately upon termination.',
    category: 'Authentication',
    guidance:
      'Implement formal joiner-mover-leaver process for all CDE user accounts. Disable accounts immediately upon termination. Reconcile active accounts with HR records quarterly.',
    weight: 4,
  },
  {
    code: 'PCI-8.3',
    title: 'User Authentication for Users and Administrators Is Established and Managed',
    description:
      'All individual non-consumer user IDs and related authentication factors are strictly managed to prevent unauthorized access.',
    category: 'Authentication',
    guidance:
      'Enforce strong passwords (min 12 chars, upper/lower/number/special). Lock accounts after max 10 failed attempts. Require password changes every 90 days for non-MFA accounts. Never use group, shared, or generic IDs.',
    weight: 5,
  },
  {
    code: 'PCI-8.4',
    title: 'Multi-Factor Authentication Is Implemented to Secure Access into the CDE',
    description:
      'Multi-factor authentication is implemented for all non-console access into the CDE for personnel with administrative access.',
    category: 'Authentication',
    guidance:
      'Require MFA for all remote access to the CDE and all non-console administrative access. Use authentication apps or hardware tokens. Document MFA exceptions with compensating controls.',
    weight: 5,
  },
  {
    code: 'PCI-8.5',
    title: 'Multi-Factor Authentication Systems Are Configured to Prevent Misuse',
    description:
      'MFA systems are configured to prevent misuse, including ensuring MFA requests cannot be accepted without user interaction.',
    category: 'Authentication',
    guidance:
      'Disable MFA push notifications without number matching or additional confirmation steps. Implement MFA fatigue protections. Monitor and alert on unusual MFA activity patterns.',
    weight: 4,
  },
  {
    code: 'PCI-8.6',
    title: 'Use of Application and System Accounts and Associated Authentication Factors Is Strictly Managed',
    description:
      'Application and system accounts and their associated authentication factors are strictly managed to prevent misuse.',
    category: 'Authentication',
    guidance:
      'Inventory all service accounts with their purpose and owner. Use strong unique credentials for service accounts. Rotate service account passwords at least every 12 months. Restrict service account privileges to minimum required.',
    weight: 4,
  },

  // ── Requirement 9: Restrict Physical Access to Cardholder Data ────────────

  {
    code: 'PCI-9.1',
    title: 'Processes and Mechanisms for Restricting Physical Access to Cardholder Data Are Defined',
    description:
      'All security policies and operational procedures for restricting physical access to cardholder data are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Physical Access',
    guidance:
      'Document physical security policies covering CDE facility access, visitor management, and hardware protection.',
    weight: 3,
  },
  {
    code: 'PCI-9.2',
    title: 'Physical Access Controls Manage Entry into Facilities and Systems Containing Cardholder Data',
    description:
      'Appropriate physical security controls are in place to restrict entry to areas containing systems that store, process, or transmit cardholder data.',
    category: 'Physical Access',
    guidance:
      'Implement badge access control for all CDE-containing areas. Maintain an access list updated at least every 90 days. Use video surveillance at entry points. Ensure visitor access is escorted and logged.',
    weight: 4,
  },
  {
    code: 'PCI-9.4',
    title: 'Media with Cardholder Data Is Securely Stored, Accessed, Distributed, and Destroyed',
    description:
      'Physical and electronic media containing cardholder data are handled and protected securely at all times.',
    category: 'Physical Access',
    guidance:
      'Classify and label all media containing CHD. Implement secure storage for physical media. Use HDD shredding or NIST-compliant data sanitization for disposal. Maintain chain-of-custody records for media movement.',
    weight: 4,
  },

  // ── Requirement 10: Log and Monitor All Access ─────────────────────────────

  {
    code: 'PCI-10.1',
    title: 'Processes and Mechanisms for Logging and Monitoring All Access to System Components and Cardholder Data Are Defined',
    description:
      'All security policies and operational procedures for logging and monitoring are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Logging and Monitoring',
    guidance:
      'Document a logging policy specifying which events are logged, log retention periods (minimum 12 months, 3 months immediately available), and log review procedures.',
    weight: 3,
  },
  {
    code: 'PCI-10.2',
    title: 'Audit Logs Capture All Individual User Access to Cardholder Data and System Components',
    description:
      'Audit logs capture all individual user access to cardholder data and all actions taken with root or administrative privileges.',
    category: 'Logging and Monitoring',
    guidance:
      'Enable audit logging on all CDE systems capturing: user ID, event type, date/time, success/failure, origination, and affected component. Include: all access to CHD, admin actions, privilege escalation, invalid access attempts, and log tampering.',
    weight: 5,
  },
  {
    code: 'PCI-10.3',
    title: 'Audit Logs Are Protected from Destruction and Unauthorized Modifications',
    description:
      'Audit logs are promptly backed up to a centralized secure log server or media that is difficult to modify.',
    category: 'Logging and Monitoring',
    guidance:
      'Forward logs to a separate, hardened log server in real time. Restrict log modification to authorized processes only. Implement tamper-evident controls. Retain logs for minimum 12 months.',
    weight: 5,
  },
  {
    code: 'PCI-10.4',
    title: 'Audit Logs Are Reviewed to Identify Anomalies or Suspicious Activity',
    description:
      'Logs are reviewed at least once a day to identify critical security events.',
    category: 'Logging and Monitoring',
    guidance:
      'Implement automated log analysis or SIEM for daily review of CDE logs. Alert on critical events in real time. Investigate and document resolution of all alerts. Ensure reviews are performed by personnel independent of administrators.',
    weight: 5,
  },
  {
    code: 'PCI-10.6',
    title: 'Time Synchronization Mechanisms Support Consistent Time Settings Across All Systems',
    description:
      'System clocks and time are synchronized using an accepted technology (e.g., NTP) and time data is protected.',
    category: 'Logging and Monitoring',
    guidance:
      'Configure NTP on all CDE systems pointed to a trusted time source. Restrict time change permissions. Verify time synchronization as part of configuration audits.',
    weight: 3,
  },
  {
    code: 'PCI-10.7',
    title: 'Failures of Critical Security Controls Are Detected, Reported, and Responded to Promptly',
    description:
      'Failures in critical security controls (IDS, FIM, anti-malware, firewall, etc.) are detected and reported as quickly as possible.',
    category: 'Logging and Monitoring',
    guidance:
      'Implement monitoring for security control failures. Alert immediately on: IDS/IPS failure, firewall rule violations, FIM changes. Define and test response runbooks for each failure type.',
    weight: 4,
  },

  // ── Requirement 11: Test Security of Systems and Networks Regularly ────────

  {
    code: 'PCI-11.1',
    title: 'Processes and Mechanisms for Regularly Testing Security of Systems and Networks Are Defined',
    description:
      'All security policies and operational procedures for regularly testing security are documented, kept up to date, in use, and known to all affected parties.',
    category: 'Security Testing',
    guidance:
      'Maintain a security testing policy and calendar. Document scope, frequency, methodology, and responsible parties for each test type.',
    weight: 3,
  },
  {
    code: 'PCI-11.2',
    title: 'Wireless Access Points Are Identified and Monitored',
    description:
      'Authorized and unauthorized wireless access points are identified and managed. Wireless scans are performed at least quarterly.',
    category: 'Security Testing',
    guidance:
      'Implement wireless IDS/IPS or perform quarterly manual wireless scans. Immediately investigate and disable any unauthorized access points. Document scan results and remediation.',
    weight: 4,
  },
  {
    code: 'PCI-11.3',
    title: 'External and Internal Vulnerabilities Are Regularly Identified, Prioritized, and Addressed',
    description:
      'Internal and external vulnerability scans are performed at least quarterly and after any significant changes.',
    category: 'Security Testing',
    guidance:
      'Engage an ASV (Approved Scanning Vendor) for external scans quarterly. Perform internal scans quarterly and after major changes. Resolve critical findings before each quarterly scan. Track all findings to closure.',
    weight: 5,
  },
  {
    code: 'PCI-11.4',
    title: 'External and Internal Penetration Testing Is Regularly Performed',
    description:
      'Network-layer and application-layer penetration testing is performed at least annually and after significant changes.',
    category: 'Security Testing',
    guidance:
      'Engage a qualified internal or external penetration tester annually. Test must cover network and application layers. Remediate all exploitable findings before the next test. Document scope, methodology, findings, and remediation.',
    weight: 5,
  },
  {
    code: 'PCI-11.5',
    title: 'Network Intrusions and Unexpected File Changes Are Detected and Responded To',
    description:
      'An intrusion detection or prevention system is in place to monitor all traffic in the CDE. A change-detection mechanism (FIM) is deployed on critical files.',
    category: 'Security Testing',
    guidance:
      'Deploy IDS/IPS at all network boundaries of the CDE. Implement File Integrity Monitoring (FIM) on critical system files, configuration files, and payment application files. Alert on unexpected changes within 24 hours.',
    weight: 5,
  },

  // ── Requirement 12: Support Information Security with Organizational Policies

  {
    code: 'PCI-12.1',
    title: 'A Comprehensive Information Security Policy Is Known and Current',
    description:
      'An overall information security policy is established, published, maintained, and disseminated to all relevant personnel and applicable vendors/business partners.',
    category: 'Information Security Policy',
    guidance:
      'Maintain a comprehensive information security policy reviewed and approved by management at least annually. Distribute to all personnel and relevant third parties. Track acknowledgement.',
    weight: 4,
  },
  {
    code: 'PCI-12.2',
    title: 'Acceptable Use Policies for End-User Technologies Are Documented and Implemented',
    description:
      'Acceptable use policies for end-user technologies are documented and implemented, ensuring personnel understand their responsibilities.',
    category: 'Information Security Policy',
    guidance:
      'Create an Acceptable Use Policy (AUP) covering CDE-connected devices. Require annual acknowledgement. Include: prohibited actions, monitoring disclosure, and consequences for violations.',
    weight: 3,
  },
  {
    code: 'PCI-12.3',
    title: 'Risks to the CDE Are Formally Identified, Evaluated, and Managed',
    description:
      'A targeted risk analysis is performed for each PCI DSS requirement, and an organizational risk assessment is performed at least annually.',
    category: 'Information Security Policy',
    guidance:
      'Conduct a formal annual risk assessment of the CDE using a documented methodology. Perform targeted risk analyses when making decisions about compensating controls or risk-based decisions. Document findings and risk treatment decisions.',
    weight: 4,
  },
  {
    code: 'PCI-12.5',
    title: 'PCI DSS Scope Is Documented and Validated',
    description:
      'The scope of the PCI DSS assessment is documented and confirmed at least annually and upon significant changes.',
    category: 'Information Security Policy',
    guidance:
      'Maintain an up-to-date data flow diagram and network diagram for the CDE. Confirm scope annually with QSA or internal teams. Validate segmentation controls at least every 6 months.',
    weight: 4,
  },
  {
    code: 'PCI-12.6',
    title: 'Security Awareness Education Is Ongoing',
    description:
      'A formal security awareness program educates all personnel about the importance of cardholder data security.',
    category: 'Information Security Policy',
    guidance:
      'Provide security awareness training to all personnel at hire and annually. Include PCI DSS-specific content: phishing awareness, handling CHD, reporting incidents. Track completion and maintain records.',
    weight: 3,
  },
  {
    code: 'PCI-12.7',
    title: 'Personnel Are Screened to Reduce Risks from Insider Threats',
    description:
      'Potential personnel who will have access to the CDE are screened, within the constraints of local laws, prior to hire.',
    category: 'Information Security Policy',
    guidance:
      'Perform background checks for all personnel with CDE access prior to hiring. Document the screening process. Ensure compliance with applicable local privacy laws.',
    weight: 3,
  },
  {
    code: 'PCI-12.8',
    title: 'Risk to Information Assets Associated with Third-Party Service Provider Relationships Is Managed',
    description:
      'A list of all third-party service providers (TPSPs) that store, process, or transmit CHD is maintained, and their PCI DSS compliance is monitored.',
    category: 'Information Security Policy',
    guidance:
      'Maintain a TPSP inventory. Obtain annual compliance statements or reports. Include PCI DSS requirements in contracts. Monitor compliance at least annually. Verify TPSPs have PCI DSS compliance programs.',
    weight: 5,
  },
  {
    code: 'PCI-12.9',
    title: 'Third-Party Service Providers Support Their Customers\' PCI DSS Compliance',
    description:
      'TPSPs provide written agreements that they will comply with applicable PCI DSS requirements and that they will maintain their PCI DSS compliance program.',
    category: 'Information Security Policy',
    guidance:
      'Ensure all TPSPs with access to CHD or that could impact CDE security provide written acknowledgement of PCI DSS compliance obligations. Obtain and review TPSPs\' ROC or SAQ documents annually.',
    weight: 4,
  },
  {
    code: 'PCI-12.10',
    title: 'Suspected and Confirmed Security Incidents That Could Impact the CDE Are Responded to Immediately',
    description:
      'An incident response plan is in place and can be activated immediately in the event of a system breach.',
    category: 'Information Security Policy',
    guidance:
      'Maintain an up-to-date incident response plan specific to CHD breaches. Define escalation paths, notification procedures (card brands, acquiring bank), and forensics procedures. Test the plan at least annually with a tabletop exercise.',
    weight: 5,
  },
];
