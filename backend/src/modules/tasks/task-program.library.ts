/**
 * Deterministic Task Library — Layer 1 of the Guided Program Generator
 *
 * Maps compliance control codes to canonical TaskSpec arrays.
 * NO LLM involvement here — this is the ground truth that cannot hallucinate.
 *
 * TaskSpec.dependsOn uses relative indices within the same control group:
 *   "0" means the first task for this control (index 0)
 *   "1" means the second task, etc.
 * These are resolved to actual task IDs in Layer 3 (DAG resolution).
 */

export interface TaskSpec {
  kind: string;
  title: string;
  description?: string;
  dependsOnRelative?: number[];  // indices within this control's task list
  approvalRequired: boolean;
  estimatedMinutes: number;
  slaHours?: number;
  recurrence?: { frequency: 'annual' | 'quarterly' | 'monthly' | 'biannual' };
  guidanceHint: {
    why: string;
    evidenceHint: string;
    fileFormat?: string;
    stepByStep: string[];
    controlCategory: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ISO 27001 / SOC 2 Control Task Library
// Covers the most critical controls across both frameworks
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_LIBRARY: Record<string, TaskSpec[]> = {

  // ─── ISO A.5 — Organizational Controls ───────────────────────────────────

  'A.5.1': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Author Information Security Policy',
      approvalRequired: false,
      estimatedMinutes: 90,
      guidanceHint: {
        why: 'ISO 27001 A.5.1 mandates a documented Information Security Policy approved by management.',
        evidenceHint: 'Information Security Policy document (PDF or Word, 3-8 pages)',
        fileFormat: 'PDF or Word, 3-8 pages',
        stepByStep: [
          'Use the policy template from the Getting Started page',
          'Customize with your company name, industry, and scope',
          'Include purpose, scope, roles & responsibilities, and review schedule',
          'Submit for management approval',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
    {
      kind: 'APPROVAL',
      title: 'Approve Information Security Policy',
      dependsOnRelative: [0],
      approvalRequired: true,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'The policy must be approved by top management (CISO or CEO) to be effective.',
        evidenceHint: 'Approved policy with management signature or approval timestamp',
        stepByStep: ['Review policy draft', 'Click "Approve" in the Policies section'],
        controlCategory: 'Organizational Controls',
      },
    },
    {
      kind: 'ATTESTATION',
      title: 'Distribute ISP and record staff acknowledgements',
      dependsOnRelative: [1],
      approvalRequired: false,
      estimatedMinutes: 60,
      recurrence: { frequency: 'annual' },
      guidanceHint: {
        why: 'All staff must be aware of the policy. ISO requires evidence of distribution and acknowledgement.',
        evidenceHint: 'Acknowledgement log (email thread, training platform export, or signed list)',
        stepByStep: [
          'Send policy to all employees via email',
          'Request read-receipt or acknowledgement',
          'Export acknowledgement log',
          'Upload to evidence section',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
  ],

  'A.5.2': [
    {
      kind: 'CONFIGURATION',
      title: 'Define information security roles and responsibilities',
      approvalRequired: false,
      estimatedMinutes: 60,
      guidanceHint: {
        why: 'ISO A.5.2 requires all security responsibilities to be defined and assigned.',
        evidenceHint: 'RACI matrix or responsibilities document showing who owns each control area',
        stepByStep: [
          'Go to Team → RACI Matrix',
          'Assign Accountable (A) owner to each control',
          'Export the RACI matrix as evidence',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
  ],

  'A.5.3': [
    {
      kind: 'CONFIGURATION',
      title: 'Document segregation of duties policy',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'ISO A.5.3 requires conflicting duties to be segregated to prevent fraud and errors.',
        evidenceHint: 'SoD policy document or process document showing separation',
        stepByStep: [
          'Check Team → SoD Conflicts for current violations',
          'Resolve any user who is both R and A on the same control',
          'Document the SoD rules in your policies',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
  ],

  'A.5.10': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Author Acceptable Use Policy (AUP)',
      approvalRequired: false,
      estimatedMinutes: 60,
      guidanceHint: {
        why: 'ISO A.5.10 requires rules for acceptable use of information and associated assets.',
        evidenceHint: 'AUP document covering devices, internet, email, and data handling',
        fileFormat: 'PDF, 2-4 pages',
        stepByStep: [
          'Use the AUP policy template',
          'Cover: devices, email, internet, data classification, remote work',
          'Get management approval',
          'Distribute to all staff for acknowledgement',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
  ],

  'A.5.34': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Author Privacy and Data Protection Policy',
      approvalRequired: false,
      estimatedMinutes: 90,
      guidanceHint: {
        why: 'ISO A.5.34 requires privacy and PII protection in accordance with applicable regulations (GDPR, etc.).',
        evidenceHint: 'Privacy Policy and Data Protection Policy documents',
        fileFormat: 'PDF',
        stepByStep: [
          'Identify all personal data processed',
          'Map lawful basis for each processing activity',
          'Document data retention periods',
          'Include data subject rights procedures',
        ],
        controlCategory: 'Organizational Controls',
      },
    },
  ],

  // ─── ISO A.6 — People Controls ────────────────────────────────────────────

  'A.6.1': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Document pre-employment screening process',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'ISO A.6.1 requires background verification of all candidates before employment.',
        evidenceHint: 'Screening policy or HR procedure document, and sample background check record',
        stepByStep: [
          'Define what checks are performed (identity, criminal, employment history)',
          'Document the process in your HR onboarding procedure',
          'Upload sample completed screening record (anonymised)',
        ],
        controlCategory: 'People Controls',
      },
    },
  ],

  'A.6.2': [
    {
      kind: 'ATTESTATION',
      title: 'Collect NDA and AUP signatures from all staff',
      approvalRequired: false,
      estimatedMinutes: 120,
      recurrence: { frequency: 'annual' },
      guidanceHint: {
        why: 'ISO A.6.2 requires employees and contractors to agree to terms of employment covering security.',
        evidenceHint: 'Signed NDA and AUP records for all active employees',
        stepByStep: [
          'Export employee list from HR system',
          'Use Team → Members to check ndaSignedAt and aupSignedAt',
          'Follow up with anyone missing signatures',
          'Upload bulk signed documents or acknowledgement log',
        ],
        controlCategory: 'People Controls',
      },
    },
  ],

  'A.6.3': [
    {
      kind: 'TRAINING',
      title: 'Complete security awareness training — all staff',
      approvalRequired: false,
      estimatedMinutes: 60,
      recurrence: { frequency: 'annual' },
      guidanceHint: {
        why: 'ISO A.6.3 requires all personnel to be aware of and fulfil their security obligations.',
        evidenceHint: 'Training completion records showing name, date, and score for all employees',
        stepByStep: [
          'Assign Security Awareness Training from Team → Training tab',
          'Send reminder to all incomplete employees',
          'Export completion report',
          'Upload as evidence',
        ],
        controlCategory: 'People Controls',
      },
    },
  ],

  'A.6.5': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Document offboarding and termination procedure',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'ISO A.6.5 requires responsibilities and duties that remain valid after termination to be defined.',
        evidenceHint: 'Offboarding checklist or termination procedure document',
        stepByStep: [
          'Define steps to revoke all access',
          'Include equipment return, knowledge transfer, exit interview',
          'Document NDA post-employment obligations',
        ],
        controlCategory: 'People Controls',
      },
    },
  ],

  // ─── ISO A.7 — Physical Controls ─────────────────────────────────────────

  'A.7.1': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document physical security perimeter controls',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'ISO A.7.1 requires physical security perimeters to protect sensitive areas.',
        evidenceHint: 'Office security photos or building access policy showing locked server room / badge access',
        stepByStep: [
          'Photograph badge readers, locked server room, or cloud confirmation if remote',
          'Document that all employees use badge access for office entry',
          'If fully remote/cloud, upload a statement that no on-premise servers exist',
        ],
        controlCategory: 'Physical Controls',
      },
    },
  ],

