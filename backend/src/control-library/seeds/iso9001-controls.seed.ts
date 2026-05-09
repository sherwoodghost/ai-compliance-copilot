/**
 * ISO 9001:2015 Quality Management System — Seed Data
 * Source: ISO 9001:2015 (paraphrased for automated use)
 * Confidence: high
 *
 * Covers: Clauses 4–10 (Context, Leadership, Planning, Support, Operation,
 *         Performance Evaluation, Improvement)
 */

import { ControlSeedRecord } from './soc2-controls.seed';

export const ISO9001_DOMAINS = [
  { code: 'Context',               name: 'Context of the Organisation', sortOrder: 1 },
  { code: 'Leadership',            name: 'Leadership',                  sortOrder: 2 },
  { code: 'Planning',              name: 'Planning',                    sortOrder: 3 },
  { code: 'Support',               name: 'Support',                     sortOrder: 4 },
  { code: 'Operation',             name: 'Operation',                   sortOrder: 5 },
  { code: 'PerformanceEvaluation', name: 'Performance Evaluation',      sortOrder: 6 },
  { code: 'Improvement',           name: 'Improvement',                 sortOrder: 7 },
];

export const ISO9001_CONTROLS: ControlSeedRecord[] = [
  // ── Clause 4: Context of the Organisation ───────────────────────────────────
  {
    code: 'ISO9001-4.1',
    title: 'Understanding the Organisation and Its Context',
    description:
      'The organisation must determine external and internal issues that are relevant to its purpose and strategic direction and that affect its ability to achieve the intended results of its quality management system. The organisation must monitor and review information about these external and internal issues.',
    category: 'Context',
    domain: 'Context',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'SWOT, PESTLE, or equivalent context analysis document', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Management review minutes referencing context issues', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Management System Scope Document', description: 'Summarises context analysis and how it influences QMS scope and objectives' },
    ],
  },
  {
    code: 'ISO9001-4.2',
    title: 'Understanding the Needs and Expectations of Interested Parties',
    description:
      'The organisation must determine the interested parties that are relevant to the QMS, and the requirements of those interested parties that are relevant to the QMS. The organisation must monitor and review information about those interested parties and their relevant requirements.',
    category: 'Context',
    domain: 'Context',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Interested parties register with identified requirements and monitoring plan', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Management System Scope Document', description: 'References stakeholder analysis and how their requirements are addressed' },
    ],
  },
  {
    code: 'ISO9001-4.3',
    title: 'Determining the Scope of the Quality Management System',
    description:
      'The organisation must determine the boundaries and applicability of the QMS to establish its scope. When determining scope, the organisation must consider the external and internal issues, the requirements of relevant interested parties, and the products and services of the organisation. The scope must be maintained as documented information and state the products and services covered and any applicable exclusions.',
    category: 'Context',
    domain: 'Context',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Documented QMS scope statement specifying included sites, products, and services, and any justified exclusions', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Management System Scope Document', description: 'Formally defines the scope boundaries of the QMS' },
    ],
  },
  {
    code: 'ISO9001-4.4',
    title: 'Quality Management System and Its Processes',
    description:
      'The organisation must establish, implement, maintain, and continually improve a QMS, including the processes needed and their interactions. The organisation must determine: inputs and outputs, sequence and interaction, criteria and methods, resources needed, responsibilities, risks and opportunities, and how the processes are evaluated and improved.',
    category: 'Context',
    domain: 'Context',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Process map or turtle diagram showing QMS processes, interactions, inputs, and outputs', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',  description: 'Process ownership register with accountable owners per process', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Manual or QMS Process Framework', description: 'Describes how QMS processes are established, maintained, and improved' },
    ],
  },

  // ── Clause 5: Leadership ─────────────────────────────────────────────────────
  {
    code: 'ISO9001-5.1',
    title: 'Leadership and Commitment',
    description:
      'Top management must demonstrate leadership and commitment with respect to the QMS by: taking accountability for QMS effectiveness; ensuring quality policy and objectives are established and compatible with the strategic direction; ensuring QMS requirements are integrated into business processes; promoting process approach and risk-based thinking; providing resources; communicating the importance of QMS; and supporting other management roles.',
    category: 'Leadership',
    domain: 'Leadership',
    trustServiceCategory: 'ISO9001',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'attestation',   description: 'Management review meeting minutes signed by top management demonstrating active QMS oversight', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Evidence of top management participation in quality training or briefings', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Quality Policy', description: 'Approved by top management and communicated across the organisation' },
    ],
  },
  {
    code: 'ISO9001-5.2',
    title: 'Quality Policy',
    description:
      'Top management must establish, implement, and maintain a quality policy that is appropriate to the purpose and context of the organisation and supports strategic direction. The policy must include a commitment to satisfy applicable requirements and to continual improvement. It must be available as documented information, communicated, understood, and applied within the organisation, and available to interested parties.',
    category: 'Leadership',
    domain: 'Leadership',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Signed and dated Quality Policy statement meeting all Clause 5.2 requirements', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Evidence that Quality Policy has been communicated and is understood by staff', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Policy', description: 'Top-level quality commitment statement signed by top management' },
    ],
  },
  {
    code: 'ISO9001-5.3',
    title: 'Organisational Roles, Responsibilities, and Authorities',
    description:
      'Top management must ensure that responsibilities and authorities for relevant roles are assigned, communicated, and understood within the organisation. This includes ensuring the QMS conforms to ISO 9001 requirements, that processes are delivering intended outputs, that performance of the QMS and opportunities for improvement are reported to top management, and that customer focus is promoted throughout the organisation.',
    category: 'Leadership',
    domain: 'Leadership',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc', description: 'Organisational chart with quality roles, responsibilities, and reporting lines', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc', description: 'Job descriptions or RACI matrix for QMS-related responsibilities', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Quality Manual or QMS Process Framework', description: 'Documents management roles and authorities for QMS' },
    ],
  },

  // ── Clause 6: Planning ───────────────────────────────────────────────────────
  {
    code: 'ISO9001-6.1',
    title: 'Actions to Address Risks and Opportunities',
    description:
      'When planning for the QMS, the organisation must consider the context issues and the requirements of interested parties, and determine the risks and opportunities that need to be addressed to ensure the QMS can achieve its intended results, prevent or reduce undesired effects, and achieve continual improvement. The organisation must plan actions to address those risks and opportunities, integrate them into QMS processes, and evaluate their effectiveness.',
    category: 'Planning',
    domain: 'Planning',
    trustServiceCategory: 'ISO9001',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Risk and opportunity register for the QMS with assessed likelihood, impact, and planned actions', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Management review evidence of risk and opportunity monitoring and effectiveness evaluation', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Risk Management Policy', description: 'Establishes methodology for identifying and treating QMS risks and opportunities' },
    ],
  },
  {
    code: 'ISO9001-6.2',
    title: 'Quality Objectives and Planning to Achieve Them',
    description:
      'The organisation must establish quality objectives at relevant functions, levels, and processes needed for the QMS. Objectives must be consistent with the quality policy, measurable, consider applicable requirements, relevant to conformity of products/services and customer satisfaction, and monitored and communicated. The organisation must determine what will be done, what resources are required, who is responsible, when it will be completed, and how results will be evaluated.',
    category: 'Planning',
    domain: 'Planning',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Quality objectives document with SMART metrics, owners, and achievement plans', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Periodic quality objectives performance monitoring reports', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Quality Objectives Plan', description: 'Sets measurable objectives aligned to quality policy with monitoring framework' },
    ],
  },
  {
    code: 'ISO9001-6.3',
    title: 'Planning for Change',
    description:
      'When the organisation determines the need for changes to the QMS, the changes must be carried out in a planned manner. The organisation must consider the purpose of the changes and their potential consequences, the integrity of the QMS, the availability of resources, and the allocation or reallocation of responsibilities and authorities.',
    category: 'Planning',
    domain: 'Planning',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Change management procedure for QMS changes including impact assessment', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Change log or change request records for QMS modifications', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Change Management Procedure', description: 'Controls planned changes to QMS processes, documentation, and infrastructure' },
    ],
  },

  // ── Clause 7: Support ────────────────────────────────────────────────────────
  {
    code: 'ISO9001-7.1',
    title: 'Resources',
    description:
      'The organisation must determine and provide the resources needed for the establishment, implementation, maintenance, and continual improvement of the QMS. This includes considering the capabilities and constraints of existing internal resources and what needs to be obtained from external providers. Resources include people, infrastructure (buildings, equipment, IT), environment for process operation, monitoring and measurement resources, and organisational knowledge.',
    category: 'Support',
    domain: 'Support',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',    description: 'Resource plan identifying people, infrastructure, and knowledge resources for QMS', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report',  description: 'Management review evidence that resource adequacy is evaluated', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Management System Scope Document', description: 'Documents resource allocation for QMS activities' },
    ],
  },
  {
    code: 'ISO9001-7.2',
    title: 'Competence',
    description:
      'The organisation must determine the necessary competence of persons doing work that affects quality performance. It must ensure those persons are competent on the basis of appropriate education, training, or experience, take actions to acquire necessary competence, and retain documented information as evidence of competence. Where actions are taken to develop competence, their effectiveness must be evaluated.',
    category: 'Support',
    domain: 'Support',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',      description: 'Competency framework or role-based competency requirements for quality-critical roles', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'training_record', description: 'Training records, qualifications, and competence assessments for relevant personnel', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Competence and Training Policy', description: 'Defines competency requirements, training processes, and effectiveness evaluation' },
    ],
  },
  {
    code: 'ISO9001-7.3',
    title: 'Awareness',
    description:
      'Persons doing work under the organisation\'s control must be aware of the quality policy, relevant quality objectives, their contribution to QMS effectiveness including the benefits of improved performance, and the implications of not conforming to QMS requirements.',
    category: 'Support',
    domain: 'Support',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'training_record', description: 'Quality awareness training completion records for all relevant personnel', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'policy_doc',      description: 'Quality policy communication records (e.g., intranet posting, employee handbook)', isMandatory: false },
    ],
    policyRequirements: [
      { policyName: 'Quality Policy', description: 'Communicated and understood by all relevant personnel' },
    ],
  },
  {
    code: 'ISO9001-7.4',
    title: 'Communication',
    description:
      'The organisation must determine the internal and external communications relevant to the QMS, including what, when, with whom, and how to communicate, and who communicates. Communication planning must ensure relevant quality information flows to the right people at the right time, including communication with customers, suppliers, and regulatory bodies as required.',
    category: 'Support',
    domain: 'Support',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Communication plan or matrix for QMS-related internal and external communications', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Communication Plan', description: 'Defines QMS communication channels, frequency, and audiences' },
    ],
  },
  {
    code: 'ISO9001-7.5',
    title: 'Documented Information',
    description:
      'The QMS must include documented information required by ISO 9001 and documented information determined by the organisation as necessary for the effectiveness of the QMS. When creating and updating documented information, the organisation must ensure appropriate identification and description, format and media, review and approval for suitability and adequacy. Documented information must be controlled to ensure availability, suitability, and protection.',
    category: 'Support',
    domain: 'Support',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Document control procedure covering creation, approval, version control, and retention', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Document register evidencing all mandatory ISO 9001 documented information is maintained', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Document Control Procedure', description: 'Controls creation, approval, distribution, and retirement of QMS documents and records' },
    ],
  },

  // ── Clause 8: Operation ──────────────────────────────────────────────────────
  {
    code: 'ISO9001-8.1',
    title: 'Operational Planning and Control',
    description:
      'The organisation must plan, implement, control, maintain, and retain documented information to the extent necessary for confidence that processes have been carried out as planned. This includes determining requirements for products and services, establishing criteria for processes and acceptance of products/services, and ensuring that outsourced processes are controlled. Changes must be controlled and unintended changes reviewed to mitigate adverse effects.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Operational procedures or work instructions for quality-critical processes', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Process performance records demonstrating operations are carried out as planned', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Operational Control Procedures', description: 'Work instructions and control plans for key QMS processes' },
    ],
  },
  {
    code: 'ISO9001-8.2',
    title: 'Requirements for Products and Services',
    description:
      'The organisation must ensure it has the ability to meet requirements for products and services to be offered to customers before committing to supply. Requirements determination must include statutory and regulatory requirements, customer requirements and any additional requirements deemed necessary by the organisation. Customer communication must include information, enquiries, contracts, feedback including complaints, and contingency actions.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Customer requirements review procedure including contract review records', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Contract or order review records evidencing requirements verification before acceptance', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Customer Requirements Management Procedure', description: 'Ensures customer and regulatory requirements are identified, reviewed, and communicated' },
    ],
  },
  {
    code: 'ISO9001-8.3',
    title: 'Design and Development of Products and Services',
    description:
      'The organisation must establish, implement, and maintain a design and development process where it is required. Planning must consider the nature, duration, and complexity of design activities, required process stages including applicable reviews, activities for verification and validation, responsibilities and authorities, internal and external resource needs, and the need to manage interfaces between persons involved.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Design and development procedure covering planning, inputs, controls, outputs, and changes', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Design review, verification, and validation records for a recent product or service development', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Design and Development Procedure', description: 'Controls the design lifecycle from planning through verification and validation' },
    ],
  },
  {
    code: 'ISO9001-8.4',
    title: 'Control of Externally Provided Processes, Products, and Services',
    description:
      'The organisation must ensure that externally provided processes, products, and services conform to specified requirements. The type and extent of controls applied to external providers must be based on the effect on the organisation\'s ability to meet customer requirements and the effectiveness of the controls applied by the external provider. The organisation must communicate requirements for processes, products, services, competence, and QMS interactions to external providers.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Supplier and subcontractor evaluation and selection criteria', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Approved supplier list and supplier performance monitoring records', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Supplier and Subcontractor Management Procedure', description: 'Controls selection, evaluation, and monitoring of external providers' },
    ],
  },
  {
    code: 'ISO9001-8.5',
    title: 'Production and Service Provision',
    description:
      'The organisation must implement production and service provision under controlled conditions including: availability of documented information, monitoring and measurement activities, use of suitable infrastructure and process environment, competent persons, validation and revalidation of special processes, actions to prevent human error, and implementation of release, delivery, and post-delivery activities. Traceability must be maintained where required.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Production and service provision procedures covering all Clause 8.5 controlled conditions', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Production records, inspection records, or service delivery logs demonstrating controlled conditions', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Production and Service Provision Procedure', description: 'Specifies controlled conditions, traceability, and post-delivery requirements' },
    ],
  },
  {
    code: 'ISO9001-8.6',
    title: 'Release of Products and Services',
    description:
      'The organisation must implement planned arrangements at appropriate stages to verify that product and service requirements have been met. Release of products and services to the customer must not proceed until planned arrangements have been satisfactorily completed, unless otherwise approved by a relevant authority and, as applicable, by the customer. Documented evidence of conformity with acceptance criteria and traceability to the authorising person must be retained.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Product/service release procedure with defined acceptance criteria and authorisation controls', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Inspection and test records confirming products/services meet requirements before release', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Product Release Procedure', description: 'Defines inspection, acceptance criteria, and authorisation steps before customer delivery' },
    ],
  },
  {
    code: 'ISO9001-8.7',
    title: 'Control of Nonconforming Outputs',
    description:
      'The organisation must ensure that outputs that do not conform to their requirements are identified and controlled to prevent their unintended use or delivery. Appropriate actions must be taken based on the nature of the nonconformity and its effect on products/services. These include correction, segregation or containment, return to supplier, suspension, informing the customer, and obtaining authorisation for use under concession. Documented information describing the nonconformity, actions taken, concessions obtained, and identifying the authority deciding the action must be retained.',
    category: 'Operation',
    domain: 'Operation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Nonconforming output control procedure covering identification, segregation, disposition, and reporting', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Nonconformance reports (NCRs) with recorded dispositions and corrective actions', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Nonconforming Output Procedure', description: 'Controls identification, segregation, and disposition of nonconforming products and services' },
    ],
  },

  // ── Clause 9: Performance Evaluation ────────────────────────────────────────
  {
    code: 'ISO9001-9.1',
    title: 'Monitoring, Measurement, Analysis, and Evaluation',
    description:
      'The organisation must determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis, and evaluation needed to ensure valid results, when monitoring and measuring shall be performed, and when the results shall be analysed and evaluated. The organisation must evaluate quality performance and the effectiveness of the QMS and retain appropriate documented information as evidence of the results.',
    category: 'Performance Evaluation',
    domain: 'PerformanceEvaluation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Monitoring and measurement plan identifying KPIs, methods, frequency, and responsible parties', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Quality performance reports showing measured results against targets', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Quality Performance Monitoring Procedure', description: 'Defines KPIs, measurement methods, and analysis frequency for QMS effectiveness' },
    ],
  },
  {
    code: 'ISO9001-9.1.2',
    title: 'Customer Satisfaction Measurement',
    description:
      'The organisation must monitor customers\' perceptions of the degree to which their needs and expectations have been fulfilled. The organisation must determine the methods for obtaining, monitoring, and reviewing this information. Customer satisfaction data, including complaints, warranty data, dealer reports, market share data, compliments, or survey results, should be used as inputs to management review and continual improvement.',
    category: 'Performance Evaluation',
    domain: 'PerformanceEvaluation',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Customer satisfaction measurement methodology (e.g., surveys, NPS, complaint analysis)', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Customer satisfaction data and trend analysis for the review period', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Customer Satisfaction Procedure', description: 'Defines how customer feedback is collected, analysed, and actioned' },
    ],
  },
  {
    code: 'ISO9001-9.2',
    title: 'Internal Audit',
    description:
      'The organisation must conduct internal audits at planned intervals to provide information on whether the QMS conforms to its own requirements and to ISO 9001, and is effectively implemented and maintained. The organisation must plan, establish, implement, and maintain an audit programme including frequency, methods, responsibilities, planning requirements, and reporting. Internal auditors must be objective and impartial; they must not audit their own work. Results must be reported to relevant management.',
    category: 'Performance Evaluation',
    domain: 'PerformanceEvaluation',
    trustServiceCategory: 'ISO9001',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Internal audit programme covering audit schedule, scope, criteria, and auditor competency', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Completed internal audit reports with findings, nonconformities, and corrective action tracking', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Internal Audit Procedure', description: 'Defines audit planning, execution, reporting, and follow-up requirements' },
    ],
  },
  {
    code: 'ISO9001-9.3',
    title: 'Management Review',
    description:
      'Top management must review the organisation\'s QMS at planned intervals to ensure its continuing suitability, adequacy, effectiveness, and alignment with the strategic direction of the organisation. Management review inputs must include: status of actions from previous reviews, changes in external and internal issues, QMS performance information, resource adequacy, effectiveness of actions taken to address risks and opportunities, and improvement opportunities. Outputs must include decisions on improvement opportunities, changes needed, and resource needs.',
    category: 'Performance Evaluation',
    domain: 'PerformanceEvaluation',
    trustServiceCategory: 'ISO9001',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Management review procedure defining frequency, inputs, outputs, and attendee requirements', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Management review meeting minutes covering all mandatory input topics with decisions and action items', isMandatory: true, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Management Review Procedure', description: 'Formalises top management review process, inputs, outputs, and follow-up tracking' },
    ],
  },

  // ── Clause 10: Improvement ───────────────────────────────────────────────────
  {
    code: 'ISO9001-10.1',
    title: 'Continual Improvement',
    description:
      'The organisation must determine and select opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction. This includes improving products and services to meet requirements and address future needs, correcting, preventing, or reducing undesired effects, and improving QMS performance and effectiveness. Improvement may be reactive (corrective action), incremental, breakthrough, or transformational.',
    category: 'Improvement',
    domain: 'Improvement',
    trustServiceCategory: 'ISO9001',
    weight: 4,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Continual improvement policy or procedure defining improvement methodology', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Improvement log or project register showing improvement initiatives and outcomes', isMandatory: true, freshnessDays: 180 },
    ],
    policyRequirements: [
      { policyName: 'Continual Improvement Procedure', description: 'Establishes how improvement opportunities are identified, prioritised, and tracked' },
    ],
  },
  {
    code: 'ISO9001-10.2',
    title: 'Nonconformity and Corrective Action',
    description:
      'When a nonconformity occurs, including any arising from complaints, the organisation must: react to the nonconformity, evaluate the need for action to eliminate root causes, implement corrective action, review the effectiveness of corrective action, update risks and opportunities if necessary, and make changes to the QMS if needed. Corrective actions must be appropriate to the effects of the nonconformities encountered. Documented information must be retained describing the nonconformity, actions taken, and results of corrective action.',
    category: 'Improvement',
    domain: 'Improvement',
    trustServiceCategory: 'ISO9001',
    weight: 5,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Corrective action procedure covering nonconformity recording, root cause analysis, and effectiveness review', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Corrective action register (CAR) showing open and closed CARs with root cause analysis and evidence of effectiveness', isMandatory: true, freshnessDays: 90 },
    ],
    policyRequirements: [
      { policyName: 'Corrective Action Procedure', description: 'Systematic process for root cause analysis, corrective action implementation, and verification of effectiveness' },
    ],
  },
  {
    code: 'ISO9001-10.3',
    title: 'Continual Improvement Targets',
    description:
      'The organisation must continually improve the suitability, adequacy, and effectiveness of the QMS. The organisation must consider the outputs of analysis and evaluation, and the outputs from management review, to determine if there are needs or opportunities that shall be addressed as part of continual improvement. Improvement targets should be aligned with quality objectives and tracked through the performance monitoring framework.',
    category: 'Improvement',
    domain: 'Improvement',
    trustServiceCategory: 'ISO9001',
    weight: 3,
    evidenceRequirements: [
      { evidenceType: 'policy_doc',  description: 'Improvement targets aligned to quality objectives with baselines and target values', isMandatory: true, freshnessDays: 365 },
      { evidenceType: 'audit_report', description: 'Management review output confirming improvement targets are reviewed and updated', isMandatory: false, freshnessDays: 365 },
    ],
    policyRequirements: [
      { policyName: 'Quality Objectives Plan',       description: 'Includes improvement targets with measurable milestones' },
      { policyName: 'Continual Improvement Procedure', description: 'Links management review outputs to improvement target setting' },
    ],
  },
];
