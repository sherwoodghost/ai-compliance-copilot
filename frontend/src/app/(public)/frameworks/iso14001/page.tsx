import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Leaf, CheckCircle2, AlertTriangle, Globe, ClipboardList,
  Building2, Zap, Droplets, Trash2, ChevronRight, ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'ISO 14001:2015 — Environmental Management System | Compliance Copilot',
  description:
    'ISO 14001:2015 is the international standard for Environmental Management Systems. Explore all clauses, controls, and evidence requirements.',
};

const CATEGORIES = [
  {
    code: '4',
    title: 'Context of the Organization',
    icon: Building2,
    color: 'bg-green-100 text-green-700',
    controls: [
      { code: 'ISO14001-4.1', title: 'Understanding the Organization and Its Context' },
      { code: 'ISO14001-4.2', title: 'Needs and Expectations of Interested Parties' },
      { code: 'ISO14001-4.3', title: 'Determining the Scope of the EMS' },
      { code: 'ISO14001-4.4', title: 'Environmental Management System' },
    ],
  },
  {
    code: '5',
    title: 'Leadership',
    icon: Globe,
    color: 'bg-emerald-100 text-emerald-700',
    controls: [
      { code: 'ISO14001-5.1', title: 'Leadership and Commitment' },
      { code: 'ISO14001-5.2', title: 'Environmental Policy' },
      { code: 'ISO14001-5.3', title: 'Organizational Roles, Responsibilities, and Authorities' },
    ],
  },
  {
    code: '6',
    title: 'Planning',
    icon: ClipboardList,
    color: 'bg-teal-100 text-teal-700',
    controls: [
      { code: 'ISO14001-6.1.1', title: 'Actions to Address Risks and Opportunities' },
      { code: 'ISO14001-6.1.2', title: 'Environmental Aspects' },
      { code: 'ISO14001-6.1.3', title: 'Compliance Obligations' },
      { code: 'ISO14001-6.1.4', title: 'Planning Actions' },
      { code: 'ISO14001-6.2.1', title: 'Environmental Objectives' },
      { code: 'ISO14001-6.2.2', title: 'Planning Actions to Achieve Objectives' },
    ],
  },
  {
    code: '7',
    title: 'Support',
    icon: CheckCircle2,
    color: 'bg-lime-100 text-lime-700',
    controls: [
      { code: 'ISO14001-7.1', title: 'Resources' },
      { code: 'ISO14001-7.2', title: 'Competence' },
      { code: 'ISO14001-7.3', title: 'Awareness' },
      { code: 'ISO14001-7.4', title: 'Communication' },
      { code: 'ISO14001-7.5', title: 'Documented Information' },
    ],
  },
  {
    code: '8',
    title: 'Operation',
    icon: Zap,
    color: 'bg-green-100 text-green-800',
    controls: [
      { code: 'ISO14001-8.1', title: 'Operational Planning and Control' },
      { code: 'ISO14001-8.2', title: 'Emergency Preparedness and Response' },
    ],
  },
  {
    code: '9',
    title: 'Performance Evaluation',
    icon: AlertTriangle,
    color: 'bg-emerald-100 text-emerald-800',
    controls: [
      { code: 'ISO14001-9.1.1', title: 'Monitoring, Measurement, Analysis and Evaluation' },
      { code: 'ISO14001-9.1.2', title: 'Evaluation of Compliance' },
      { code: 'ISO14001-9.2',   title: 'Internal Audit' },
      { code: 'ISO14001-9.3',   title: 'Management Review' },
    ],
  },
  {
    code: '10',
    title: 'Improvement',
    icon: ChevronRight,
    color: 'bg-teal-100 text-teal-800',
    controls: [
      { code: 'ISO14001-10.1', title: 'General — Continual Improvement' },
      { code: 'ISO14001-10.2', title: 'Nonconformity and Corrective Action' },
      { code: 'ISO14001-10.3', title: 'Continual Improvement' },
    ],
  },
  {
    code: 'ENV',
    title: 'Environmental Performance',
    icon: Leaf,
    color: 'bg-green-100 text-green-700',
    controls: [
      { code: 'ISO14001-ENV-1', title: 'Greenhouse Gas Emissions Monitoring' },
      { code: 'ISO14001-ENV-2', title: 'Energy Management and Efficiency' },
      { code: 'ISO14001-ENV-3', title: 'Water Usage and Conservation' },
      { code: 'ISO14001-ENV-4', title: 'Waste Management and Circular Economy' },
      { code: 'ISO14001-ENV-5', title: 'Supplier Environmental Requirements' },
      { code: 'ISO14001-ENV-6', title: 'Product and Service Environmental Impact' },
    ],
  },
];

const HIGHLIGHTS = [
  { icon: Leaf, label: 'Environmental Aspects', description: 'Identify and control activities that interact with the environment' },
  { icon: Globe, label: 'Legal Compliance', description: 'Track applicable environmental laws, permits, and regulations' },
  { icon: Droplets, label: 'Resource Efficiency', description: 'Monitor and reduce energy, water, and material consumption' },
  { icon: Trash2, label: 'Waste Reduction', description: 'Minimize waste generation and improve recycling rates' },
];

export default function Iso14001ReferencePage() {
  const totalControls = CATEGORIES.reduce((sum, c) => sum + c.controls.length, 0);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <span className="text-green-200 text-sm font-medium">International Standard</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">ISO 14001:2015</h1>
          <p className="text-xl text-green-100 mb-2">Environmental Management Systems</p>
          <p className="text-green-200 max-w-2xl">
            The world&apos;s most widely used environmental management standard. ISO 14001:2015 provides a
            framework for organizations to protect the environment and respond to changing environmental
            conditions in balance with socio-economic needs.
          </p>
          <div className="flex items-center gap-6 mt-8 text-sm text-green-200">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />{totalControls} controls</span>
            <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4" />8 clause groups</span>
            <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" />500,000+ certified organizations globally</span>
          </div>
        </div>
      </div>

      {/* Key areas */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">What ISO 14001 Covers</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {HIGHLIGHTS.map(({ icon: Icon, label, description }) => (
            <div key={label} className="p-4 rounded-xl border border-gray-100 bg-gray-50">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-3">
                <Icon className="w-4 h-4 text-green-700" />
              </div>
              <p className="font-semibold text-gray-900 text-sm mb-1">{label}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          ))}
        </div>

        {/* Controls by clause */}
        <h2 className="text-xl font-bold text-gray-900 mb-6">EMS Controls by Clause</h2>
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
                      <span className="text-xs font-mono font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">{ctrl.code}</span>
                      <span className="text-sm text-gray-700">{ctrl.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 text-center">
          <Leaf className="w-10 h-10 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">Start Your ISO 14001 Journey</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Compliance Copilot automates your ISO 14001 evidence collection, tracks environmental
            objectives, and prepares you for certification.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors"
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