  // ─── ISO A.8 — Technological Controls ────────────────────────────────────

  'A.8.2': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document privileged access list',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'ISO A.8.2 requires privileged access to be restricted and documented.',
        evidenceHint: 'Screenshot of admin user list from each critical system (AWS IAM, GitHub, Okta)',
        stepByStep: [
          'Export admin user list from AWS IAM',
          'Export admin/owner list from GitHub',
          'Export super-admin list from Okta/identity provider',
          'Upload all screenshots with date visible',
        ],
        controlCategory: 'Technological Controls',
      },
    },
    {
      kind: 'ACCESS_REVIEW',
      title: 'Conduct quarterly privileged access review',
      dependsOnRelative: [0],
      approvalRequired: true,
      estimatedMinutes: 60,
      recurrence: { frequency: 'quarterly' },
      guidanceHint: {
        why: 'Quarterly review ensures privilege creep is caught. ISO A.8.2 and SOC 2 CC6.3 require regular access reviews.',
        evidenceHint: 'Completed access review showing each admin account decision (approve/modify/revoke)',
        stepByStep: [
          'Go to Team → Access Reviews',
          'Click "Generate Quarterly Review"',
          'Review each admin account',
          'Make Approve/Modify/Revoke decisions',
          'Sign off the review',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  'A.8.3': [
    {
      kind: 'CONFIGURATION',
      title: 'Enforce information access restriction controls',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'ISO A.8.3 requires access to information to be restricted based on access control policy.',
        evidenceHint: 'Role-based access control (RBAC) configuration screenshots or IAM policy document',
        stepByStep: [
          'Document your RBAC model (roles and what they can access)',
          'Screenshot the IAM roles in AWS or equivalent',
          'Confirm least-privilege principle is applied',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  'A.8.5': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document MFA enforcement for all users',
      approvalRequired: false,
      estimatedMinutes: 20,
      guidanceHint: {
        why: 'ISO A.8.5 requires secure authentication. MFA is the primary control.',
        evidenceHint: 'Screenshot of Okta/Google Workspace/AWS MFA policy showing MFA enforced for all users',
        stepByStep: [
          'Go to your identity provider (Okta, Google Workspace, AWS)',
          'Screenshot the MFA enforcement policy',
          'Confirm 100% of users have MFA enabled',
          'Upload screenshot with date visible',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  'A.8.8': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document vulnerability management process',
      approvalRequired: false,
      estimatedMinutes: 45,
      recurrence: { frequency: 'quarterly' },
      guidanceHint: {
        why: 'ISO A.8.8 requires technical vulnerabilities to be identified, evaluated, and treated.',
        evidenceHint: 'Vulnerability scan report from Snyk, Dependabot, or AWS Inspector',
        stepByStep: [
          'Run a dependency vulnerability scan (Snyk, npm audit, etc.)',
          'Export the report',
          'Show remediated critical/high findings',
          'Upload report with date',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  'A.8.15': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document audit logging and monitoring configuration',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'ISO A.8.15 requires audit logs to be produced, stored, and protected.',
        evidenceHint: 'Screenshot showing CloudTrail, Datadog, or equivalent logging is enabled',
        stepByStep: [
          'Screenshot AWS CloudTrail showing it is enabled in all regions',
          'Or screenshot your logging/SIEM dashboard',
          'Show retention policy (minimum 90 days)',
          'Upload with date',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  'A.8.25': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Document secure development lifecycle policy',
      approvalRequired: false,
      estimatedMinutes: 60,
      guidanceHint: {
        why: 'ISO A.8.25 requires security to be designed into the development lifecycle.',
        evidenceHint: 'Secure SDLC policy or engineering security standards document',
        stepByStep: [
          'Document security requirements gathering process',
          'Include code review requirements (PRs, security reviews)',
          'Cover DAST/SAST tooling used',
          'Include incident response in dev pipeline',
        ],
        controlCategory: 'Technological Controls',
      },
    },
  ],

  // ─── ISO A.9 — Access Control ──────────────────────────────────────────────

  'A.9.1': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Author Access Control Policy',
      approvalRequired: false,
      estimatedMinutes: 60,
      guidanceHint: {
        why: 'ISO A.9.1 requires an access control policy to be documented and reviewed.',
        evidenceHint: 'Access Control Policy document covering user provisioning, privileges, and review',
        fileFormat: 'PDF, 2-5 pages',
        stepByStep: [
          'Use the Access Control Policy template',
          'Cover: joiner/mover/leaver process, least privilege, MFA requirement',
          'Get management approval',
        ],
        controlCategory: 'Access Control',
      },
    },
  ],

  // ─── SOC 2 — Common Criteria ──────────────────────────────────────────────

  'CC1.1': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Document organizational commitment to integrity and ethics',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'SOC 2 CC1.1 requires the entity to demonstrate commitment to integrity and ethical values.',
        evidenceHint: 'Code of Conduct or Ethics Policy document',
        fileFormat: 'PDF',
        stepByStep: [
          'Use the Code of Conduct template',
          'Include values, reporting mechanisms, and disciplinary actions',
          'Distribute to all employees',
          'Upload acknowledgement records',
        ],
        controlCategory: 'Control Environment',
      },
    },
  ],

  'CC1.3': [
    {
      kind: 'CONFIGURATION',
      title: 'Define management reporting structure',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC1.3 requires the entity to demonstrate organizational structure and reporting lines.',
        evidenceHint: 'Org chart showing manager hierarchy, or export from Team members showing managerId assignments',
        stepByStep: [
          'Go to Team → Members',
          'Assign managers to each team member',
          'Export or screenshot the hierarchy',
          'Upload as evidence',
        ],
        controlCategory: 'Control Environment',
      },
    },
  ],

  'CC2.1': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document internal communication of security objectives',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC2.1 requires the entity to communicate the information necessary to support the functioning of internal control.',
        evidenceHint: 'Meeting minutes, all-hands notes, or Slack announcement showing security objectives shared with team',
        stepByStep: [
          'Send a security update to the whole team',
          'Screenshot the communication (Slack, email, meeting notes)',
          'Upload the evidence with date',
        ],
        controlCategory: 'Communication',
      },
    },
  ],

  'CC6.1': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document logical and physical access controls',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'SOC 2 CC6.1 requires access to assets to be limited to authorized users and processes.',
        evidenceHint: 'IAM roles screenshot, VPN config, or access control matrix showing who has access to what',
        stepByStep: [
          'Export IAM policy showing least-privilege roles',
          'Screenshot VPN or network access controls if applicable',
          'Document production access restrictions',
          'Upload all screenshots with dates',
        ],
        controlCategory: 'Logical and Physical Access',
      },
    },
  ],

  'CC6.2': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document user provisioning and access request process',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC6.2 requires user access to be provisioned and modified through an authorized process.',
        evidenceHint: 'Ticket/Jira showing access request and approval, or documented provisioning process',
        stepByStep: [
          'Document how new employees get access (request → approval → provisioning)',
          'Show 2-3 sample access request tickets',
          'Upload process document + sample tickets',
        ],
        controlCategory: 'Logical and Physical Access',
      },
    },
  ],

  'CC6.3': [
    {
      kind: 'ACCESS_REVIEW',
      title: 'Conduct quarterly user access review',
      approvalRequired: true,
      estimatedMinutes: 90,
      recurrence: { frequency: 'quarterly' },
      guidanceHint: {
        why: 'SOC 2 CC6.3 requires access to be removed when it is no longer needed. Quarterly reviews catch privilege creep.',
        evidenceHint: 'Completed access review showing each user decision (approve/modify/revoke)',
        stepByStep: [
          'Go to Team → Access Reviews',
          'Review all user access across all systems',
          'Revoke access for terminated employees',
          'Sign off with management approval',
          'Upload signed access review report',
        ],
        controlCategory: 'Logical and Physical Access',
      },
    },
  ],

  'CC6.6': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document encryption in transit and at rest controls',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC6.6 requires transmission and storage of confidential data to be encrypted.',
        evidenceHint: 'Screenshot showing TLS certificate, S3 encryption settings, or database encryption config',
        stepByStep: [
          'Screenshot your SSL/TLS certificate (A+ rating on SSL Labs)',
          'Screenshot S3 bucket encryption settings',
          'Screenshot RDS encryption-at-rest setting',
          'Upload all with dates',
        ],
        controlCategory: 'Logical and Physical Access',
      },
    },
  ],

  'CC7.1': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document system vulnerability detection process',
      approvalRequired: false,
      estimatedMinutes: 45,
      guidanceHint: {
        why: 'SOC 2 CC7.1 requires the entity to use detection and monitoring procedures to identify potential security events.',
        evidenceHint: 'Datadog/CloudWatch/Snyk alerts configuration screenshot showing active vulnerability monitoring',
        stepByStep: [
          'Screenshot your monitoring/alerting dashboard',
          'Show that alerts are configured for security events',
          'Export or screenshot Snyk dashboard if used',
          'Upload with date',
        ],
        controlCategory: 'System Operations',
      },
    },
  ],

  'CC7.2': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document security incident response process',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC7.2 requires the entity to monitor system components for anomalies indicative of incidents.',
        evidenceHint: 'Incident response procedure document or runbook',
        stepByStep: [
          'Document: how incidents are detected, escalated, and resolved',
          'Include severity levels and response times',
          'Show alert → ticket → resolution flow',
          'Upload the procedure',
        ],
        controlCategory: 'System Operations',
      },
    },
  ],

  'CC7.3': [
    {
      kind: 'POLICY_AUTHORING',
      title: 'Author Incident Response Plan',
      approvalRequired: false,
      estimatedMinutes: 90,
      guidanceHint: {
        why: 'SOC 2 CC7.3 requires a documented procedure for evaluating and containing security incidents.',
        evidenceHint: 'Incident Response Plan document (PDF)',
        fileFormat: 'PDF, 4-8 pages',
        stepByStep: [
          'Use the Incident Response Plan template',
          'Include: preparation, detection, containment, eradication, recovery, lessons learned',
          'Define roles (Incident Commander, Security Lead, Communications Lead)',
          'Get management approval',
        ],
        controlCategory: 'System Operations',
      },
    },
  ],

  'CC8.1': [
    {
      kind: 'EVIDENCE_UPLOAD',
      title: 'Document change management process',
      approvalRequired: false,
      estimatedMinutes: 30,
      guidanceHint: {
        why: 'SOC 2 CC8.1 requires the entity to authorize and manage changes to infrastructure, data, and software.',
        evidenceHint: 'GitHub branch protection settings screenshot + PR approval example',
        stepByStep: [
          'Screenshot GitHub branch protection rules (required reviewers, no force push)',
          'Show a sample approved PR with security review',
          'Document your deployment approval process',
          'Upload screenshots with dates',
        ],
        controlCategory: 'Change Management',
      },
    },
  ],

  'CC9.1': [
    {
      kind: 'RISK_ASSESSMENT',
      title: 'Complete annual risk assessment',
      approvalRequired: false,
      estimatedMinutes: 180,
      recurrence: { frequency: 'annual' },
      guidanceHint: {
        why: 'SOC 2 CC9.1 requires the entity to identify, analyze, and manage risks to its objectives.',
        evidenceHint: 'Risk register with likelihood, impact, and treatment plans for all identified risks',
        stepByStep: [
          'Go to Risks section in the platform',
          'Review all open risks',
          'Update likelihood and impact for each',
          'Document treatment plans',
          'Export risk register as PDF',
          'Upload as evidence',
        ],
        controlCategory: 'Risk Management',
      },
    },
  ],

  'CC9.2': [
    {
      kind: 'VENDOR_REVIEW',
      title: 'Conduct vendor/third-party risk assessment',
      approvalRequired: false,
      estimatedMinutes: 120,
      recurrence: { frequency: 'annual' },
      guidanceHint: {
        why: 'SOC 2 CC9.2 requires the entity to assess and manage risks associated with vendors and business partners.',
        evidenceHint: 'Vendor risk assessment list showing security questionnaires or certifications collected',
        stepByStep: [
          'List all critical vendors (cloud providers, SaaS tools, data processors)',
          'For each: collect their SOC 2 or ISO 27001 certificate',
          'Document risk rating for each vendor',
          'Upload vendor risk register',
        ],
        controlCategory: 'Risk Management',
      },
    },
  ],
};

/**
 * Get all task specs for a list of control codes.
 * Returns flattened list with controlCode attached.
 */
export function getTasksForControls(controlCodes: string[]): Array<TaskSpec & { controlCode: string }> {
  const result: Array<TaskSpec & { controlCode: string }> = [];
  for (const code of controlCodes) {
    const specs = TASK_LIBRARY[code];
    if (specs) {
      for (const spec of specs) {
        result.push({ ...spec, controlCode: code });
      }
    }
  }
  return result;
}

/** All control codes covered by this library */
export const COVERED_CONTROL_CODES = Object.keys(TASK_LIBRARY);
