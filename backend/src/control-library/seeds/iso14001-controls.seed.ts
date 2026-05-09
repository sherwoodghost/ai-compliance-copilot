/**
 * ISO 14001:2015 Environmental Management System (EMS) — Seed Data
 * Source: ISO 14001:2015 standard (paraphrased for automated use)
 * Clauses 4–10 mapped to actionable controls
 */

export interface ISO14001ControlSeed {
  code: string;
  title: string;
  description: string;
  category: string;
  guidance: string;
  weight: number;
}

export const ISO14001_CONTROLS: ISO14001ControlSeed[] = [
  // ── Clause 4: Context of the Organization ───────────────────────────────────
  {
    code: 'ISO14001-4.1',
    title: 'Understanding the Organization and Its Context',
    description:
      'The organization shall determine external and internal issues relevant to its purpose and that affect its ability to achieve the intended outcomes of its environmental management system.',
    category: 'Context of the Organization',
    guidance:
      'Conduct a SWOT or PESTLE analysis to identify environmental factors. Document relevant regulatory requirements, stakeholder expectations, and market trends affecting environmental performance.',
    weight: 3,
  },
  {
    code: 'ISO14001-4.2',
    title: 'Understanding the Needs and Expectations of Interested Parties',
    description:
      'The organization shall determine interested parties relevant to the EMS, their needs and expectations, and which of these become compliance obligations.',
    category: 'Context of the Organization',
    guidance:
      'Identify stakeholders (regulators, customers, local communities, employees). Document their environmental requirements and determine which create binding obligations.',
    weight: 3,
  },
  {
    code: 'ISO14001-4.3',
    title: 'Determining the Scope of the Environmental Management System',
    description:
      'The organization shall determine the boundaries and applicability of the EMS, considering environmental conditions and compliance obligations.',
    category: 'Context of the Organization',
    guidance:
      'Define physical boundaries, organizational boundaries, and activities covered by the EMS. Document the scope statement and make it available as documented information.',
    weight: 3,
  },
  {
    code: 'ISO14001-4.4',
    title: 'Environmental Management System',
    description:
      'The organization shall establish, implement, maintain, and continually improve an EMS, including processes needed and their interactions.',
    category: 'Context of the Organization',
    guidance:
      'Develop the EMS framework including process maps, documented procedures, and records. Ensure integration with other business processes and management systems.',
    weight: 4,
  },

  // ── Clause 5: Leadership ─────────────────────────────────────────────────────
  {
    code: 'ISO14001-5.1',
    title: 'Leadership and Commitment',
    description:
      'Top management shall demonstrate leadership and commitment to the EMS by taking accountability, ensuring resources, communicating importance, and supporting continual improvement.',
    category: 'Leadership',
    guidance:
      'Document executive commitment via environmental policy sign-off. Include environmental objectives in business planning. Allocate dedicated EMS resources and budget.',
    weight: 4,
  },
  {
    code: 'ISO14001-5.2',
    title: 'Environmental Policy',
    description:
      'Top management shall establish an environmental policy that is appropriate to the organization\'s context, provides a framework for objectives, and commits to continual improvement and compliance obligations.',
    category: 'Leadership',
    guidance:
      'Draft and approve an environmental policy statement. Communicate to all employees and make available to interested parties. Review annually and update as needed.',
    weight: 4,
  },
  {
    code: 'ISO14001-5.3',
    title: 'Organizational Roles, Responsibilities, and Authorities',
    description:
      'Top management shall assign and communicate responsibility and authority for ensuring EMS conformance and reporting environmental performance.',
    category: 'Leadership',
    guidance:
      'Appoint an Environmental Management Representative (EMR) or equivalent. Define RACI matrix for EMS activities. Include environmental responsibilities in job descriptions.',
    weight: 3,
  },

  // ── Clause 6: Planning ───────────────────────────────────────────────────────
  {
    code: 'ISO14001-6.1.1',
    title: 'Actions to Address Risks and Opportunities — General',
    description:
      'The organization shall consider significant environmental aspects, compliance obligations, and other issues to determine risks and opportunities that need to be addressed.',
    category: 'Planning',
    guidance:
      'Establish a risk register for environmental risks and opportunities. Use risk matrix to prioritize. Link to strategic planning processes.',
    weight: 4,
  },
  {
    code: 'ISO14001-6.1.2',
    title: 'Environmental Aspects',
    description:
      'The organization shall determine the environmental aspects of its activities, products and services and associated environmental impacts, taking into account a life-cycle perspective.',
    category: 'Planning',
    guidance:
      'Create an Environmental Aspects and Impacts Register. Assess each aspect for significance using criteria such as severity, frequency, and regulatory concern. Review when changes occur.',
    weight: 5,
  },
  {
    code: 'ISO14001-6.1.3',
    title: 'Compliance Obligations',
    description:
      'The organization shall determine and have access to applicable legal and other requirements related to its environmental aspects.',
    category: 'Planning',
    guidance:
      'Maintain a legal register of applicable environmental laws and regulations. Assign ownership and review frequency. Update when regulations change.',
    weight: 5,
  },
  {
    code: 'ISO14001-6.1.4',
    title: 'Planning Actions',
    description:
      'The organization shall plan actions to address significant environmental aspects, compliance obligations, and risks and opportunities.',
    category: 'Planning',
    guidance:
      'Develop action plans for each significant environmental aspect and risk. Assign owners, timelines, and success metrics. Integrate with operational procedures.',
    weight: 4,
  },
  {
    code: 'ISO14001-6.2.1',
    title: 'Environmental Objectives',
    description:
      'The organization shall establish environmental objectives at relevant functions and levels, taking into account significant aspects, compliance obligations, and risks.',
    category: 'Planning',
    guidance:
      'Set SMART environmental objectives (e.g., reduce carbon emissions 20% by 2026, achieve zero-waste-to-landfill). Document objectives and link to operational processes.',
    weight: 4,
  },
  {
    code: 'ISO14001-6.2.2',
    title: 'Planning Actions to Achieve Environmental Objectives',
    description:
      'When planning how to achieve objectives, the organization shall determine resources, responsibilities, timelines, and measures of progress.',
    category: 'Planning',
    guidance:
      'Create objective plans with KPIs, resource allocation, and review cadence. Integrate into management review agenda. Track progress quarterly.',
    weight: 4,
  },

  // ── Clause 7: Support ────────────────────────────────────────────────────────
  {
    code: 'ISO14001-7.1',
    title: 'Resources',
    description:
      'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance, and continual improvement of the EMS.',
    category: 'Support',
    guidance:
      'Budget for environmental monitoring equipment, training, external consultants, and remediation activities. Document resource allocation in management review.',
    weight: 3,
  },
  {
    code: 'ISO14001-7.2',
    title: 'Competence',
    description:
      'The organization shall determine competence needed for persons performing work that affects environmental performance, ensure they are competent, and retain evidence.',
    category: 'Support',
    guidance:
      'Define environmental competency requirements by role. Provide training on environmental regulations, aspects, and procedures. Maintain training records and assess effectiveness.',
    weight: 3,
  },
  {
    code: 'ISO14001-7.3',
    title: 'Awareness',
    description:
      'Persons doing work under the organization\'s control shall be aware of the environmental policy, significant aspects, their contribution to EMS effectiveness, and implications of non-conformance.',
    category: 'Support',
    guidance:
      'Conduct annual environmental awareness training for all staff. Include EMS induction in onboarding. Display environmental policy and key aspects in work areas.',
    weight: 3,
  },
  {
    code: 'ISO14001-7.4',
    title: 'Communication',
    description:
      'The organization shall establish processes for internal and external communication relevant to the EMS, including what, when, with whom, and how to communicate.',
    category: 'Support',
    guidance:
      'Define EMS communication plan covering internal (staff, management) and external (regulators, community) communications. Document responses to external environmental inquiries.',
    weight: 3,
  },
  {
    code: 'ISO14001-7.5',
    title: 'Documented Information',
    description:
      'The organization\'s EMS shall include required documented information and information the organization determines is necessary for the effectiveness of the EMS.',
    category: 'Support',
    guidance:
      'Establish document control procedures for EMS documents. Use version control and access management. Retain records for minimum 3 years or as legally required.',
    weight: 3,
  },

  // ── Clause 8: Operation ──────────────────────────────────────────────────────
  {
    code: 'ISO14001-8.1',
    title: 'Operational Planning and Control',
    description:
      'The organization shall establish, implement, control, and maintain processes needed to meet requirements for providing products and services while controlling significant environmental aspects.',
    category: 'Operation',
    guidance:
      'Document operational procedures for activities with significant environmental aspects. Include controls for normal operations, maintenance, and abnormal situations. Extend controls to contractors.',
    weight: 5,
  },
  {
    code: 'ISO14001-8.2',
    title: 'Emergency Preparedness and Response',
    description:
      'The organization shall establish, implement, and maintain processes to prepare for and respond to potential emergency situations including those with environmental impact.',
    category: 'Operation',
    guidance:
      'Develop environmental emergency response plans for scenarios like spills, leaks, and fires. Conduct annual drills. Communicate with local emergency services. Review plans after incidents.',
    weight: 5,
  },

  // ── Clause 9: Performance Evaluation ────────────────────────────────────────
  {
    code: 'ISO14001-9.1.1',
    title: 'Monitoring, Measurement, Analysis and Evaluation — General',
    description:
      'The organization shall monitor, measure, analyze, and evaluate its environmental performance and the effectiveness of the EMS.',
    category: 'Performance Evaluation',
    guidance:
      'Define environmental KPIs (energy use, water consumption, waste generation, emissions). Establish monitoring schedule. Calibrate measurement equipment. Analyze trends.',
    weight: 4,
  },
  {
    code: 'ISO14001-9.1.2',
    title: 'Evaluation of Compliance',
    description:
      'The organization shall establish, implement, and maintain processes to evaluate fulfillment of compliance obligations.',
    category: 'Performance Evaluation',
    guidance:
      'Conduct compliance evaluations at least annually against all items in the legal register. Document findings. Take corrective action for any non-compliance. Report to management.',
    weight: 5,
  },
  {
    code: 'ISO14001-9.2',
    title: 'Internal Audit',
    description:
      'The organization shall conduct internal audits at planned intervals to provide information on whether the EMS conforms to requirements and is effectively implemented.',
    category: 'Performance Evaluation',
    guidance:
      'Develop an annual internal audit schedule covering all EMS clauses. Train internal auditors. Issue audit reports with findings and observations. Track corrective actions to closure.',
    weight: 4,
  },
  {
    code: 'ISO14001-9.3',
    title: 'Management Review',
    description:
      'Top management shall review the organization\'s EMS at planned intervals to ensure its continuing suitability, adequacy, and effectiveness.',
    category: 'Performance Evaluation',
    guidance:
      'Conduct management review at least annually. Agenda must include EMS performance, objectives status, legal compliance, audit findings, and opportunities for improvement. Document minutes and decisions.',
    weight: 4,
  },

  // ── Clause 10: Improvement ───────────────────────────────────────────────────
  {
    code: 'ISO14001-10.1',
    title: 'General — Continual Improvement',
    description:
      'The organization shall continually improve the suitability, adequacy, and effectiveness of the EMS to enhance environmental performance.',
    category: 'Improvement',
    guidance:
      'Track improvement trends over time. Set increasingly ambitious environmental objectives. Benchmark against industry peers and best practices.',
    weight: 3,
  },
  {
    code: 'ISO14001-10.2',
    title: 'Nonconformity and Corrective Action',
    description:
      'The organization shall react to nonconformities, control and correct them, deal with consequences including environmental impacts, and determine root cause to prevent recurrence.',
    category: 'Improvement',
    guidance:
      'Establish NCR (Nonconformity Report) process. Conduct root cause analysis for all significant nonconformities. Verify effectiveness of corrective actions. Maintain NCR register.',
    weight: 4,
  },
  {
    code: 'ISO14001-10.3',
    title: 'Continual Improvement',
    description:
      'The organization shall continually improve the EMS to enhance environmental performance.',
    category: 'Improvement',
    guidance:
      'Implement an ideas and suggestions system for environmental improvements. Review improvement proposals in management review. Track and celebrate environmental wins.',
    weight: 3,
  },

  // ── Additional Environmental Performance Controls ────────────────────────────
  {
    code: 'ISO14001-ENV-1',
    title: 'Greenhouse Gas Emissions Monitoring',
    description:
      'Track Scope 1 (direct), Scope 2 (indirect electricity), and where feasible Scope 3 (value chain) greenhouse gas emissions to enable science-based reduction targets.',
    category: 'Environmental Performance',
    guidance:
      'Implement GHG inventory following GHG Protocol methodology. Use emissions factors from official sources. Report emissions annually. Set reduction targets aligned with science-based targets.',
    weight: 4,
  },
  {
    code: 'ISO14001-ENV-2',
    title: 'Energy Management and Efficiency',
    description:
      'Monitor and reduce energy consumption across facilities and operations, with a preference for renewable energy sources.',
    category: 'Environmental Performance',
    guidance:
      'Install energy monitoring at facility level. Conduct energy audits. Set energy reduction targets. Procure renewable energy certificates (RECs) or PPAs where feasible.',
    weight: 4,
  },
  {
    code: 'ISO14001-ENV-3',
    title: 'Water Usage and Conservation',
    description:
      'Monitor water consumption, assess water risk at facility level, and implement conservation measures to minimize freshwater withdrawal.',
    category: 'Environmental Performance',
    guidance:
      'Meter water use at process level. Conduct water risk assessment using tools like WRI Aqueduct. Set reduction targets for high-risk locations. Implement recirculation and recycling.',
    weight: 3,
  },
  {
    code: 'ISO14001-ENV-4',
    title: 'Waste Management and Circular Economy',
    description:
      'Minimize waste generation, maximize reuse and recycling, and ensure proper disposal of hazardous waste in compliance with applicable regulations.',
    category: 'Environmental Performance',
    guidance:
      'Conduct waste audits. Classify waste by type and destination. Maintain waste manifests for hazardous waste. Track diversion rate (percentage not going to landfill). Set zero-waste targets.',
    weight: 4,
  },
  {
    code: 'ISO14001-ENV-5',
    title: 'Supplier Environmental Requirements',
    description:
      'Assess and manage environmental risks in the supply chain by establishing environmental requirements for key suppliers and monitoring compliance.',
    category: 'Environmental Performance',
    guidance:
      'Include environmental criteria in supplier onboarding questionnaire. Require key suppliers to maintain ISO 14001 certification or equivalent. Conduct supplier environmental audits for high-risk categories.',
    weight: 3,
  },
  {
    code: 'ISO14001-ENV-6',
    title: 'Product and Service Environmental Impact',
    description:
      'Consider environmental impacts throughout the product/service lifecycle from design through end-of-life, embedding environmental criteria into design and procurement decisions.',
    category: 'Environmental Performance',
    guidance:
      'Conduct life cycle assessments (LCA) for key products. Apply eco-design principles. Use Environmental Product Declarations (EPDs). Offer product take-back or recycling programs.',
    weight: 3,
  },
];
