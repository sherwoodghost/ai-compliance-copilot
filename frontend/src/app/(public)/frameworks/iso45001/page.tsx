import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, Users, ClipboardList,
  HeartPulse, Siren, HardHat, ChevronRight, ArrowRight, Activity,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'ISO 45001:2018 — Occupational Health & Safety | Compliance Copilot',
  description:
    'ISO 45001:2018 is the international standard for Occupational Health & Safety Management Systems. Explore all clauses, controls, and evidence requirements.',
};

const CATEGORIES = [
  {
    code: '4',
    title: 'Context of the Organization',
    icon: ClipboardList,
    color: 'bg-yellow-100 text-yellow-700',
    controls: [
      { code: 'ISO45001-4.1', title: 'Understanding the Organization and Its Context' },
      { code: 'ISO45001-4.2', title: 'Needs and Expectations of Workers and Interested Parties' },
      { code: 'ISO45001-4.3', title: 'Determining the Scope of the OHSMS' },
      { code: 'ISO45001-4.4', title: 'OH&S Management System' },
    ],
  },
  {
    code: '5',
    title: 'Leadership and Worker Participation',
    icon: Users,
    color: 'bg-amber-100 text-amber-700',
    controls: [
      { code: 'ISO45001-5.1', title: 'Leadership and Commitment' },
      { code: 'ISO45001-5.2', title: 'OH&S Policy' },
      { code: 'ISO45001-5.3', title: 'Organizational Roles, Responsibilities, and Authorities' },
      { code: 'ISO45001-5.4', title: 'Consultation and Participation of Workers' },
    ],
  },
  {
    code: '6',
    title: 'Planning',
    icon: ShieldAlert,
    color: 'bg-orange-100 text-orange-700',
    controls: [
      { code: 'ISO45001-6.1.1', title: 'Actions to Address Risks and Opportunities' },
      { code: 'ISO45001-6.1.2', title: 'Hazard Identification and Assessment of Risks' },
      { code: 'ISO45001-6.1.3', title: 'Assessment of OH&S Opportunities' },
      { code: 'ISO45001-6.1.4', title: 'Determination of Legal and Other Requirements' },
      { code: 'ISO45001-6.2',   title: 'OH&S Objectives and Planning to Achieve Them' },
    ],
  },
  {
    code: '7',
    title: 'Support',
    icon: CheckCircle2,
    color: 'bg-yellow-100 text-yellow-800',
    controls: [
      { code: 'ISO45001-7.1', title: 'Resources' },
      { code: 'ISO45001-7.2', title: 'Competence' },
      { code: 'ISO45001-7.3', title: 'Awareness' },
      { code: 'ISO45001-7.4', title: 'Communication' },
      { code: 'ISO45001-7.5', title: 'Documented Information' },
    ],
  },
  {
    code: '8',
    title: 'Operation',
    icon: HardHat,
    color: 'bg-amber-100 text-amber-800',
    controls: [
      { code: 'ISO45001-8.1.1', title: 'Operational Planning and Control — General' },
      { code: 'ISO45001-8.1.2', title: 'Eliminating Hazards and Reducing OH&S Risks (Hierarchy of Controls)' },
      { code: 'ISO45001-8.1.3', title: 'Management of Change' },
      { code: 'ISO45001-8.1.4', title: 'Procurement and Contractor Management' },
      { code: 'ISO45001-8.2',   title: 'Emergency Preparedness and Response' },
    ],
  },
  {
    code: '9',
    title: 'Performance Evaluation',
    icon: Activity,
    color: 'bg-orange-100 text-orange-800',
    controls: [
      { code: 'ISO45001-9.1.1', title: 'Monitoring, Measurement, Analysis and Performance Evaluation' },
      { code: 'ISO45001-9.1.2', title: 'Evaluation of Compliance' },
      { code: 'ISO45001-9.2',   title: 'Internal Audit' },
      { code: 'ISO45001-9.3',   title: 'Management Review' },
    ],
  },
  {
    code: '10',
    title: 'Improvement',
    icon: ChevronRight,
    color: 'bg-yellow-100 text-yellow-700',
    controls: [
      { code: 'ISO45001-10.1', title: 'General — Continual Improvement' },
      { code: 'ISO45001-10.2', title: 'Incident, Nonconformity, and Corrective Action' },
      { code: 'ISO45001-10.3', title: 'Continual Improvement' },
    ],
  },
  {
    code: 'OHS',
    title: 'OHS Performance',
    icon: HeartPulse,
    color: 'bg-amber-100 text-amber-700',
    controls: [
      { code: 'ISO45001-OHS-1', title: 'Incident Investigation and Reporting' },
      { code: 'ISO45001-OHS-2', title: 'Personal Protective Equipment Program' },
      { code: 'ISO45001-OHS-3', title: 'Health Surveillance and Occupational Health' },
      { code: 'ISO45001-OHS-4', title: 'Ergonomics and Workplace Design' },
      { code: 'ISO45001-OHS-5', title: 'Psychological Safety and Mental Health' },
      { code: 'ISO45001-OHS-6', title: 'Chemical and Hazardous Substance Management' },
    ],
  },
];

const HIGHLIGHTS = [
  { icon: ShieldAlert, label: 'Hazard Identification', description: 'Systematic identification and control of workplace hazards' },
  { icon: Users, label: 'Worker Participation', description: 'Mandatory consultation and involvement of workers at all levels' },
  { icon: HeartPulse, label: 'Health Surveillance', description: 'Monitor worker health for occupational disease prevention' },
  { icon: Siren, label: 'Incident Investigation', description: 'Root cause analysis of injuries, near misses, and ill health' },
];

export default function Iso45001ReferencePage() {
  const totalControls = CATEGORIES.reduce((sum, c) => sum + c.controls.length, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <HardHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-amber-100 text-sm font-medium">International Standard</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">ISO 45001:2018</h1>
          <p className="text-xl text-amber-100 mb-2">Occupational Health &amp; Safety Management Systems</p>
          <p className="text-amber-100 max-w-2xl">
            The first international standard for occupational health and safety management. ISO 45001:2018
            helps organizations provide safe and healthy workplaces by preventing work-related injury and
            ill health, proactively improving OH&S performance.
          </p>
          <div className="flex items-center gap-6 mt-8 text-sm text-amber-200">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{totalControls} controls</span>
            <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4" />8 clause groups</span>
            <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Replaces OHSAS 18001</span>
          </div>
        </div>
      </div>

      {/* Key areas */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">What ISO 45001 Covers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {HIGHLIGHTS.map(({ icon: Icon, label, description }) => (
            <div key={label} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-amber-700" />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          ))}
        </div>

        {/* Controls by clause */}
        <h2 className="text-xl font-bold text-gray-900 mb-6">OHSMS Controls by Clause</h2>
        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.code} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cat.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                    Clause {cat.code}
                  </span>
                  <span className="font-semibold text-gray-800">{cat.title}</span>
                  <span className="ml-auto text-xs text-gray-400">{cat.controls.length} controls</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {cat.controls.map((ctrl) => (
                    <div key={ctrl.code} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{ctrl.code}</span>
                      <span className="text-sm text-gray-700">{ctrl.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 text-center">
          <HardHat className="w-10 h-10 text-amber-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Achieve ISO 45001 Certification</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Compliance Copilot automates your ISO 45001 evidence collection, tracks hazard controls,
            manages incident records, and prepares you for certification audits.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700 transition-colors"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
