import { PrismaClient, FrameworkType, CompanyType, Industry, CollectedVia, UserRole, Plan, RiskLikelihood, RiskImpact, RiskStatus, GeneratedBy, PolicyStatus, EvidenceType, EvidenceSource, ControlStatus, TaskPriority, TaskStatus, TaskSource, ReviewStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// ─── SOC 2 Controls ──────────────────────────────────────────────────────────

const SOC2_CONTROLS = [
  // CC1 – Control Environment
  {
    code: 'CC1.1',
    title: 'COSO Principle 1: Commitment to Integrity and Ethics',
    description:
      'The entity demonstrates a commitment to integrity and ethical values.',
    category: 'Control Environment',
    guidance:
      'Document and communicate a code of conduct. Ensure leadership models ethical behavior. Establish mechanisms for reporting unethical behavior.',
    weight: 3,
  },
  {
    code: 'CC1.2',
    title: 'COSO Principle 2: Board Independence and Oversight',
    description:
      'The board of directors demonstrates independence from management and exercises oversight of the development and performance of internal control.',
    category: 'Control Environment',
    guidance:
      'Define board composition, independence requirements, and oversight responsibilities for security and compliance.',
    weight: 2,
  },
  {
    code: 'CC1.3',
    title: 'COSO Principle 3: Organizational Structure and Authority',
    description:
      'Management establishes, with board oversight, structures, reporting lines, and appropriate authorities and responsibilities.',
    category: 'Control Environment',
    guidance:
      'Create an org chart with clear reporting lines. Define RACI matrix for security responsibilities.',
    weight: 2,
  },
  {
    code: 'CC1.4',
    title: 'COSO Principle 4: Commitment to Competence',
    description:
      'The entity demonstrates a commitment to attract, develop, and retain competent individuals.',
    category: 'Control Environment',
    guidance:
      'Define role-based competency requirements. Implement security training programs. Track training completion.',
    weight: 2,
  },
  {
    code: 'CC1.5',
    title: 'COSO Principle 5: Accountability',
    description:
      'The entity holds individuals accountable for their internal control responsibilities.',
    category: 'Control Environment',
    guidance:
      'Define security responsibilities in job descriptions. Include security goals in performance reviews.',
    weight: 2,
  },

  // CC2 – Communication and Information
  {
    code: 'CC2.1',
    title: 'COSO Principle 13: Relevant, Quality Information',
    description:
      'The entity obtains or generates and uses relevant, quality information to support the functioning of internal control.',
    category: 'Communication and Information',
    guidance:
      'Establish data quality standards. Define information ownership. Implement data classification.',
    weight: 2,
  },
  {
    code: 'CC2.2',
    title: 'COSO Principle 14: Internal Communication',
    description:
      'The entity internally communicates information, including objectives and responsibilities for internal control.',
    category: 'Communication and Information',
    guidance:
      'Communicate security policies to all staff. Maintain documented communication channels for security issues.',
    weight: 2,
  },
  {
    code: 'CC2.3',
    title: 'COSO Principle 15: External Communication',
    description:
      'The entity communicates with external parties regarding matters affecting internal control.',
    category: 'Communication and Information',
    guidance:
      'Establish vendor security communication process. Define breach notification procedures.',
    weight: 2,
  },

  // CC3 – Risk Assessment
  {
    code: 'CC3.1',
    title: 'COSO Principle 6: Specify Objectives',
    description:
      'The entity specifies objectives with sufficient clarity to enable the identification and assessment of risks.',
    category: 'Risk Assessment',
    guidance:
      'Define security objectives aligned to business goals. Document and communicate objectives to stakeholders.',
    weight: 3,
  },
  {
    code: 'CC3.2',
    title: 'COSO Principle 7: Identify and Analyze Risk',
    description:
      'The entity identifies risks to the achievement of its objectives and analyzes risks as a basis for determining how risks should be managed.',
    category: 'Risk Assessment',
    guidance:
      'Conduct annual risk assessment. Maintain a risk register. Assign risk owners.',
    weight: 3,
  },
  {
    code: 'CC3.3',
    title: 'COSO Principle 8: Assess Fraud Risk',
    description:
      'The entity considers the potential for fraud in assessing risks to the achievement of objectives.',
    category: 'Risk Assessment',
    guidance:
      'Identify fraud risk scenarios. Implement anti-fraud controls. Conduct periodic fraud risk reviews.',
    weight: 2,
  },
  {
    code: 'CC3.4',
    title: 'COSO Principle 9: Identify and Analyze Significant Change',
    description:
      'The entity identifies and assesses changes that could significantly impact the system of internal control.',
    category: 'Risk Assessment',
    guidance:
      'Implement change management process. Assess risk of significant changes before implementation.',
    weight: 2,
  },

  // CC4 – Monitoring Activities
  {
    code: 'CC4.1',
    title: 'COSO Principle 16: Conduct Ongoing Evaluations',
    description:
      'The entity selects, develops, and performs ongoing evaluations to ascertain whether components of internal control are present and functioning.',
    category: 'Monitoring Activities',
    guidance:
      'Implement continuous monitoring. Perform regular vulnerability scans. Review system logs daily.',
    weight: 3,
  },
  {
    code: 'CC4.2',
    title: 'COSO Principle 17: Evaluate and Communicate Deficiencies',
    description:
      'The entity evaluates and communicates internal control deficiencies in a timely manner.',
    category: 'Monitoring Activities',
    guidance:
      'Define deficiency severity levels. Establish escalation path. Track remediation to closure.',
    weight: 2,
  },

  // CC5 – Control Activities
  {
    code: 'CC5.1',
    title: 'COSO Principle 10: Select and Develop Control Activities',
    description:
      'The entity selects and develops control activities that contribute to the mitigation of risks.',
    category: 'Control Activities',
    guidance:
      'Document all control activities. Map controls to identified risks. Ensure compensating controls exist.',
    weight: 2,
  },
  {
    code: 'CC5.2',
    title: 'COSO Principle 11: Select General Technology Controls',
    description:
      'The entity selects and develops general control activities over technology.',
    category: 'Control Activities',
    guidance:
      'Implement infrastructure security controls. Enforce configuration management standards.',
    weight: 3,
  },
  {
    code: 'CC5.3',
    title: 'COSO Principle 12: Deploy Through Policies and Procedures',
    description:
      'The entity deploys control activities through policies that establish what is expected and procedures that put policies into action.',
    category: 'Control Activities',
    guidance:
      'Maintain an up-to-date policy library. Review policies annually. Obtain employee acknowledgment.',
    weight: 2,
  },

  // CC6 – Logical and Physical Access
  {
    code: 'CC6.1',
    title: 'Logical Access Security',
    description:
      'The entity implements logical access security software, infrastructure, and architectures over protected information assets.',
    category: 'Logical and Physical Access',
    guidance:
      'Implement IAM with least privilege. Enforce MFA for all users. Review access quarterly.',
    weight: 5,
  },
  {
    code: 'CC6.2',
    title: 'Prior to Issuing System Credentials',
    description:
      'Prior to issuing system credentials and granting system access, the entity registers and authorizes new internal and external users.',
    category: 'Logical and Physical Access',
    guidance:
      'Define user provisioning process. Require manager approval for access. Document access requests.',
    weight: 4,
  },
  {
    code: 'CC6.3',
    title: 'Role-Based Access and Least Privilege',
    description:
      'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on approved and documented access-control rules.',
    category: 'Logical and Physical Access',
    guidance:
      'Implement RBAC. Review and recertify access quarterly. Remove access on termination within 24 hours.',
    weight: 5,
  },
  {
    code: 'CC6.4',
    title: 'Physical Access Restrictions',
    description:
      'The entity restricts physical access to facilities and protected information assets to authorized personnel.',
    category: 'Logical and Physical Access',
    guidance:
      'Implement badge access to server rooms. Maintain visitor logs. Review physical access quarterly.',
    weight: 3,
  },
  {
    code: 'CC6.5',
    title: 'Discontinuation of Logical Access',
    description:
      'The entity discontinues logical access to protected information assets when appropriate.',
    category: 'Logical and Physical Access',
    guidance:
      'Terminate all access within 24 hours of employee departure. Conduct offboarding checklist.',
    weight: 4,
  },
  {
    code: 'CC6.6',
    title: 'Security Threats From Outside the System Boundaries',
    description:
      'The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.',
    category: 'Logical and Physical Access',
    guidance:
      'Deploy endpoint protection. Implement email security scanning. Use WAF for web applications.',
    weight: 4,
  },
  {
    code: 'CC6.7',
    title: 'Transmission of Data',
    description:
      'The entity restricts the transmission, movement, and removal of information to authorized internal and external users and processes.',
    category: 'Logical and Physical Access',
    guidance:
      'Enforce TLS 1.2+ for all data in transit. Implement DLP controls. Restrict USB access.',
    weight: 4,
  },
  {
    code: 'CC6.8',
    title: 'Prevention or Detection of Unauthorized Software',
    description:
      'The entity implements controls to prevent or detect and act upon the introduction of unauthorized or malicious software.',
    category: 'Logical and Physical Access',
    guidance:
      'Maintain software allowlist. Implement vulnerability scanning. Run SAST/DAST in CI/CD.',
    weight: 3,
  },

  // CC7 – System Operations
  {
    code: 'CC7.1',
    title: 'Detection and Monitoring of New Vulnerabilities',
    description:
      'The entity uses detection and monitoring procedures to identify changes to configurations and new vulnerabilities.',
    category: 'System Operations',
    guidance:
      'Run automated vulnerability scans weekly. Subscribe to CVE feeds. Patch critical vulns within 30 days.',
    weight: 4,
  },
  {
    code: 'CC7.2',
    title: 'Monitoring of System Components',
    description:
      'The entity monitors system components and the operation of those components for anomalies.',
    category: 'System Operations',
    guidance:
      'Implement centralized logging. Set up alerting for anomalies. Define alert thresholds.',
    weight: 4,
  },
  {
    code: 'CC7.3',
    title: 'Evaluation of Security Events',
    description:
      'The entity evaluates security events to determine whether they could or have resulted in a failure.',
    category: 'System Operations',
    guidance:
      'Define security event taxonomy. Implement SIEM or log aggregation. Train team on event triage.',
    weight: 3,
  },
  {
    code: 'CC7.4',
    title: 'Response to Security Incidents',
    description:
      'The entity responds to identified security incidents by executing a defined incident-response program.',
    category: 'System Operations',
    guidance:
      'Write and test incident response plan. Define severity levels. Conduct tabletop exercise annually.',
    weight: 5,
  },
  {
    code: 'CC7.5',
    title: 'Identifying Disclosures of Personal Information',
    description:
      'The entity identifies unauthorized disclosures of personal information to the data subjects, regulators, and others.',
    category: 'System Operations',
    guidance:
      'Define breach notification procedure. Know your regulatory notification timelines. Test notification process.',
    weight: 4,
  },

  // CC8 – Change Management
  {
    code: 'CC8.1',
    title: 'Change Management Process',
    description:
      'The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures.',
    category: 'Change Management',
    guidance:
      'Implement formal change management process. Require PR reviews. Test changes in staging before production.',
    weight: 4,
  },

  // CC9 – Risk Mitigation
  {
    code: 'CC9.1',
    title: 'Risk Mitigation Activities',
    description:
      'The entity identifies, selects, and develops risk mitigation activities for risks arising from potential business disruptions.',
    category: 'Risk Mitigation',
    guidance:
      'Implement BCP/DR plan. Test recovery procedures annually. Define RPO and RTO targets.',
    weight: 3,
  },
  {
    code: 'CC9.2',
    title: 'Vendor and Business Partner Risk Management',
    description:
      'The entity assesses and manages risks associated with vendors and business partners.',
    category: 'Risk Mitigation',
    guidance:
      'Conduct vendor risk assessments. Review vendor SOC 2 reports. Include security requirements in contracts.',
    weight: 3,
  },
];

// ─── ISO 27001 Controls ───────────────────────────────────────────────────────

const ISO27001_CONTROLS = [
  {
    code: 'A.5.1',
    title: 'Policies for Information Security',
    description:
      'A set of policies for information security shall be defined, approved by management, published and communicated to employees and relevant external parties.',
    category: 'Information Security Policies',
    guidance:
      'Create an Information Security Policy approved by senior management. Review annually.',
    weight: 4,
  },
  {
    code: 'A.6.1',
    title: 'Internal Organisation',
    description:
      'All information security responsibilities shall be defined and allocated.',
    category: 'Organisation of Information Security',
    guidance:
      'Assign an Information Security Officer. Define security roles and responsibilities for all staff.',
    weight: 3,
  },
  {
    code: 'A.6.2',
    title: 'Mobile Devices and Teleworking',
    description:
      'A policy and supporting security measures shall be adopted to manage the risks introduced by using mobile devices.',
    category: 'Organisation of Information Security',
    guidance:
      'Implement MDM solution. Define BYOD policy. Enforce device encryption and remote wipe capability.',
    weight: 3,
  },
  {
    code: 'A.7.1',
    title: 'Prior to Employment',
    description:
      'Background verification checks on all candidates for employment shall be carried out.',
    category: 'Human Resource Security',
    guidance:
      'Conduct background checks before employment. Define verification requirements by role sensitivity.',
    weight: 3,
  },
  {
    code: 'A.7.2',
    title: 'During Employment',
    description:
      'Management shall require all employees and contractors to apply information security in accordance with the established policies.',
    category: 'Human Resource Security',
    guidance:
      'Conduct annual security awareness training. Track completion. Require policy acknowledgment.',
    weight: 3,
  },
  {
    code: 'A.7.3',
    title: 'Termination and Change of Employment',
    description:
      'Information security responsibilities and duties that remain valid after termination or change of employment shall be defined.',
    category: 'Human Resource Security',
    guidance:
      'Define termination checklist. Revoke all access within 24 hours. Recover company assets.',
    weight: 3,
  },
  {
    code: 'A.8.1',
    title: 'Responsibility for Assets',
    description:
      'Assets associated with information and information processing facilities shall be identified and an inventory maintained.',
    category: 'Asset Management',
    guidance:
      'Maintain an asset inventory. Assign asset owners. Review inventory quarterly.',
    weight: 3,
  },
  {
    code: 'A.8.2',
    title: 'Information Classification',
    description:
      'Information shall be classified in terms of legal requirements, value, criticality and sensitivity to unauthorized disclosure.',
    category: 'Asset Management',
    guidance:
      'Define data classification tiers (Public, Internal, Confidential, Restricted). Label all data.',
    weight: 4,
  },
  {
    code: 'A.9.1',
    title: 'Business Requirements of Access Control',
    description:
      'An access control policy shall be established, documented and reviewed based on business and information security requirements.',
    category: 'Access Control',
    guidance:
      'Document access control policy. Define need-to-know principle. Review policy annually.',
    weight: 4,
  },
  {
    code: 'A.9.2',
    title: 'User Access Management',
    description:
      'A formal user registration and de-registration process shall be implemented to enable assignment of access rights.',
    category: 'Access Control',
    guidance:
      'Implement formal provisioning and deprovisioning. Conduct access recertification reviews quarterly.',
    weight: 4,
  },
  {
    code: 'A.9.3',
    title: 'User Responsibilities',
    description:
      'Users shall be required to follow the organization\'s practices in the use of secret authentication information.',
    category: 'Access Control',
    guidance:
      'Enforce password policy. Require MFA. Train users on credential hygiene.',
    weight: 3,
  },
  {
    code: 'A.9.4',
    title: 'System and Application Access Control',
    description:
      'Access to systems and applications shall be controlled by a secure log-on procedure.',
    category: 'Access Control',
    guidance:
      'Implement SSO where possible. Enforce MFA for all privileged access. Use password manager.',
    weight: 4,
  },
  {
    code: 'A.10.1',
    title: 'Cryptographic Controls',
    description:
      'A policy on the use of cryptographic controls for protection of information shall be developed and implemented.',
    category: 'Cryptography',
    guidance:
      'Define encryption standards (AES-256, TLS 1.2+). Implement key management. Encrypt data at rest and in transit.',
    weight: 4,
  },
  {
    code: 'A.11.1',
    title: 'Secure Areas',
    description:
      'Security perimeters shall be defined and used to protect areas that contain sensitive or critical information.',
    category: 'Physical and Environmental Security',
    guidance:
      'Define physical security perimeters. Implement badge access. Monitor with CCTV where applicable.',
    weight: 2,
  },
  {
    code: 'A.12.1',
    title: 'Operational Procedures and Responsibilities',
    description:
      'Operating procedures shall be documented and made available to all users who need them.',
    category: 'Operations Security',
    guidance:
      'Document runbooks for all critical systems. Review and update procedures quarterly.',
    weight: 3,
  },
  {
    code: 'A.12.2',
    title: 'Protection from Malware',
    description:
      'Detection, prevention and recovery controls to protect against malware shall be implemented.',
    category: 'Operations Security',
    guidance:
      'Deploy endpoint protection on all systems. Configure automatic updates. Implement email filtering.',
    weight: 4,
  },
  {
    code: 'A.12.3',
    title: 'Backup',
    description:
      'Backup copies of information, software and system images shall be taken and tested regularly.',
    category: 'Operations Security',
    guidance:
      'Implement automated backups. Test restoration quarterly. Store backups off-site or in separate region.',
    weight: 4,
  },
  {
    code: 'A.12.4',
    title: 'Logging and Monitoring',
    description:
      'Event logs recording user activities, exceptions, faults and information security events shall be produced, kept and regularly reviewed.',
    category: 'Operations Security',
    guidance:
      'Enable audit logging on all systems. Centralize logs. Retain for minimum 1 year. Review weekly.',
    weight: 4,
  },
  {
    code: 'A.12.6',
    title: 'Management of Technical Vulnerabilities',
    description:
      'Information about technical vulnerabilities of information systems being used shall be obtained in a timely fashion.',
    category: 'Operations Security',
    guidance:
      'Run automated vulnerability scans. Establish patch management policy. Remediate critical within 30 days.',
    weight: 4,
  },
  {
    code: 'A.13.1',
    title: 'Network Security Management',
    description:
      'Networks shall be managed and controlled to protect information in systems and applications.',
    category: 'Communications Security',
    guidance:
      'Implement network segmentation. Configure firewall rules. Use VPN for remote access.',
    weight: 4,
  },
  {
    code: 'A.14.1',
    title: 'Security Requirements of Information Systems',
    description:
      'The information security related requirements shall be included in the requirements for new information systems.',
    category: 'System Acquisition, Development and Maintenance',
    guidance:
      'Include security requirements in SDLC. Conduct threat modeling for new features. Run SAST in CI/CD.',
    weight: 3,
  },
  {
    code: 'A.15.1',
    title: 'Information Security in Supplier Relationships',
    description:
      'Information security requirements for mitigating the risks associated with supplier\'s access to the organization\'s assets shall be agreed with the supplier.',
    category: 'Supplier Relationships',
    guidance:
      'Conduct vendor risk assessments. Include security clauses in contracts. Review vendor SOC 2 reports.',
    weight: 3,
  },
  {
    code: 'A.16.1',
    title: 'Management of Information Security Incidents',
    description:
      'Management responsibilities and procedures shall be established to ensure a quick, effective and orderly response to information security incidents.',
    category: 'Information Security Incident Management',
    guidance:
      'Create and test incident response plan. Define severity levels. Train response team. Conduct post-mortems.',
    weight: 5,
  },
  {
    code: 'A.17.1',
    title: 'Information Security Continuity',
    description:
      'The organization shall determine its requirements for information security and the continuity of information security management in adverse situations.',
    category: 'Business Continuity Management',
    guidance:
      'Develop BCP with security considerations. Test disaster recovery annually. Define RTO and RPO.',
    weight: 3,
  },
  {
    code: 'A.18.1',
    title: 'Compliance with Legal and Contractual Requirements',
    description:
      'All relevant legislative, statutory, regulatory, contractual requirements and the organization\'s approach to meet these requirements shall be explicitly identified.',
    category: 'Compliance',
    guidance:
      'Identify all applicable regulations. Maintain compliance register. Review with legal counsel annually.',
    weight: 3,
  },
];

// ─── Seed Function ────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed SOC 2 Framework
  const soc2Framework = await prisma.framework.upsert({
    where: { type_version: { type: FrameworkType.SOC2, version: 'Type II 2022' } },
    update: {},
    create: {
      name: 'SOC 2',
      type: FrameworkType.SOC2,
      version: 'Type II 2022',
      description:
        'Service Organization Control 2 — Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy.',
      isActive: true,
    },
  });
  console.log(`✅ Framework created: ${soc2Framework.name}`);

  // Seed ISO 27001 Framework
  const iso27001Framework = await prisma.framework.upsert({
    where: { type_version: { type: FrameworkType.ISO27001, version: '2022' } },
    update: {},
    create: {
      name: 'ISO/IEC 27001',
      type: FrameworkType.ISO27001,
      version: '2022',
      description:
        'International standard for information security management systems (ISMS).',
      isActive: true,
    },
  });
  console.log(`✅ Framework created: ${iso27001Framework.name}`);

  // Seed SOC 2 Controls
  for (const control of SOC2_CONTROLS) {
    await prisma.control.upsert({
      where: { frameworkId_code: { frameworkId: soc2Framework.id, code: control.code } },
      update: {
        title: control.title,
        description: control.description,
        guidance: control.guidance,
        weight: control.weight,
      },
      create: {
        frameworkId: soc2Framework.id,
        ...control,
      },
    });
  }
  console.log(`✅ Seeded ${SOC2_CONTROLS.length} SOC 2 controls`);

  // Seed ISO 27001 Controls
  for (const control of ISO27001_CONTROLS) {
    await prisma.control.upsert({
      where: { frameworkId_code: { frameworkId: iso27001Framework.id, code: control.code } },
      update: {
        title: control.title,
        description: control.description,
        guidance: control.guidance,
        weight: control.weight,
      },
      create: {
        frameworkId: iso27001Framework.id,
        ...control,
      },
    });
  }
  console.log(`✅ Seeded ${ISO27001_CONTROLS.length} ISO 27001 controls`);

  // ─── Demo Organization & Users ──────────────────────────────────────────────

  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-org' },
    create: {
      name: 'Acme Corp (Demo)',
      slug: 'demo-org',
      plan: Plan.pro,
    },
    update: {},
  });
  console.log(`✅ Demo organization: ${demoOrg.name}`);

  const passwordHash = await bcrypt.hash('Demo1234!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    create: {
      orgId: demoOrg.id,
      email: 'admin@demo.com',
      passwordHash,
      fullName: 'Alice Admin',
      role: UserRole.admin,
    },
    update: {},
  });

  const auditorUser = await prisma.user.upsert({
    where: { email: 'security@demo.com' },
    create: {
      orgId: demoOrg.id,
      email: 'security@demo.com',
      passwordHash,
      fullName: 'Sam Security',
      role: UserRole.auditor,
    },
    update: {},
  });

  const memberUser = await prisma.user.upsert({
    where: { email: 'contributor@demo.com' },
    create: {
      orgId: demoOrg.id,
      email: 'contributor@demo.com',
      passwordHash,
      fullName: 'Chris Contributor',
      role: UserRole.member,
    },
    update: {},
  });

  console.log(`✅ Demo users: ${adminUser.email}, ${auditorUser.email}, ${memberUser.email}`);

  // ─── Business Profile ────────────────────────────────────────────────────────

  await prisma.businessProfile.upsert({
    where: { orgId: demoOrg.id },
    create: {
      orgId: demoOrg.id,
      companyName: 'Acme Corp',
      companyType: CompanyType.smb,
      industry: Industry.saas,
      employeeCount: '11-50',
      engineeringCount: '8-15',
      foundedYear: 2020,
      hqCountry: 'US',
      operatesIn: ['US', 'EU'],
      infrastructure: {
        cloudProviders: ['AWS'],
        hostingModel: 'cloud',
        regions: ['us-east-1', 'eu-west-1'],
      },
      tools: {
        versionControl: ['github'],
        cicd: ['github_actions'],
        monitoring: ['datadog'],
        communication: ['slack'],
      },
      dataHandling: {
        dataTypes: ['pii', 'confidential'],
        gdprRelevant: true,
        dataResidency: ['US', 'EU'],
        encryptionAtRest: true,
        encryptionInTransit: true,
      },
      currentPosture: {
        hasSecurityTeam: false,
        hasCISO: false,
        lastPenTest: null,
        hasIncidentResponsePlan: false,
        mfaEnabled: false,
      },
      complianceGoals: {
        frameworks: ['soc2', 'iso27001'],
        soc2Scope: ['security', 'availability'],
        targetDate: '2026-12-01',
        primaryDriver: 'customer_request',
      },
      riskProfile: {
        riskAppetite: 'low',
        criticalAssets: ['production database', 'customer data'],
      },
      confidenceScores: {
        infrastructure: 0.9,
        dataHandling: 0.85,
        complianceGoals: 0.95,
      },
      collectedVia: CollectedVia.onboarding_agent,
      isComplete: false,
      completedAt: null,
    },
    update: {},
  });
  console.log(`✅ Business profile seeded`);

  // ─── SOC 2 Scope ─────────────────────────────────────────────────────────────

  const existingSoc2Scope = await prisma.soc2Scope.findFirst({
    where: { orgId: demoOrg.id },
  });

  let soc2Scope = existingSoc2Scope;
  if (!soc2Scope) {
    soc2Scope = await prisma.soc2Scope.create({
      data: {
        orgId: demoOrg.id,
        trustServiceCategories: ['security', 'availability'],
        auditType: 'type_ii',
        systemsInScope: [
          { name: 'Production API', description: 'Main SaaS backend (AWS us-east-1)' },
          { name: 'Web Application', description: 'Customer-facing Next.js frontend' },
          { name: 'Data Pipeline', description: 'ETL jobs processing customer data' },
        ],
        systemsOutOfScope: [
          { name: 'Development Environment', rationale: 'No customer data processed' },
        ],
        dataInScope: [
          { type: 'pii', description: 'Customer names, emails, payment info' },
          { type: 'confidential', description: 'Business-critical configuration and secrets' },
        ],
        status: 'approved',
        approvedBy: adminUser.id,
        approvedAt: new Date('2026-01-20T14:00:00Z'),
        version: 1,
      },
    });
  }
  console.log(`✅ SOC 2 scope seeded`);

  // ─── Control Lookup Helper ────────────────────────────────────────────────────

  const allControls = await prisma.control.findMany({
    select: { id: true, code: true, frameworkId: true },
  });

  const controlByCode = new Map(allControls.map((c) => [c.code, c.id]));

  const getControlId = (code: string): string | undefined => controlByCode.get(code);

  // ─── Control Applicability (30 records) ──────────────────────────────────────

  const applicableSOC2 = [
    'CC1.1', 'CC1.2', 'CC1.3', 'CC1.4', 'CC1.5',
    'CC2.1', 'CC2.2', 'CC2.3',
    'CC3.1', 'CC3.2', 'CC3.3', 'CC3.4',
    'CC4.1', 'CC4.2',
    'CC5.1', 'CC5.2', 'CC5.3',
    'CC6.1', 'CC6.2', 'CC6.3', 'CC6.5', 'CC6.6', 'CC6.7',
    'CC7.1', 'CC7.2', 'CC7.3', 'CC7.4',
    'CC8.1',
    'CC9.1', 'CC9.2',
  ];

  const notApplicableSOC2 = ['CC6.4']; // physical access — cloud-only

  let applicabilityCount = 0;
  for (const code of applicableSOC2) {
    const controlId = getControlId(code);
    if (!controlId) continue;
    await prisma.controlApplicability.upsert({
      where: { orgId_controlId: { orgId: demoOrg.id, controlId } },
      create: {
        orgId: demoOrg.id,
        controlId,
        applicable: true,
        applicabilityStatus: 'applicable',
        rationale: 'SOC 2 security scope selected; SaaS company with cloud infrastructure',
        confidence: 'high',
        requiresHumanReview: false,
        profileVersionUsed: 1,
      },
      update: {},
    });
    applicabilityCount++;
  }

  for (const code of notApplicableSOC2) {
    const controlId = getControlId(code);
    if (!controlId) continue;
    await prisma.controlApplicability.upsert({
      where: { orgId_controlId: { orgId: demoOrg.id, controlId } },
      create: {
        orgId: demoOrg.id,
        controlId,
        applicable: false,
        applicabilityStatus: 'not_applicable',
        rationale: 'Cloud-only company with no physical office or on-premise infrastructure',
        confidence: 'high',
        requiresHumanReview: false,
        profileVersionUsed: 1,
      },
      update: {},
    });
    applicabilityCount++;
  }
  console.log(`✅ Control applicability: ${applicabilityCount} records`);

  // ─── Organization Controls (15 records) ──────────────────────────────────────

  const orgControlData: Array<{ code: string; status: ControlStatus }> = [
    // Implemented
    { code: 'CC1.1', status: ControlStatus.implemented },
    { code: 'CC2.1', status: ControlStatus.implemented },
    { code: 'CC6.1', status: ControlStatus.implemented },
    { code: 'CC7.1', status: ControlStatus.implemented },
    { code: 'A.5.1', status: ControlStatus.implemented },
    // In progress
    { code: 'CC3.1', status: ControlStatus.in_progress },
    { code: 'CC4.1', status: ControlStatus.in_progress },
    { code: 'CC6.2', status: ControlStatus.in_progress },
    { code: 'CC8.1', status: ControlStatus.in_progress },
    { code: 'A.9.1', status: ControlStatus.in_progress },
    // Not started
    { code: 'CC5.1', status: ControlStatus.not_started },
    { code: 'CC9.1', status: ControlStatus.not_started },
    { code: 'CC9.2', status: ControlStatus.not_started },
    { code: 'A.10.1', status: ControlStatus.not_started },
    { code: 'A.12.1', status: ControlStatus.not_started },
  ];

  let orgControlCount = 0;
  for (const entry of orgControlData) {
    const controlId = getControlId(entry.code);
    if (!controlId) continue;
    await prisma.organizationControl.upsert({
      where: { orgId_controlId: { orgId: demoOrg.id, controlId } },
      create: {
        orgId: demoOrg.id,
        controlId,
        status: entry.status,
        assignedTo: memberUser.id,
        score: entry.status === ControlStatus.implemented ? 90 : entry.status === ControlStatus.in_progress ? 50 : 0,
        reviewStatus: entry.status === ControlStatus.implemented ? ReviewStatus.passed : null,
        notes: entry.status === ControlStatus.implemented
          ? 'Control implemented and verified'
          : entry.status === ControlStatus.in_progress
          ? 'Work in progress — evidence collection underway'
          : null,
      },
      update: {},
    });
    orgControlCount++;
  }
  console.log(`✅ Organization controls: ${orgControlCount} records`);

  // ─── Policies (5 records) ─────────────────────────────────────────────────────

  const policyData = [
    {
      code: 'CC6.1',
      title: 'Access Control Policy',
      status: PolicyStatus.approved,
      content: `# Access Control Policy\n\n## Purpose\nThis policy establishes requirements for controlling access to Acme Corp systems and data.\n\n## Scope\nAll employees, contractors, and systems that access Acme Corp information assets.\n\n## Requirements\n1. All users must authenticate with MFA\n2. Access follows least-privilege principle\n3. Access reviews conducted quarterly\n4. Access revoked within 24 hours of termination\n\n## Controls\nCC6.1, CC6.2, CC6.3`,
    },
    {
      code: 'A.5.1',
      title: 'Information Security Policy',
      status: PolicyStatus.approved,
      content: `# Information Security Policy\n\n## Purpose\nEstablish management direction and support for information security.\n\n## Scope\nAll information assets owned or managed by Acme Corp.\n\n## Statement\nAcme Corp is committed to protecting its information assets from unauthorized access, modification, or destruction.\n\n## Review\nThis policy is reviewed annually by senior management.`,
    },
    {
      code: 'CC7.4',
      title: 'Incident Response Policy',
      status: PolicyStatus.draft,
      content: `# Incident Response Policy\n\n## Purpose\nDefine how Acme Corp responds to information security incidents.\n\n## Incident Classification\n- P0: Critical — customer data breach\n- P1: High — service disruption\n- P2: Medium — internal system compromise\n\n## Response Procedures\n[DRAFT — to be completed by security team]\n\n## Controls\nCC7.3, CC7.4`,
    },
    {
      code: 'CC9.1',
      title: 'Business Continuity Policy',
      status: PolicyStatus.draft,
      content: `# Business Continuity Policy\n\n## Purpose\nEnsure critical business operations can continue during disruptions.\n\n## RTO and RPO\n- RTO: 4 hours for critical systems\n- RPO: 1 hour for production database\n\n## [DRAFT — BCP testing schedule TBD]`,
    },
    {
      code: 'CC9.2',
      title: 'Vendor Management Policy',
      status: PolicyStatus.draft,
      content: `# Vendor Management Policy\n\n## Purpose\nManage risks associated with third-party vendors and business partners.\n\n## Vendor Risk Tiers\n- Tier 1: Access to customer data\n- Tier 2: Access to internal systems\n- Tier 3: No sensitive access\n\n## Requirements\n[DRAFT — vendor assessment process TBD]`,
    },
  ];

  let policyCount = 0;
  for (const pol of policyData) {
    const controlId = getControlId(pol.code);
    if (!controlId) continue;
    const existing = await prisma.policy.findFirst({
      where: { orgId: demoOrg.id, title: pol.title },
    });
    if (!existing) {
      await prisma.policy.create({
        data: {
          orgId: demoOrg.id,
          controlId,
          title: pol.title,
          content: pol.content,
          status: pol.status,
          version: 1,
          generatedBy: GeneratedBy.agent,
          approvedBy: pol.status === PolicyStatus.approved ? adminUser.id : null,
          approvedAt: pol.status === PolicyStatus.approved ? new Date('2026-01-25T10:00:00Z') : null,
        },
      });
      policyCount++;
    }
  }
  console.log(`✅ Policies: ${policyCount} created`);

  // ─── Evidence (10 records) ────────────────────────────────────────────────────

  const evidenceData = [
    { code: 'CC6.1', title: 'MFA Configuration Screenshot — AWS IAM', type: EvidenceType.screenshot, source: EvidenceSource.integration, isValid: true, daysUntilExpiry: 90 },
    { code: 'CC6.1', title: 'Access Control Policy Document v1', type: EvidenceType.document, source: EvidenceSource.agent_generated, isValid: true, daysUntilExpiry: 365 },
    { code: 'CC7.1', title: 'Vulnerability Scan Report — January 2026', type: EvidenceType.log, source: EvidenceSource.integration, isValid: true, daysUntilExpiry: 60 },
    { code: 'CC7.2', title: 'Datadog Alert Configuration Export', type: EvidenceType.api_response, source: EvidenceSource.integration, isValid: true, daysUntilExpiry: 180 },
    { code: 'A.5.1', title: 'Information Security Policy Acknowledgment Log', type: EvidenceType.document, source: EvidenceSource.manual_upload, isValid: true, daysUntilExpiry: 365 },
    { code: 'CC8.1', title: 'GitHub PR Review Policy Configuration', type: EvidenceType.screenshot, source: EvidenceSource.integration, isValid: true, daysUntilExpiry: 90 },
    { code: 'CC6.3', title: 'Q4 2025 Access Recertification Report', type: EvidenceType.document, source: EvidenceSource.manual_upload, isValid: false, daysUntilExpiry: -30 },
    { code: 'CC3.2', title: 'Annual Risk Assessment Report 2025', type: EvidenceType.document, source: EvidenceSource.agent_generated, isValid: true, daysUntilExpiry: 120 },
    { code: 'A.12.3', title: 'Backup Restoration Test Results', type: EvidenceType.log, source: EvidenceSource.manual_upload, isValid: false, daysUntilExpiry: -10 },
    { code: 'CC4.1', title: 'Security Monitoring Dashboard Export', type: EvidenceType.screenshot, source: EvidenceSource.integration, isValid: true, daysUntilExpiry: 45 },
  ];

  let evidenceCount = 0;
  for (const ev of evidenceData) {
    const controlId = getControlId(ev.code);
    if (!controlId) continue;
    const existing = await prisma.evidence.findFirst({
      where: { orgId: demoOrg.id, title: ev.title },
    });
    if (!existing) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + ev.daysUntilExpiry);
      await prisma.evidence.create({
        data: {
          orgId: demoOrg.id,
          controlId,
          title: ev.title,
          type: ev.type,
          source: ev.source,
          isValid: ev.isValid,
          expiresAt,
          collectedAt: new Date(),
          metadata: { seeded: true },
        },
      });
      evidenceCount++;
    }
  }
  console.log(`✅ Evidence: ${evidenceCount} items created`);

  // ─── Risk Items (10 records) ──────────────────────────────────────────────────

  const riskData = [
    {
      code: 'CC6.1',
      title: 'No MFA on admin accounts',
      description: 'Several admin accounts in AWS IAM and GitHub do not have MFA enforced, creating significant unauthorized access risk.',
      likelihood: RiskLikelihood.likely,
      impact: RiskImpact.catastrophic,
      riskScore: 20,
      severity: 'critical',
      status: RiskStatus.open,
      mitigationAdvice: 'Enable MFA enforcement policy in AWS IAM. Remove all console access for service accounts.',
    },
    {
      code: 'CC6.7',
      title: 'Unencrypted PII in S3 development bucket',
      description: 'A development S3 bucket contains copies of production customer PII without encryption or access controls.',
      likelihood: RiskLikelihood.possible,
      impact: RiskImpact.major,
      riskScore: 12,
      severity: 'high',
      status: RiskStatus.open,
      mitigationAdvice: 'Enable S3 bucket encryption. Move PII to dedicated encrypted bucket with strict IAM policies.',
    },
    {
      code: 'CC7.2',
      title: 'Outdated SSL certificates on internal services',
      description: 'Three internal microservices have SSL certificates expiring within 14 days with no automated renewal.',
      likelihood: RiskLikelihood.almost_certain,
      impact: RiskImpact.moderate,
      riskScore: 15,
      severity: 'high',
      status: RiskStatus.mitigated,
      mitigationAdvice: 'Implement Let\'s Encrypt auto-renewal. Set up certificate expiry monitoring.',
    },
    {
      code: 'CC9.2',
      title: 'No formal vendor risk assessments',
      description: 'Critical vendors including payment processor and data warehouse have not been assessed for security posture.',
      likelihood: RiskLikelihood.possible,
      impact: RiskImpact.major,
      riskScore: 12,
      severity: 'high',
      status: RiskStatus.open,
      mitigationAdvice: 'Request SOC 2 reports from critical vendors. Implement annual vendor assessment process.',
    },
    {
      code: 'CC7.3',
      title: 'Incident response plan not tested',
      description: 'The incident response plan has never been exercised in a tabletop exercise or real incident.',
      likelihood: RiskLikelihood.possible,
      impact: RiskImpact.major,
      riskScore: 12,
      severity: 'medium',
      status: RiskStatus.open,
      mitigationAdvice: 'Schedule quarterly tabletop exercises. Define clear incident severity levels and escalation paths.',
    },
    {
      code: 'CC6.3',
      title: 'Excessive admin privileges in production',
      description: 'Multiple developers have direct production database access and AWS root credentials are used for daily operations.',
      likelihood: RiskLikelihood.likely,
      impact: RiskImpact.major,
      riskScore: 16,
      severity: 'high',
      status: RiskStatus.open,
      mitigationAdvice: 'Implement least-privilege IAM policies. Rotate and vault root credentials. Use separate deploy roles.',
    },
    {
      code: 'CC7.2',
      title: 'Insufficient log retention policy',
      description: 'CloudWatch logs are retained for only 7 days. SOC 2 requires minimum 1 year retention for security logs.',
      likelihood: RiskLikelihood.almost_certain,
      impact: RiskImpact.moderate,
      riskScore: 15,
      severity: 'medium',
      status: RiskStatus.open,
      mitigationAdvice: 'Update CloudWatch log group retention to 365 days. Export to S3 for long-term archival.',
    },
    {
      code: 'CC9.1',
      title: 'Missing business continuity documentation',
      description: 'No formal BCP exists. Recovery procedures are undocumented and known only to founding engineers.',
      likelihood: RiskLikelihood.unlikely,
      impact: RiskImpact.major,
      riskScore: 8,
      severity: 'medium',
      status: RiskStatus.open,
      mitigationAdvice: 'Document all recovery runbooks. Define RTO/RPO for each critical service. Test annually.',
    },
    {
      code: 'A.15.1',
      title: 'Missing data processing agreements with processors',
      description: 'Three third-party data processors handling EU customer data lack signed DPAs, creating GDPR exposure.',
      likelihood: RiskLikelihood.unlikely,
      impact: RiskImpact.moderate,
      riskScore: 6,
      severity: 'low',
      status: RiskStatus.open,
      mitigationAdvice: 'Execute DPAs with all processors handling EU data. Maintain processor register.',
    },
    {
      code: 'A.10.1',
      title: 'Cryptographic key rotation overdue',
      description: 'Production encryption keys have not been rotated in 18 months. Policy requires annual rotation.',
      likelihood: RiskLikelihood.unlikely,
      impact: RiskImpact.moderate,
      riskScore: 6,
      severity: 'low',
      status: RiskStatus.open,
      mitigationAdvice: 'Rotate all production encryption keys. Implement automated key rotation policy in AWS KMS.',
    },
  ];

  let riskCount = 0;
  const riskIdMap = new Map<string, string>();
  for (const risk of riskData) {
    const controlId = getControlId(risk.code);
    const existing = await prisma.riskItem.findFirst({
      where: { orgId: demoOrg.id, title: risk.title },
    });
    if (!existing) {
      const created = await prisma.riskItem.create({
        data: {
          orgId: demoOrg.id,
          controlId: controlId ?? null,
          title: risk.title,
          description: risk.description,
          likelihood: risk.likelihood,
          impact: risk.impact,
          riskScore: risk.riskScore,
          severity: risk.severity,
          status: risk.status,
          mitigationAdvice: risk.mitigationAdvice,
          identifiedBy: GeneratedBy.agent,
          owner: memberUser.id,
        },
      });
      riskIdMap.set(risk.title, created.id);
      riskCount++;
    }
  }
  console.log(`✅ Risk items: ${riskCount} created`);

  // ─── Tasks (15 records) ───────────────────────────────────────────────────────

  const now = new Date();
  const daysFromNow = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d;
  };

  const taskData = [
    { title: 'Enable MFA enforcement for all AWS IAM users', code: 'CC6.1', priority: TaskPriority.critical, status: TaskStatus.in_progress, daysFromNow: 3 },
    { title: 'Remove PII from S3 development bucket and enable encryption', code: 'CC6.7', priority: TaskPriority.critical, status: TaskStatus.open, daysFromNow: 5 },
    { title: 'Renew SSL certificates for internal microservices', code: 'CC7.2', priority: TaskPriority.high, status: TaskStatus.done, daysFromNow: -2 },
    { title: 'Request SOC 2 reports from critical vendors (Stripe, Snowflake)', code: 'CC9.2', priority: TaskPriority.high, status: TaskStatus.in_progress, daysFromNow: 14 },
    { title: 'Schedule Q1 incident response tabletop exercise', code: 'CC7.3', priority: TaskPriority.high, status: TaskStatus.open, daysFromNow: 21 },
    { title: 'Implement least-privilege IAM roles for production access', code: 'CC6.3', priority: TaskPriority.high, status: TaskStatus.in_progress, daysFromNow: 10 },
    { title: 'Update CloudWatch log retention to 365 days', code: 'CC7.2', priority: TaskPriority.medium, status: TaskStatus.open, daysFromNow: 7 },
    { title: 'Document business continuity plan and recovery runbooks', code: 'CC9.1', priority: TaskPriority.medium, status: TaskStatus.open, daysFromNow: 30 },
    { title: 'Execute DPAs with EU data processors', code: 'A.15.1', priority: TaskPriority.medium, status: TaskStatus.in_progress, daysFromNow: 14 },
    { title: 'Rotate production encryption keys in AWS KMS', code: 'A.10.1', priority: TaskPriority.medium, status: TaskStatus.open, daysFromNow: 21 },
    { title: 'Complete access recertification review for Q1 2026', code: 'CC6.3', priority: TaskPriority.high, status: TaskStatus.open, daysFromNow: -5 },
    { title: 'Upload backup restoration test evidence', code: 'A.12.3', priority: TaskPriority.medium, status: TaskStatus.open, daysFromNow: 7 },
    { title: 'Draft vendor management policy', code: 'CC9.2', priority: TaskPriority.medium, status: TaskStatus.in_progress, daysFromNow: 21 },
    { title: 'Deploy endpoint protection to all developer laptops', code: 'CC6.6', priority: TaskPriority.high, status: TaskStatus.done, daysFromNow: -7 },
    { title: 'Complete annual security awareness training for all staff', code: 'A.7.2', priority: TaskPriority.medium, status: TaskStatus.open, daysFromNow: 45 },
  ];

  let taskCount = 0;
  for (const t of taskData) {
    const controlId = getControlId(t.code);
    const existing = await prisma.task.findFirst({
      where: { orgId: demoOrg.id, title: t.title },
    });
    if (!existing) {
      await prisma.task.create({
        data: {
          orgId: demoOrg.id,
          controlId: controlId ?? null,
          title: t.title,
          priority: t.priority,
          status: t.status,
          assignedTo: memberUser.id,
          dueDate: daysFromNow(t.daysFromNow),
          source: TaskSource.agent,
        },
      });
      taskCount++;
    }
  }
  console.log(`✅ Tasks: ${taskCount} created`);

  // ─── Readiness Score Snapshot ─────────────────────────────────────────────────

  const existingScore = await prisma.readinessScore.findFirst({
    where: { orgId: demoOrg.id },
  });

  if (!existingScore) {
    await prisma.readinessScore.create({
      data: {
        orgId: demoOrg.id,
        framework: 'SOC2',
        overallScore: 49,
        controlDesignScore: 52,
        evidenceScore: 45,
        policyScore: 40,
        operationalScore: 60,
        riskManagementScore: 0,
        formulaVersion: 'v1',
        scoreInputs: {
          applicableControls: 30,
          implementedControls: 5,
          inProgressControls: 5,
          validEvidenceItems: 8,
          requiredEvidenceItems: 18,
          approvedPolicies: 2,
          requiredPolicies: 5,
          openHighRisks: 4,
          totalHighRisks: 5,
          overdueTasks: 2,
          totalTasks: 13,
        },
      },
    });
    console.log(`✅ Readiness score snapshot created`);
  }

  // ─── Prompt Templates (20 agents) ────────────────────────────────────────────

  const PROMPT_TEMPLATES = [
    {
      templateId: 'scoping-agent',
      version: 'v2.1',
      agentName: 'ScopingAgent',
      taskType: 'scope_definition',
      purpose: 'Define system scope for compliance audit',
      systemPrompt: `You are a compliance scoping expert defining the audit boundary for {{frameworkType}}.

Connected systems and integrations:
{{integrations}}

For SOC 2 scoping, determine:
1. Systems in scope (with business justification)
2. Systems out of scope (with exclusion rationale)
3. Applicable Trust Service Categories
4. Data types in scope
5. Ambiguous items requiring human review

Be conservative — when uncertain, include in scope and flag as ambiguous.

Return as structured JSON matching the ScopeDocument schema.`,
      inputVariables: ['frameworkType', 'integrations', 'existingScope'],
    },
    {
      templateId: 'onboarding-agent',
      version: 'v1.3',
      agentName: 'OnboardingAgent',
      taskType: 'onboarding_dialogue',
      purpose: 'Collect business profile through natural multi-turn conversation',
      systemPrompt: `You are a friendly compliance onboarding assistant for {{orgName}}.

Your job is to collect information about the company through natural conversation, not a form.

Conversation so far:
{{conversationHistory}}

Existing profile data:
{{existingProfile}}

Ask the single most important missing question next. Be conversational and concise.
Extract any structured data from the user's response and update the profile.

Return JSON with: { nextMessage, extractedFields, completionScore, nextField }`,
      inputVariables: ['message', 'conversationHistory', 'existingProfile', 'orgName'],
    },
    {
      templateId: 'gap-analysis-agent',
      version: 'v3.0',
      agentName: 'GapAnalysisAgent',
      taskType: 'gap_analysis',
      purpose: 'Identify control gaps against framework requirements',
      systemPrompt: `You are a compliance expert analyzing control gaps for a {{frameworkType}} audit.

Given the following controls and their implementation status:
{{controls}}

And the framework requirements:
{{frameworkRequirements}}

Identify gaps and provide:
1. Gap severity (critical/high/medium/low)
2. Affected controls
3. Recommended remediation steps
4. Estimated implementation effort

Return as structured JSON matching the GapReport schema.`,
      inputVariables: ['frameworkType', 'controls', 'frameworkRequirements', 'evidence'],
    },
    {
      templateId: 'evidence-agent',
      version: 'v1.8',
      agentName: 'EvidenceAgent',
      taskType: 'evidence_collection',
      purpose: 'Collect, classify, and map evidence to controls from integrations',
      systemPrompt: `You are a compliance evidence collector analyzing artifacts from {{integrationName}}.

Integration data:
{{integrationData}}

Target controls requiring evidence:
{{controlIds}}

For each artifact found:
1. Classify the evidence type (screenshot/log/document/api_response/config)
2. Determine which controls it satisfies
3. Assess evidence quality (strong/adequate/weak/insufficient)
4. Flag missing required evidence

Return as structured JSON matching the EvidenceCollection schema.`,
      inputVariables: ['integrationName', 'integrationData', 'controlIds'],
    },
    {
      templateId: 'policy-agent',
      version: 'v2.3',
      agentName: 'PolicyAgent',
      taskType: 'policy_generation',
      purpose: 'Generate compliance policy documents',
      systemPrompt: `You are a compliance policy writer creating {{policyType}} policy for {{orgName}}.

Organization context:
- Industry: {{industry}}
- Framework: {{framework}}
- Existing policies: {{existingPolicies}}

Generate a comprehensive policy that:
1. Meets {{framework}} requirements
2. Is practical for a {{orgSize}} organization
3. Uses clear, actionable language
4. Maps to specific control requirements

Return as Markdown with proper headings and sections.`,
      inputVariables: ['policyType', 'orgName', 'industry', 'framework', 'existingPolicies', 'orgSize'],
    },
    {
      templateId: 'review-agent',
      version: 'v1.4',
      agentName: 'ReviewAgent',
      taskType: 'compliance_review',
      purpose: 'Cross-validate policies, evidence, and controls for audit readiness',
      systemPrompt: `You are a senior compliance reviewer conducting a comprehensive {{framework}} readiness review.

Controls status:
{{controls}}

Evidence inventory:
{{evidence}}

Policies:
{{policies}}

Gap analysis report:
{{gapReport}}

Review for:
1. Policy-to-control coverage gaps
2. Evidence quality and recency issues
3. Inconsistencies between policies and actual implementations
4. Critical findings that would likely fail an audit
5. Items requiring human review

Return structured ReviewReport JSON with findings categorized by severity.`,
      inputVariables: ['framework', 'controls', 'evidence', 'policies', 'gapReport'],
    },
    {
      templateId: 'interview-agent',
      version: 'v1.1',
      agentName: 'InterviewAgent',
      taskType: 'interview_prep',
      purpose: 'Generate tailored auditor interview questions for weak control areas',
      systemPrompt: `You are a compliance expert preparing {{orgName}} for a {{framework}} auditor interview.

Weak control areas:
{{weakControls}}

Organization profile:
{{orgProfile}}

Generate 5-8 interview questions per weak control area that:
1. Are likely to be asked by an auditor
2. Are tailored to the org's specific tech stack and team
3. Include suggested answer frameworks
4. Map to specific control criteria

Return as structured JSON with questions grouped by control category.`,
      inputVariables: ['orgName', 'framework', 'weakControls', 'orgProfile', 'gapReport'],
    },
    {
      templateId: 'benchmark-agent',
      version: 'v1.0',
      agentName: 'BenchmarkAgent',
      taskType: 'benchmarking',
      purpose: 'Provide peer comparison and industry benchmarks for compliance maturity',
      systemPrompt: `You are a compliance benchmarking analyst comparing {{orgName}} against industry peers.

Organization profile:
- Industry: {{industry}}
- Size: {{orgSize}}
- Current readiness score: {{readinessScore}}

Benchmark data for {{industry}} companies of similar size:
{{benchmarkData}}

Provide:
1. Percentile rank for overall readiness
2. Comparison by control category
3. Most common gaps for peer cohort
4. Top differentiators of top-quartile performers
5. Actionable recommendations to improve ranking

Return as structured BenchmarkReport JSON.`,
      inputVariables: ['orgName', 'industry', 'orgSize', 'readinessScore', 'benchmarkData'],
    },
    {
      templateId: 'risk-scoring-agent',
      version: 'v1.6',
      agentName: 'RiskScoringAgent',
      taskType: 'risk_assessment',
      purpose: 'Score and categorize identified risks',
      systemPrompt: `You are a risk analyst scoring {{riskCount}} identified risks for {{orgName}}.

Risk items:
{{riskItems}}

Current controls:
{{controls}}

For each risk, calculate:
- Likelihood (1-5): Based on threat landscape and control gaps
- Impact (1-5): Based on data sensitivity and business criticality
- Inherent Risk Score: Likelihood × Impact
- Control Effectiveness (0-1): How well existing controls mitigate
- Residual Risk Score: Inherent × (1 - Control Effectiveness)

Return structured JSON matching the RiskMatrix schema.`,
      inputVariables: ['riskCount', 'orgName', 'riskItems', 'controls'],
    },
    {
      templateId: 'vendor-risk-agent',
      version: 'v1.2',
      agentName: 'VendorRiskAgent',
      taskType: 'vendor_risk_assessment',
      purpose: 'Evaluate third-party vendor security posture',
      systemPrompt: `You are a vendor risk analyst assessing third-party security posture for {{orgName}}.

Vendors to assess:
{{vendorList}}

Available vendor data (SOC 2 reports, security questionnaires, public info):
{{vendorData}}

For each vendor assess:
1. Inherent risk tier (Tier 1/2/3 based on data access)
2. Security posture score (0-100)
3. Key risk findings
4. Required contractual controls
5. Monitoring frequency recommendation

Return as structured VendorRiskReport JSON.`,
      inputVariables: ['orgName', 'vendorList', 'vendorData', 'integrations'],
    },
    {
      templateId: 'threat-intel-agent',
      version: 'v1.0',
      agentName: 'ThreatIntelAgent',
      taskType: 'threat_intelligence',
      purpose: "Map the threat landscape specific to the org's industry and tech stack",
      systemPrompt: `You are a threat intelligence analyst building a threat landscape for {{orgName}}.

Organization profile:
- Industry: {{industry}}
- Tech stack: {{techStack}}
- Current controls: {{controls}}

Analyze:
1. Relevant threat actor groups targeting {{industry}}
2. Most likely attack vectors given the tech stack
3. Controls gaps that create exposure
4. Recent CVEs relevant to the tech stack
5. Prioritized threat list with likelihood and potential impact

Return as structured ThreatLandscape JSON with prioritized threat list.`,
      inputVariables: ['orgName', 'industry', 'techStack', 'controls'],
    },
    {
      templateId: 'remediation-advisor-agent',
      version: 'v1.5',
      agentName: 'RemediationAdvisorAgent',
      taskType: 'remediation_planning',
      purpose: 'Generate stack-specific step-by-step remediation plans',
      systemPrompt: `You are a compliance remediation expert creating implementation plans for {{orgName}}.

Gap report:
{{gapReport}}

Organization context:
- Tech stack: {{techStack}}
- Team size: {{teamSize}}
- Cloud provider: {{cloudProvider}}

For each gap, generate:
1. Step-by-step implementation instructions specific to the tech stack
2. Time estimate (hours/days)
3. Required tools and access
4. Evidence to collect after implementation
5. Owner role recommendation

Prioritize by: critical → high → medium → low severity.

Return as structured RemediationPlan JSON with ordered task list.`,
      inputVariables: ['orgName', 'gapReport', 'techStack', 'teamSize', 'cloudProvider'],
    },
    {
      templateId: 'planner-agent',
      version: 'v1.2',
      agentName: 'PlannerAgent',
      taskType: 'roadmap_planning',
      purpose: 'Generate phased compliance roadmap with milestones',
      systemPrompt: `You are a compliance program manager creating a roadmap for {{orgName}} to achieve {{framework}} certification.

Current state:
- Readiness score: {{readinessScore}}
- Open controls: {{openControlCount}}
- Team size: {{teamSize}}
- Target audit date: {{targetDate}}

Create a phased roadmap:
Phase 1 (Weeks 1-4): Foundation — critical controls and policies
Phase 2 (Weeks 5-10): Implementation — evidence collection and automation
Phase 3 (Weeks 11-16): Validation — reviews, testing, and audit prep

For each phase:
1. Prioritized control list
2. Weekly milestones
3. Team capacity requirements
4. Velocity score and readiness forecast

Return as structured Roadmap JSON.`,
      inputVariables: ['orgName', 'framework', 'readinessScore', 'openControlCount', 'teamSize', 'targetDate'],
    },
    {
      templateId: 'drift-detector-agent',
      version: 'v1.1',
      agentName: 'DriftDetectorAgent',
      taskType: 'drift_detection',
      purpose: 'Detect compliance drift and stale evidence from approved baselines',
      systemPrompt: `You are a compliance drift detector monitoring {{orgName}} for deviations.

Current control state snapshot:
{{currentState}}

Approved baseline (last audit/review):
{{baselineState}}

For each deviation found:
1. Identify the drift type (evidence_expired/control_degraded/policy_changed/integration_disconnected)
2. Score severity (critical/high/medium/low)
3. Time since deviation started
4. Affected controls and TSC categories
5. Auto-remediation available (yes/no)

Return as structured DriftReport JSON with alert list sorted by severity.`,
      inputVariables: ['orgName', 'currentState', 'baselineState'],
    },
    {
      templateId: 'audit-agent',
      version: 'v1.2',
      agentName: 'AuditAgent',
      taskType: 'audit_report_generation',
      purpose: 'Generate complete audit-ready compliance reports',
      systemPrompt: `You are a compliance report author generating a formal {{framework}} audit readiness report for {{orgName}}.

Control implementation status:
{{controls}}

Evidence inventory:
{{evidence}}

Policies:
{{policies}}

Generate a complete audit report including:
1. Executive summary with readiness score
2. Scope statement
3. Control implementation status by category
4. Evidence coverage analysis
5. Open findings with severity ratings
6. Management responses for each finding
7. Remediation timeline

Format as formal audit report document in Markdown.`,
      inputVariables: ['orgName', 'framework', 'controls', 'evidence', 'policies'],
    },
    {
      templateId: 'control-mapper-agent',
      version: 'v1.0',
      agentName: 'ControlMapperAgent',
      taskType: 'control_mapping',
      purpose: 'Deterministic control applicability mapping (no LLM)',
      systemPrompt: `[DETERMINISTIC] ControlMapperAgent runs rule-based logic.

This agent does not use an LLM. It applies a deterministic ruleset:

1. Load org profile fields: industry, dataTypes, cloudProviders, operatesIn, companyType
2. Apply framework applicability rules:
   - CC6.4 (Physical Access): NOT_APPLICABLE if cloudOnly=true
   - HIPAA controls: APPLICABLE if dataTypes includes 'phi'
   - GDPR controls: APPLICABLE if operatesIn includes EU countries
3. Generate applicability matrix with confidence scores
4. Apply crosswalk credits from completed frameworks

Input: businessProfile, targetFrameworks
Output: applicabilityMatrix, crosswalkCredits, notApplicableRationale`,
      inputVariables: ['orgProfile', 'frameworks'],
    },
    {
      templateId: 'dashboard-agent',
      version: 'v1.1',
      agentName: 'DashboardAgent',
      taskType: 'dashboard_generation',
      purpose: 'Generate role-specific dashboard widget configuration (no LLM)',
      systemPrompt: `[DETERMINISTIC] DashboardAgent runs rule-based posture aggregation.

This agent does not use an LLM. It:

1. Fetches org posture snapshot from DB (controls, evidence, risks, tasks)
2. Computes widget data:
   - Readiness score gauge
   - Control status breakdown (implemented/in_progress/not_started)
   - Evidence expiry alerts (next 30/60/90 days)
   - Open task list sorted by due date
   - Risk heatmap by category
3. Applies role-based visibility rules:
   - admin: all widgets
   - auditor: controls, evidence, policies only
   - member: assigned tasks only

Input: orgId, userRole
Output: dashboardConfig with widgetData per section`,
      inputVariables: ['orgId', 'userRole'],
    },
    {
      templateId: 'inference-agent',
      version: 'v1.0',
      agentName: 'InferenceAgent',
      taskType: 'profile_inference',
      purpose: 'Infer frameworks, risk level, and required controls from business profile (no LLM)',
      systemPrompt: `[DETERMINISTIC] InferenceAgent applies rule-based inference to business profiles.

This agent does not use an LLM. Inference rules:

Framework inference:
- industry=saas + customerCount>100 → SOC2 required
- operatesIn=EU + dataTypes includes pii → GDPR required
- industry=healthcare + dataTypes includes phi → HIPAA required
- customerCount>500 + enterprise_contracts=true → ISO27001 recommended

Risk level inference:
- dataTypes includes phi OR pci_data → HIGH
- employeeCount<50 + noSecurityTeam → MEDIUM
- infrastructure=cloud_only + mfa_enabled → LOW

Input: businessProfile JSON
Output: { inferredFrameworks, riskLevel, requiredControls, confidence }`,
      inputVariables: ['businessProfile'],
    },
    {
      templateId: 'task-agent',
      version: 'v1.0',
      agentName: 'TaskAgent',
      taskType: 'task_generation',
      purpose: 'Generate remediation tasks from review findings',
      systemPrompt: `You are a compliance task manager generating action items for {{orgName}}.

Review findings:
{{findings}}

Organization users and roles:
{{orgUsers}}

Affected controls:
{{controls}}

For each finding, generate a task with:
1. Clear, actionable title (starts with a verb)
2. Priority (critical/high/medium/low) based on finding severity
3. Effort estimate (hours)
4. Suggested assignee role
5. Due date recommendation (relative to today)
6. Acceptance criteria for completion

Return as structured TaskList JSON sorted by priority descending.`,
      inputVariables: ['orgName', 'findings', 'orgUsers', 'controls'],
    },
    {
      templateId: 'validator-agent',
      version: 'v1.3',
      agentName: 'ValidatorAgent',
      taskType: 'control_validation',
      purpose: 'Validate control implementations against evidence and acceptance criteria',
      systemPrompt: `You are a compliance validator assessing control implementation quality for {{orgName}}.

Controls to validate:
{{controls}}

Evidence provided:
{{evidence}}

Organization risk level: {{riskLevel}}

For each control, validate:
1. Evidence completeness (all required evidence present?)
2. Evidence quality (does it actually prove the control?)
3. Evidence recency (within required refresh window?)
4. Policy alignment (implementation matches documented policy?)
5. Pass/Fail verdict with confidence score (0-1)

Apply stricter thresholds for HIGH risk organizations.

Return as structured ValidationResult JSON with pass/fail per control and rationale.`,
      inputVariables: ['orgName', 'controls', 'evidence', 'riskLevel'],
    },
  ];

  let promptCount = 0;
  for (const pt of PROMPT_TEMPLATES) {
    const contentHash = crypto.createHash('sha256').update(pt.systemPrompt).digest('hex').slice(0, 16);
    await prisma.promptTemplate.upsert({
      where: { templateId_version: { templateId: pt.templateId, version: pt.version } },
      update: {
        agentName: pt.agentName,
        taskType: pt.taskType,
        purpose: pt.purpose,
        systemPrompt: pt.systemPrompt,
        inputVariables: pt.inputVariables,
        contentHash,
        isActive: true,
      },
      create: {
        templateId: pt.templateId,
        version: pt.version,
        agentName: pt.agentName,
        taskType: pt.taskType,
        purpose: pt.purpose,
        systemPrompt: pt.systemPrompt,
        inputVariables: pt.inputVariables,
        contentHash,
        isActive: true,
      },
    });
    promptCount++;
  }
  console.log(`✅ Prompt templates: ${promptCount} upserted`);

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
