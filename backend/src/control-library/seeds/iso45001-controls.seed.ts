/**
 * ISO 45001:2018 Occupational Health & Safety Management System (OHSMS) — Seed Data
 * Source: ISO 45001:2018 standard (paraphrased for automated use)
 * Clauses 4–10 mapped to actionable controls
 */

export interface ISO45001ControlSeed {
  code: string;
  title: string;
  description: string;
  category: string;
  guidance: string;
  weight: number;
}

export const ISO45001_CONTROLS: ISO45001ControlSeed[] = [
  // ── Clause 4: Context of the Organization ───────────────────────────────────
  {
    code: 'ISO45001-4.1',
    title: 'Understanding the Organization and Its Context',
    description:
      'The organization shall determine external and internal issues relevant to its purpose that affect its ability to achieve the intended outcomes of its OH&S management system.',
    category: 'Context of the Organization',
    guidance:
      'Analyze the OH&S context using frameworks like PESTLE. Consider industry-specific hazards, worker demographics, cultural factors, and regulatory environment. Document findings and review annually.',
    weight: 3,
  },
  {
    code: 'ISO45001-4.2',
    title: 'Needs and Expectations of Workers and Other Interested Parties',
    description:
      'The organization shall determine workers and other interested parties relevant to the OHSMS, their relevant needs and expectations, and which become compliance obligations.',
    category: 'Context of the Organization',
    guidance:
      'Identify all interested parties including workers, contractors, unions, regulators, and communities. Document their OH&S expectations through surveys, meetings, and regulatory review.',
    weight: 3,
  },
  {
    code: 'ISO45001-4.3',
    title: 'Determining the Scope of the OH&S Management System',
    description:
      'The organization shall determine the boundaries and applicability of the OHSMS, considering the issues and requirements of clause 4.1 and 4.2.',
    category: 'Context of the Organization',
    guidance:
      'Define which sites, activities, and worker groups are covered by the OHSMS. Consider remote workers, contractors, and visitors. Document and make the scope available.',
    weight: 3,
  },
  {
    code: 'ISO45001-4.4',
    title: 'OH&S Management System',
    description:
      'The organization shall establish, implement, maintain, and continually improve an OHSMS, including the processes needed and their interactions.',
    category: 'Context of the Organization',
    guidance:
      'Develop the OHSMS framework with documented processes, procedures, and records. Integrate with other management systems. Establish process ownership and review mechanisms.',
    weight: 4,
  },

  // ── Clause 5: Leadership and Worker Participation ───────────────────────────
  {
    code: 'ISO45001-5.1',
    title: 'Leadership and Commitment',
    description:
      'Top management shall demonstrate leadership and commitment by taking overall responsibility and accountability for the prevention of work-related injury and ill health.',
    category: 'Leadership and Worker Participation',
    guidance:
      'Document CEO/executive commitment to OH&S including visible participation in safety walks, safety meetings, and incident response. Include OH&S in executive KPIs.',
    weight: 5,
  },
  {
    code: 'ISO45001-5.2',
    title: 'OH&S Policy',
    description:
      'Top management shall establish, implement, and maintain an OH&S policy that provides a framework for objectives and commits to fulfilling compliance obligations and eliminating hazards.',
    category: 'Leadership and Worker Participation',
    guidance:
      'Draft and approve an OH&S policy signed by top management. Communicate to all workers. Make available to interested parties. Review annually and update when needed.',
    weight: 4,
  },
  {
    code: 'ISO45001-5.3',
    title: 'Organizational Roles, Responsibilities, and Authorities',
    description:
      'Top management shall ensure responsibilities and authorities for relevant roles within the OHSMS are assigned and communicated throughout the organization.',
    category: 'Leadership and Worker Participation',
    guidance:
      'Appoint an OH&S Manager/Officer with defined authority. Create RACI matrix for OHSMS activities. Include OH&S responsibilities in all job descriptions. Establish safety committee.',
    weight: 4,
  },
  {
    code: 'ISO45001-5.4',
    title: 'Consultation and Participation of Workers',
    description:
      'The organization shall establish, implement, and maintain processes for consultation and participation of workers at all applicable levels in the development and improvement of the OHSMS.',
    category: 'Leadership and Worker Participation',
    guidance:
      'Establish formal worker consultation mechanisms (safety committees, toolbox talks, anonymous reporting). Ensure non-management workers are represented. Document consultation records.',
    weight: 4,
  },

  // ── Clause 6: Planning ───────────────────────────────────────────────────────
  {
    code: 'ISO45001-6.1.1',
    title: 'Actions to Address Risks and Opportunities — General',
    description:
      'The organization shall consider OH&S hazards, risks and opportunities, compliance obligations, and other issues to determine risks and opportunities that need to be addressed.',
    category: 'Planning',
    guidance:
      'Maintain an OH&S risk register with identified hazards and assessed risks. Use risk matrix for prioritization. Identify opportunities to improve OH&S performance.',
    weight: 4,
  },
  {
    code: 'ISO45001-6.1.2',
    title: 'Hazard Identification and Assessment of Risks',
    description:
      'The organization shall establish and maintain processes for proactive and ongoing hazard identification for all routine and non-routine activities and situations.',
    category: 'Planning',
    guidance:
      'Conduct site-specific hazard identification using methods like HAZOP, job safety analysis (JSA), and workplace inspections. Involve workers in hazard identification. Review after incidents and changes.',
    weight: 5,
  },
  {
    code: 'ISO45001-6.1.3',
    title: 'Assessment of OH&S Opportunities',
    description:
      'The organization shall assess OH&S opportunities to enhance OH&S performance while planning changes, in adapting work to workers and in using new technology.',
    category: 'Planning',
    guidance:
      'Systematically evaluate improvement opportunities including ergonomics improvements, technology upgrades, process redesign, and best practice adoption. Document and prioritize opportunities.',
    weight: 3,
  },
  {
    code: 'ISO45001-6.1.4',
    title: 'Determination of Legal and Other Requirements',
    description:
      'The organization shall establish, implement, and maintain processes to determine and have access to applicable legal and other OH&S requirements.',
    category: 'Planning',
    guidance:
      'Maintain an OH&S legal register. Subscribe to regulatory update services. Assign owners for each regulatory requirement. Conduct quarterly compliance reviews.',
    weight: 5,
  },
  {
    code: 'ISO45001-6.2',
    title: 'OH&S Objectives and Planning to Achieve Them',
    description:
      'The organization shall establish OH&S objectives at relevant functions and levels to maintain and improve the OHSMS and OH&S performance.',
    category: 'Planning',
    guidance:
      'Set measurable OH&S objectives (e.g., zero fatalities, TRIR < 1.0, near-miss reporting increase). Develop action plans with resources, responsibilities, timelines, and measures.',
    weight: 4,
  },

  // ── Clause 7: Support ────────────────────────────────────────────────────────
  {
    code: 'ISO45001-7.1',
    title: 'Resources',
    description:
      'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance, and continual improvement of the OHSMS.',
    category: 'Support',
    guidance:
      'Budget adequately for PPE, safety equipment, training, health surveillance, and OH&S staff. Demonstrate resource allocation in management review. Include OH&S in capital planning.',
    weight: 3,
  },
  {
    code: 'ISO45001-7.2',
    title: 'Competence',
    description:
      'The organization shall determine the necessary competence of workers that affects or can affect OH&S performance and ensure they are competent on the basis of education, training, or experience.',
    category: 'Support',
    guidance:
      'Define competency requirements for safety-critical roles. Provide role-specific safety training. Maintain competency records. Assess training effectiveness. Ensure contractor competence.',
    weight: 4,
  },
  {
    code: 'ISO45001-7.3',
    title: 'Awareness',
    description:
      'Workers shall be aware of the OH&S policy, their contribution to the OHSMS, the implications of not conforming, and hazards and OH&S risks relevant to them.',
    category: 'Support',
    guidance:
      'Provide OH&S induction for all new workers including contractors. Conduct regular toolbox talks. Display safety information in work areas. Assess worker awareness through observation.',
    weight: 3,
  },
  {
    code: 'ISO45001-7.4',
    title: 'Communication',
    description:
      'The organization shall establish, implement, and maintain processes for internal and external communications relevant to the OHSMS.',
    category: 'Support',
    guidance:
      'Define OH&S communication plan. Establish channels for hazard reporting, incident notification, and safety alerts. Ensure workers can communicate OH&S concerns without fear of reprisal.',
    weight: 3,
  },
  {
    code: 'ISO45001-7.5',
    title: 'Documented Information',
    description:
      'The OHSMS shall include documented information required by the standard and determined as necessary for the effectiveness of the OHSMS.',
    category: 'Support',
    guidance:
      'Establish document control procedures. Maintain records for incidents, training, inspections, risk assessments, and audits. Ensure records are legible, accessible, and protected.',
    weight: 3,
  },

  // ── Clause 8: Operation ──────────────────────────────────────────────────────
  {
    code: 'ISO45001-8.1.1',
    title: 'Operational Planning and Control — General',
    description:
      'The organization shall plan, implement, control, and maintain processes needed to meet OH&S management system requirements.',
    category: 'Operation',
    guidance:
      'Document safe work procedures for high-risk activities. Establish permit-to-work systems. Implement lockout/tagout procedures. Maintain management of change process.',
    weight: 5,
  },
  {
    code: 'ISO45001-8.1.2',
    title: 'Eliminating Hazards and Reducing OH&S Risks',
    description:
      'The organization shall establish processes to eliminate hazards and reduce OH&S risks using the hierarchy of controls: Eliminate, Substitute, Engineering controls, Administrative controls, PPE.',
    category: 'Operation',
    guidance:
      'Apply hierarchy of controls systematically. Document controls for each significant risk. Prioritize elimination and substitution over PPE. Verify control effectiveness through monitoring.',
    weight: 5,
  },
  {
    code: 'ISO45001-8.1.3',
    title: 'Management of Change',
    description:
      'The organization shall establish processes for the implementation and control of planned changes that impact OH&S performance.',
    category: 'Operation',
    guidance:
      'Implement a management of change procedure. Assess OH&S impacts before implementing changes to processes, equipment, or organization. Communicate changes to affected workers.',
    weight: 4,
  },
  {
    code: 'ISO45001-8.1.4',
    title: 'Procurement and Contractor Management',
    description:
      'The organization shall establish processes to control procurement of products and services and coordinate with contractors to manage hazards and OH&S risks.',
    category: 'Operation',
    guidance:
      'Include OH&S requirements in procurement contracts. Pre-qualify contractors based on OH&S performance. Conduct contractor inductions. Monitor contractor OH&S performance on site.',
    weight: 4,
  },
  {
    code: 'ISO45001-8.2',
    title: 'Emergency Preparedness and Response',
    description:
      'The organization shall establish, implement, and maintain processes to prepare for potential emergency situations including worker injuries, fires, chemical spills, and natural disasters.',
    category: 'Operation',
    guidance:
      'Develop site-specific emergency response plans. Train emergency response teams. Conduct evacuation drills at least annually. Establish first aid provision. Coordinate with local emergency services.',
    weight: 5,
  },

  // ── Clause 9: Performance Evaluation ────────────────────────────────────────
  {
    code: 'ISO45001-9.1.1',
    title: 'Monitoring, Measurement, Analysis and Performance Evaluation — General',
    description:
      'The organization shall establish processes to monitor, measure, analyze, and evaluate OH&S performance.',
    category: 'Performance Evaluation',
    guidance:
      'Define lagging indicators (TRIR, LTIR, days away from work) and leading indicators (near-miss reports, safety observations, training completion). Review monthly at management level.',
    weight: 4,
  },
  {
    code: 'ISO45001-9.1.2',
    title: 'Evaluation of Compliance',
    description:
      'The organization shall establish, implement, and maintain processes to evaluate fulfillment of legal and other OH&S requirements.',
    category: 'Performance Evaluation',
    guidance:
      'Conduct compliance evaluations against legal register items at least annually. Document findings and corrective actions. Report compliance status to top management.',
    weight: 5,
  },
  {
    code: 'ISO45001-9.2',
    title: 'Internal Audit',
    description:
      'The organization shall conduct internal audits at planned intervals to determine if the OHSMS conforms to requirements and is effectively implemented and maintained.',
    category: 'Performance Evaluation',
    guidance:
      'Develop annual OH&S audit schedule. Train internal auditors on ISO 45001. Issue audit reports with findings and non-conformances. Track corrective actions to closure.',
    weight: 4,
  },
  {
    code: 'ISO45001-9.3',
    title: 'Management Review',
    description:
      'Top management shall review the OH&S MS at planned intervals to ensure its continuing suitability, adequacy, and effectiveness.',
    category: 'Performance Evaluation',
    guidance:
      'Conduct management review at least annually. Agenda must include OH&S performance, objectives status, legal compliance, incident statistics, audit findings, and worker consultation. Document outputs.',
    weight: 4,
  },

  // ── Clause 10: Improvement ───────────────────────────────────────────────────
  {
    code: 'ISO45001-10.1',
    title: 'General — Continual Improvement',
    description:
      'The organization shall continually improve the suitability, adequacy, and effectiveness of the OHSMS to enhance OH&S performance.',
    category: 'Improvement',
    guidance:
      'Track improvement trends year-over-year. Benchmark against industry peers using safety statistics. Celebrate improvements and recognize OH&S performance.',
    weight: 3,
  },
  {
    code: 'ISO45001-10.2',
    title: 'Incident, Nonconformity, and Corrective Action',
    description:
      'The organization shall have processes to report, investigate, and take corrective action on incidents, near misses, and nonconformities to prevent recurrence.',
    category: 'Improvement',
    guidance:
      'Establish incident reporting and investigation procedure. Conduct root cause analysis for all significant incidents. Share learnings across the organization. Verify corrective action effectiveness.',
    weight: 5,
  },
  {
    code: 'ISO45001-10.3',
    title: 'Continual Improvement',
    description:
      'The organization shall continually improve the OHSMS to enhance OH&S performance, promote a culture that supports OH&S, and protect workers from work-related injury and ill health.',
    category: 'Improvement',
    guidance:
      'Implement safety suggestion program. Reward near-miss reporting. Conduct regular culture surveys. Share best practices internally and with industry peers.',
    weight: 3,
  },

  // ── Additional OHS Performance Controls ─────────────────────────────────────
  {
    code: 'ISO45001-OHS-1',
    title: 'Incident Investigation and Reporting',
    description:
      'All work-related injuries, ill health incidents, and near misses shall be reported, investigated using systematic root cause analysis, and used to drive preventive measures.',
    category: 'OHS Performance',
    guidance:
      'Implement a no-blame incident reporting culture. Use 5 Why or Fishbone analysis for investigation. Track incident rates (TRIR, LTIR, severity rate). Report to management monthly.',
    weight: 5,
  },
  {
    code: 'ISO45001-OHS-2',
    title: 'Personal Protective Equipment Program',
    description:
      'Appropriate PPE shall be provided to workers based on hazard assessment, maintained in good condition, and workers shall be trained in its correct use.',
    category: 'OHS Performance',
    guidance:
      'Conduct PPE hazard assessment for each work area. Select PPE meeting applicable standards. Provide fitting and training. Inspect PPE regularly. Replace damaged PPE promptly.',
    weight: 4,
  },
  {
    code: 'ISO45001-OHS-3',
    title: 'Health Surveillance and Occupational Health',
    description:
      'Implement health surveillance programs appropriate to identified occupational health risks, including pre-employment, periodic, and exit health assessments.',
    category: 'OHS Performance',
    guidance:
      'Identify health surveillance requirements based on exposure to hazardous substances, noise, vibration, ergonomic risks. Maintain health records confidentially. Provide occupational health services.',
    weight: 4,
  },
  {
    code: 'ISO45001-OHS-4',
    title: 'Ergonomics and Workplace Design',
    description:
      'Workplaces, workstations, and tools shall be designed to minimize ergonomic risks including manual handling, repetitive strain, awkward postures, and display screen equipment.',
    category: 'OHS Performance',
    guidance:
      'Conduct ergonomic risk assessments. Provide ergonomic workstation setup for office workers. Train workers on manual handling techniques. Implement rotation and micro-break programs.',
    weight: 3,
  },
  {
    code: 'ISO45001-OHS-5',
    title: 'Psychological Safety and Mental Health',
    description:
      'The organization shall identify and control psychosocial hazards that may cause work-related stress, burnout, harassment, or other mental health impacts on workers.',
    category: 'OHS Performance',
    guidance:
      'Conduct psychosocial risk assessment. Implement anti-harassment policy. Provide access to Employee Assistance Program (EAP). Train managers on mental health first aid. Monitor workload and overtime.',
    weight: 4,
  },
  {
    code: 'ISO45001-OHS-6',
    title: 'Chemical and Hazardous Substance Management',
    description:
      'Hazardous substances used in the workplace shall be identified, assessed for health risks, properly stored, handled, and disposed of in accordance with applicable regulations.',
    category: 'OHS Performance',
    guidance:
      'Maintain a chemical inventory with Safety Data Sheets (SDS) for all hazardous substances. Implement substitution of hazardous chemicals where possible. Provide chemical handling training.',
    weight: 4,
  },
];
