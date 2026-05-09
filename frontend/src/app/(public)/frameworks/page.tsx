import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BookOpen, ShieldCheck, GitMerge, Shield, Award,
  Lock, CreditCard, Building2, Compass, Leaf, HardHat,
} from 'lucide-react';
import { getFrameworks } from '@/lib/api/frameworks';

export const metadata: Metadata = {
  title: 'Compliance Framework Reference | ComplianceOS',
  description:
    'Browse SOC 2, ISO 27001, GDPR, ISO 9001, HIPAA, PCI-DSS, FedRAMP, NIST CSF, ISO 14001, and ISO 45001 controls with evidence requirements, policy guidance, and cross-framework mappings.',
};

interface FrameworkCardProps {
  href:        string;
  badge:       string;
  badgeColor:  string;
  title:       string;
  subtitle:    string;
  count:       number;
  description: string;
  categories:  string[];
  dotColor:    string;
  btnLabel:    string;
  icon:        React.ReactNode;
}

function FrameworkCard({
  href, badge, badgeColor, title, subtitle, count, description,
  categories, dotColor, btnLabel, icon,
}: FrameworkCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2 ${badgeColor}`}>
              {badge}
            </span>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center opacity-60">
              {icon}
            </div>
            <span className="text-2xl font-bold text-gray-900">{count}</span>
            <p className="text-xs text-gray-400">controls</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed mb-5">{description}</p>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Categories
          </p>
          <div className="grid grid-cols-1 gap-y-1.5">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-2 text-xs text-gray-600">
                <div className={`w-1.5 h-1.5 rounded-full ${dotColor} shrink-0`} />
                {cat}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6">
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {btnLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

export default async function FrameworksPage() {
  const frameworks = await getFrameworks().catch(() => null);

  const soc2Count      = frameworks?.soc2?.controlCount      ?? 68;
  const iso27001Count  = frameworks?.iso27001?.controlCount  ?? 97;
  const gdprCount      = frameworks?.gdpr?.controlCount      ?? 30;
  const iso9001Count   = frameworks?.iso9001?.controlCount   ?? 29;
  const hipaaCount     = frameworks?.hipaa?.controlCount     ?? 54;
  const pciDssCount    = frameworks?.pciDss?.controlCount    ?? 12;
  const fedRampCount   = frameworks?.fedRamp?.controlCount   ?? 20;
  const nistCsfCount   = frameworks?.nistCsf?.controlCount   ?? 23;
  const iso14001Count  = frameworks?.iso14001?.controlCount  ?? 22;
  const iso45001Count  = frameworks?.iso45001?.controlCount  ?? 20;

  const totalCount = soc2Count + iso27001Count + gdprCount + iso9001Count
    + hipaaCount + pciDssCount + fedRampCount + nistCsfCount
    + iso14001Count + iso45001Count;

  const frameworkCount = 10;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* ── Hero ── */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-xs font-semibold px-3 py-1 rounded-full mb-5">
            <BookOpen className="w-3.5 h-3.5" />
            Framework Reference
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Compliance Framework Reference
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Explore {totalCount}+ controls across {frameworkCount} major compliance frameworks — with evidence
            requirements, policy guidance, and cross-framework mappings.
          </p>
          <div className="flex items-center justify-center gap-8 mt-8 text-sm text-gray-500">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{totalCount}+</p>
              <p className="text-xs mt-0.5">Total controls</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{frameworkCount}</p>
              <p className="text-xs mt-0.5">Frameworks</p>
            </div>
            <div className="w-px h-8 bg-gray-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">250+</p>
              <p className="text-xs mt-0.5">Cross-mappings</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">

        {/* ── Section: Security & Privacy ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 pl-1">
            Security &amp; Privacy
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* ISO 27001 */}
            <FrameworkCard
              href="/frameworks/iso27001"
              badge="ISO/IEC 27001:2022"
              badgeColor="bg-indigo-100 text-indigo-700"
              title="ISO 27001"
              subtitle="Information Security Management"
              count={iso27001Count}
              description="The international standard for information security management systems. Annex A covers organizational, people, physical, and technological security controls."
              categories={[
                'A.5 – Organizational Controls',
                'A.6 – People Controls',
                'A.7 – Physical Controls',
                'A.8 – Technological Controls',
              ]}
              dotColor="bg-indigo-400"
              btnLabel="Explore ISO 27001"
              icon={<ShieldCheck className="w-8 h-8 text-indigo-500" />}
            />

            {/* SOC 2 */}
            <FrameworkCard
              href="/frameworks/soc2"
              badge="SOC 2 TSC 2017"
              badgeColor="bg-emerald-100 text-emerald-700"
              title="SOC 2"
              subtitle="Trust Services Criteria"
              count={soc2Count}
              description="AICPA Trust Services Criteria for service organizations. Covers security, availability, processing integrity, confidentiality, and privacy."
              categories={[
                'CC1–CC9 – Common Criteria',
                'A1 – Availability',
                'C1 – Confidentiality',
                'PI1 – Processing Integrity',
                'P1–P8 – Privacy',
              ]}
              dotColor="bg-emerald-400"
              btnLabel="Explore SOC 2"
              icon={<ShieldCheck className="w-8 h-8 text-emerald-500" />}
            />

            {/* GDPR */}
            <FrameworkCard
              href="/frameworks/gdpr"
              badge="Regulation (EU) 2016/679"
              badgeColor="bg-violet-100 text-violet-700"
              title="GDPR"
              subtitle="General Data Protection Regulation"
              count={gdprCount}
              description="Europe's comprehensive data protection law governing collection, processing, and storage of EU residents' personal data. Applies globally to any organisation handling EU data."
              categories={[
                'Principles (Art. 5–11)',
                'Controller Obligations (Art. 24–43)',
                'Data Subject Rights (Art. 15–22)',
                'Security & Breach Notification',
                'DPIA, DPO & International Transfers',
              ]}
              dotColor="bg-violet-400"
              btnLabel="Explore GDPR"
              icon={<Shield className="w-8 h-8 text-violet-500" />}
            />

            {/* HIPAA */}
            <FrameworkCard
              href="/frameworks/hipaa"
              badge="45 CFR Parts 160 & 164"
              badgeColor="bg-rose-100 text-rose-700"
              title="HIPAA"
              subtitle="Health Insurance Portability & Accountability Act"
              count={hipaaCount}
              description="US federal law protecting the privacy and security of Protected Health Information (PHI). Mandatory for covered entities and business associates handling PHI."
              categories={[
                'Administrative Safeguards (§164.308)',
                'Physical Safeguards (§164.310)',
                'Technical Safeguards (§164.312)',
                'Organizational Requirements (§164.314)',
                'Breach Notification Rule',
              ]}
              dotColor="bg-rose-400"
              btnLabel="Explore HIPAA"
              icon={<Lock className="w-8 h-8 text-rose-500" />}
            />

            {/* PCI DSS */}
            <FrameworkCard
              href="/frameworks/pci-dss"
              badge="PCI DSS v4.0"
              badgeColor="bg-amber-100 text-amber-700"
              title="PCI DSS"
              subtitle="Payment Card Industry Data Security Standard"
              count={pciDssCount}
              description="Security standard for organisations that handle branded credit cards from major card schemes. Applies to any entity storing, processing, or transmitting cardholder data."
              categories={[
                'Req 1–2 – Network Security',
                'Req 3–4 – Protect Account Data',
                'Req 5–6 – Vulnerability Management',
                'Req 7–9 – Access & Physical Security',
                'Req 10–12 – Monitoring & Policy',
              ]}
              dotColor="bg-amber-400"
              btnLabel="Explore PCI DSS"
              icon={<CreditCard className="w-8 h-8 text-amber-500" />}
            />

            {/* NIST CSF */}
            <FrameworkCard
              href="/frameworks/nist-csf"
              badge="NIST CSF 2.0"
              badgeColor="bg-orange-100 text-orange-700"
              title="NIST CSF"
              subtitle="Cybersecurity Framework"
              count={nistCsfCount}
              description="NIST's voluntary cybersecurity framework providing a policy framework of computer security guidance for private sector organisations. Widely adopted as a risk management baseline."
              categories={[
                'GV – Govern',
                'ID – Identify',
                'PR – Protect',
                'DE – Detect',
                'RS – Respond',
                'RC – Recover',
              ]}
              dotColor="bg-orange-400"
              btnLabel="Explore NIST CSF"
              icon={<Compass className="w-8 h-8 text-orange-500" />}
            />
          </div>
        </div>

        {/* ── Section: Government & Federal ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 pl-1">
            Government &amp; Federal
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* FedRAMP */}
            <FrameworkCard
              href="/frameworks/fedramp"
              badge="FedRAMP Rev 5"
              badgeColor="bg-sky-100 text-sky-700"
              title="FedRAMP"
              subtitle="Federal Risk & Authorization Management Program"
              count={fedRampCount}
              description="US government-wide programme for cloud service authorizations. Required for any cloud service provider selling to US federal agencies. Based on NIST SP 800-53."
              categories={[
                'ATO Authorization Process',
                'System Security Plan (SSP)',
                'POA&M Management',
                'Continuous Monitoring (ConMon)',
                'Incident Response',
              ]}
              dotColor="bg-sky-400"
              btnLabel="Explore FedRAMP"
              icon={<Building2 className="w-8 h-8 text-sky-500" />}
            />
          </div>
        </div>

        {/* ── Section: Quality & Management Systems ── */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 pl-1">
            Quality &amp; Management Systems
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* ISO 9001 */}
            <FrameworkCard
              href="/frameworks/iso9001"
              badge="ISO 9001:2015"
              badgeColor="bg-teal-100 text-teal-700"
              title="ISO 9001"
              subtitle="Quality Management System"
              count={iso9001Count}
              description="International standard for Quality Management Systems — specifying requirements for consistently providing products and services that meet customer and regulatory requirements."
              categories={[
                'Clause 4 – Context of the Organization',
                'Clause 5 – Leadership',
                'Clause 6 – Planning',
                'Clause 7 – Support',
                'Clause 8 – Operation',
                'Clause 9 – Performance Evaluation',
                'Clause 10 – Improvement',
              ]}
              dotColor="bg-teal-400"
              btnLabel="Explore ISO 9001"
              icon={<Award className="w-8 h-8 text-teal-500" />}
            />

            {/* ISO 14001 */}
            <FrameworkCard
              href="/frameworks/iso14001"
              badge="ISO 14001:2015"
              badgeColor="bg-green-100 text-green-700"
              title="ISO 14001"
              subtitle="Environmental Management System"
              count={iso14001Count}
              description="International standard for Environmental Management Systems (EMS). Helps organisations improve their environmental performance through efficient use of resources and reduction of waste."
              categories={[
                'Clause 4 – Context & Environmental Aspects',
                'Clause 5 – Leadership & Policy',
                'Clause 6 – Planning & Objectives',
                'Clause 7 – Support & Resources',
                'Clause 8 – Operational Control',
                'Clause 9 – Performance Evaluation',
                'Clause 10 – Continual Improvement',
              ]}
              dotColor="bg-green-400"
              btnLabel="Explore ISO 14001"
              icon={<Leaf className="w-8 h-8 text-green-500" />}
            />

            {/* ISO 45001 */}
            <FrameworkCard
              href="/frameworks/iso45001"
              badge="ISO 45001:2018"
              badgeColor="bg-yellow-100 text-yellow-700"
              title="ISO 45001"
              subtitle="Occupational Health & Safety Management"
              count={iso45001Count}
              description="International standard for Occupational Health and Safety Management Systems (OHSMS). Helps organisations proactively improve safety performance to prevent injury and ill-health."
              categories={[
                'Clause 4 – Context & Worker Participation',
                'Clause 5 – Leadership & OH&S Policy',
                'Clause 6 – Hazard Identification & Risk',
                'Clause 7 – Support & Competence',
                'Clause 8 – Operational Planning & Control',
                'Clause 9 – Performance Evaluation',
                'Clause 10 – Incident Investigation & Improvement',
              ]}
              dotColor="bg-yellow-400"
              btnLabel="Explore ISO 45001"
              icon={<HardHat className="w-8 h-8 text-yellow-500" />}
            />
          </div>
        </div>

        {/* ── Cross-framework mapping CTA ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-violet-100 flex items-center justify-center">
              <GitMerge className="w-7 h-7 text-violet-600" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Cross-Framework Mapping
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                250+ mapped controls across all {frameworkCount} frameworks — see exactly how each criterion aligns,
                eliminating duplicate compliance work when pursuing multiple certifications simultaneously.
              </p>
            </div>
            <div className="flex-shrink-0">
              <Link
                href="/frameworks/crosswalks"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-brand-600 text-brand-600 text-sm font-medium hover:bg-brand-50 transition-colors"
              >
                View Crosswalks
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalCount}+</p>
              <p className="text-xs text-gray-500 mt-0.5">Total controls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{frameworkCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Frameworks</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">250+</p>
              <p className="text-xs text-gray-500 mt-0.5">Mapped controls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 text-sm leading-tight">ISO · SOC · GDPR · HIPAA · PCI · NIST</p>
              <p className="text-xs text-gray-500 mt-0.5">Coverage</p>
            </div>
          </div>
        </div>

        {/* ── Feature highlights ── */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: <BookOpen className="w-5 h-5 text-brand-600" />,
              title: 'Evidence Requirements',
              desc: 'Each control lists the specific evidence types and artifacts required to demonstrate compliance to auditors.',
            },
            {
              icon: <ShieldCheck className="w-5 h-5 text-brand-600" />,
              title: 'Policy Guidance',
              desc: 'Policy requirements mapped to each control help you build a complete, certification-ready compliance programme.',
            },
            {
              icon: <GitMerge className="w-5 h-5 text-brand-600" />,
              title: 'Cross-Mappings',
              desc: 'Eliminate duplicate work by seeing which controls satisfy multiple frameworks simultaneously across all 10 standards.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                {icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
