export interface TaskSpec {
  kind: 'EVIDENCE_UPLOAD' | 'POLICY_AUTHORING' | 'ACCESS_REVIEW' | 'TRAINING' | 'RISK_ASSESSMENT' | 'VENDOR_REVIEW' | 'INCIDENT_DRILL' | 'ATTESTATION' | 'CONFIGURATION' | 'APPROVAL';
  title: string;
  estimatedMinutes?: number;
  approvalRequired?: boolean;
  recurrence?: { frequency: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' };
  dependsOn?: string[];
  guidance?: {
    why: string;
    evidenceHint: string;
    stepByStep: string[];
  };
}

export const TASK_LIBRARY: Record<string, TaskSpec[]> = {
  // ─── ISO 27001 Annex A Controls ─────────────────────────────
  'A.5.1': [
    { kind: 'POLICY_AUTHORING', title: 'Author Information Security Policy', approvalRequired: true, estimatedMinutes: 90,
      guidance: { why: 'ISO A.5.1 requires a top-management-approved security policy', evidenceHint: 'Signed PDF or document with approval metadata', stepByStep: ['Draft policy using template', 'Review with CISO', 'Submit for management approval'] } },
    { kind: 'ATTESTATION', title: 'Distribute ISP and record acknowledgement', recurrence: { frequency: 'annual' }, estimatedMinutes: 30 },
  ],
  'A.5.2': [
    { kind: 'POLICY_AUTHORING', title: 'Define information security roles and responsibilities', estimatedMinutes: 60 },
  ],
  'A.6.3': [
    { kind: 'TRAINING', title: 'Conduct security awareness training', recurrence: { frequency: 'annual' }, estimatedMinutes: 120,
      guidance: { why: 'ISO A.6.3 mandates regular security awareness training for all personnel', evidenceHint: 'Training completion records with dates and attendees', stepByStep: ['Select training content', 'Schedule sessions', 'Record attendance and scores'] } },
  ],
  'A.8.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document privileged access list', estimatedMinutes: 30 },
    { kind: 'ACCESS_REVIEW', title: 'Quarterly privileged access review', recurrence: { frequency: 'quarterly' }, approvalRequired: true, estimatedMinutes: 60 },
  ],
  'A.8.9': [
    { kind: 'CONFIGURATION', title: 'Implement configuration management baseline', estimatedMinutes: 120 },
  ],
  'A.5.24': [
    { kind: 'POLICY_AUTHORING', title: 'Create incident response plan', approvalRequired: true, estimatedMinutes: 120 },
    { kind: 'INCIDENT_DRILL', title: 'Conduct tabletop incident response exercise', recurrence: { frequency: 'annual' }, estimatedMinutes: 180 },
  ],

  // ─── SOC 2 Trust Services Criteria ──────────────────────────
  'CC1.1': [
    { kind: 'POLICY_AUTHORING', title: 'Define organizational commitment to integrity and ethics', approvalRequired: true, estimatedMinutes: 60 },
    { kind: 'ATTESTATION', title: 'Board/management attestation of ethical values', recurrence: { frequency: 'annual' }, estimatedMinutes: 15 },
  ],
  'CC6.1': [
    { kind: 'CONFIGURATION', title: 'Implement logical access security controls', estimatedMinutes: 180,
      guidance: { why: 'CC6.1 requires logical access security to protect information assets', evidenceHint: 'IAM configuration screenshots, SSO setup, MFA enforcement evidence', stepByStep: ['Configure SSO/SAML', 'Enforce MFA for all users', 'Document access control policy'] } },
    { kind: 'EVIDENCE_UPLOAD', title: 'Upload IAM configuration evidence', estimatedMinutes: 30 },
  ],
  'CC6.3': [
    { kind: 'ACCESS_REVIEW', title: 'Quarterly access certification review', recurrence: { frequency: 'quarterly' }, approvalRequired: true, estimatedMinutes: 90 },
  ],
  'CC7.4': [
    { kind: 'INCIDENT_DRILL', title: 'Security incident response exercise', recurrence: { frequency: 'semi-annual' }, estimatedMinutes: 120 },
  ],
  'CC8.1': [
    { kind: 'POLICY_AUTHORING', title: 'Document change management process', approvalRequired: true, estimatedMinutes: 90 },
    { kind: 'EVIDENCE_UPLOAD', title: 'Upload change management evidence (tickets, PRs)', estimatedMinutes: 30 },
  ],
  'CC9.2': [
    { kind: 'VENDOR_REVIEW', title: 'Conduct vendor risk assessment', recurrence: { frequency: 'annual' }, estimatedMinutes: 120 },
    { kind: 'EVIDENCE_UPLOAD', title: 'Upload vendor due diligence documentation', estimatedMinutes: 45 },
  ],

  // ─── ISO 9001:2015 Clauses ──────────────────────────────────
  'ISO9001-4.1': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document context of the organization (internal/external issues)', estimatedMinutes: 60,
      guidance: { why: 'ISO 9001 Clause 4.1 requires understanding the organization and its context', evidenceHint: 'SWOT analysis, environmental scan, or context analysis document', stepByStep: ['Identify internal issues', 'Identify external issues', 'Document relevant to QMS'] } },
  ],
  'ISO9001-4.3': [
    { kind: 'POLICY_AUTHORING', title: 'Define QMS scope statement', approvalRequired: true, estimatedMinutes: 45 },
  ],
  'ISO9001-5.1': [
    { kind: 'ATTESTATION', title: 'Top management leadership commitment statement', estimatedMinutes: 30 },
  ],
  'ISO9001-5.2': [
    { kind: 'POLICY_AUTHORING', title: 'Author Quality Policy', approvalRequired: true, estimatedMinutes: 60,
      guidance: { why: 'Clause 5.2 requires a quality policy appropriate to the purpose of the organization', evidenceHint: 'Signed quality policy document', stepByStep: ['Draft quality policy', 'Align with strategic direction', 'Communicate to all personnel'] } },
  ],
  'ISO9001-6.1': [
    { kind: 'RISK_ASSESSMENT', title: 'Identify risks and opportunities affecting QMS', estimatedMinutes: 90 },
  ],
  'ISO9001-6.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document quality objectives with measurement criteria', estimatedMinutes: 60 },
  ],
  'ISO9001-7.2': [
    { kind: 'TRAINING', title: 'Competence assessment and training plan', recurrence: { frequency: 'annual' }, estimatedMinutes: 90 },
  ],
  'ISO9001-7.5': [
    { kind: 'CONFIGURATION', title: 'Implement documented information control procedure', estimatedMinutes: 60 },
  ],
  'ISO9001-8.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document customer requirements determination process', estimatedMinutes: 45 },
  ],
  'ISO9001-8.4': [
    { kind: 'VENDOR_REVIEW', title: 'Evaluate external providers (suppliers)', recurrence: { frequency: 'annual' }, estimatedMinutes: 90 },
  ],
  'ISO9001-9.1.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document customer satisfaction measurement method', estimatedMinutes: 45,
      guidance: { why: 'Clause 9.1.2 requires monitoring customer perception of degree to which needs are fulfilled', evidenceHint: 'Survey results, NPS scores, complaint logs', stepByStep: ['Choose measurement method', 'Collect baseline data', 'Establish review cadence'] } },
  ],
  'ISO9001-9.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Conduct internal QMS audit', recurrence: { frequency: 'annual' }, approvalRequired: true, estimatedMinutes: 240 },
  ],
  'ISO9001-9.3': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Conduct management review meeting', recurrence: { frequency: 'annual' }, estimatedMinutes: 120 },
  ],
  'ISO9001-10.2': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document nonconformity and corrective action procedure', estimatedMinutes: 45 },
    { kind: 'ATTESTATION', title: 'Confirm NCR register is current and accessible', recurrence: { frequency: 'monthly' }, estimatedMinutes: 15 },
  ],

  // ─── GDPR Articles ──────────────────────────────────────────
  'GDPR-Art-5': [
    { kind: 'POLICY_AUTHORING', title: 'Document data processing principles and lawful basis', approvalRequired: true, estimatedMinutes: 90 },
  ],
  'GDPR-Art-13': [
    { kind: 'POLICY_AUTHORING', title: 'Create privacy notice / privacy policy', approvalRequired: true, estimatedMinutes: 60 },
  ],
  'GDPR-Art-17': [
    { kind: 'POLICY_AUTHORING', title: 'Create data subject erasure procedure', estimatedMinutes: 60 },
  ],
  'GDPR-Art-28': [
    { kind: 'POLICY_AUTHORING', title: 'Create Data Processing Agreement (DPA) template', approvalRequired: true, estimatedMinutes: 90 },
    { kind: 'VENDOR_REVIEW', title: 'Review processor compliance and DPA coverage', recurrence: { frequency: 'annual' }, estimatedMinutes: 120 },
  ],
  'GDPR-Art-30': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Create and maintain Record of Processing Activities (ROPA)', estimatedMinutes: 120,
      guidance: { why: 'Article 30 mandates maintaining records of processing activities', evidenceHint: 'ROPA spreadsheet or system export', stepByStep: ['List all processing activities', 'Document purpose and lawful basis for each', 'Record data categories and recipients'] } },
  ],
  'GDPR-Art-32': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Document technical and organizational measures (TOMs)', estimatedMinutes: 90 },
  ],
  'GDPR-Art-33': [
    { kind: 'POLICY_AUTHORING', title: 'Create 72-hour breach notification procedure', approvalRequired: true, estimatedMinutes: 60 },
    { kind: 'INCIDENT_DRILL', title: 'Conduct breach notification drill', recurrence: { frequency: 'annual' }, estimatedMinutes: 120 },
  ],
  'GDPR-Art-35': [
    { kind: 'EVIDENCE_UPLOAD', title: 'Conduct DPIA for high-risk processing', estimatedMinutes: 180 },
  ],

  // ─── HIPAA Security/Privacy Rule ────────────────────────────
  'HIPAA-164.308': [
    { kind: 'RISK_ASSESSMENT', title: 'Conduct HIPAA Security Risk Assessment (SRA)', recurrence: { frequency: 'annual' }, estimatedMinutes: 480,
      guidance: { why: '§164.308(a)(1) requires accurate and thorough risk assessment of ePHI', evidenceHint: 'Completed SRA report with risk register', stepByStep: ['Inventory ePHI systems', 'Identify threats and vulnerabilities', 'Assess risk levels', 'Document mitigation plans'] } },
    { kind: 'POLICY_AUTHORING', title: 'Create HIPAA security policies and procedures', approvalRequired: true, estimatedMinutes: 180 },
  ],
  'HIPAA-164.308-training': [
    { kind: 'TRAINING', title: 'HIPAA workforce security awareness training', recurrence: { frequency: 'annual' }, estimatedMinutes: 60 },
  ],
  'HIPAA-164.308-baa': [
    { kind: 'VENDOR_REVIEW', title: 'Review Business Associate Agreements (BAAs)', recurrence: { frequency: 'annual' }, estimatedMinutes: 90 },
  ],
  'HIPAA-164.312': [
    { kind: 'CONFIGURATION', title: 'Implement technical safeguards for ePHI access', estimatedMinutes: 240 },
    { kind: 'EVIDENCE_UPLOAD', title: 'Document access controls, audit controls, and encryption', estimatedMinutes: 60 },
  ],
  'HIPAA-164.316': [
    { kind: 'POLICY_AUTHORING', title: 'Document HIPAA policies and procedures (§164.316)', approvalRequired: true, estimatedMinutes: 120 },
    { kind: 'ATTESTATION', title: 'Review and update HIPAA documentation', recurrence: { frequency: 'annual' }, estimatedMinutes: 60 },
  ],
};

export function getTasksForControls(controlCodes: string[]): Array<TaskSpec & { controlCode: string }> {
  const tasks: Array<TaskSpec & { controlCode: string }> = [];
  for (const code of controlCodes) {
    const specs = TASK_LIBRARY[code];
    if (specs) {
      tasks.push(...specs.map(s => ({ ...s, controlCode: code })));
    }
  }
  return tasks;
}
