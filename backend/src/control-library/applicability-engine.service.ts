import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ControlLibraryService } from './control-library.service';

export interface ApplicabilityResult {
  controlId: string;
  controlCode: string;
  applicable: boolean;
  applicabilityStatus: 'applicable' | 'not_applicable' | 'needs_review';
  rationale: string;
  requiresHumanReview: boolean;
  confidence: 'high' | 'medium' | 'low';
}

export interface BusinessProfileSnapshot {
  frameworks: string[];               // ['soc2', 'iso27001']
  soc2TrustServiceCategories?: string[]; // ['security','availability','confidentiality','processing_integrity','privacy']
  industry: string;
  dataTypes: string[];                // ['pii','financial','health_phi','payment_card']
  cloudProviders: string[];
  hasPhysicalOffice?: boolean;
  operatesIn?: string[];
  employeeCount?: string;
  usesMfa?: string;
  hasSecurityTeam?: boolean;
  hasIncidentResponsePlan?: boolean;
  hasSso?: boolean;
  hasVulnScanning?: boolean;
}

// ── SOC 2 Trust Service Category → applicable domain codes ────────────────────

const SOC2_TSC_DOMAINS: Record<string, string[]> = {
  security: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9'],
  availability: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9', 'A1'],
  confidentiality: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9', 'C1'],
  processing_integrity: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9', 'PI1'],
  privacy: ['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'],
};

// ── ISO 27001 physical office heuristic ──────────────────────────────────────

const ISO_PHYSICAL_CONTROLS = new Set([
  'A.7.1', 'A.7.2', 'A.7.3', 'A.7.4', 'A.7.5', 'A.7.6', 'A.7.7', 'A.7.8',
  'A.7.9', 'A.7.10', 'A.7.11', 'A.7.12', 'A.7.13', 'A.7.14',
]);

@Injectable()
export class ControlApplicabilityEngine {
  private readonly logger = new Logger(ControlApplicabilityEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly library: ControlLibraryService,
  ) {}

  /**
   * Run deterministic applicability analysis for an org.
   * Persists results to control_applicability table and creates
   * organization_controls rows for each applicable control.
   */
  async runForOrg(
    orgId: string,
    profile: BusinessProfileSnapshot,
    profileVersion: number,
  ): Promise<ApplicabilityResult[]> {
    const results: ApplicabilityResult[] = [];

    for (const framework of profile.frameworks) {
      if (framework === 'soc2') {
        const soc2Results = await this.runSoc2(profile);
        results.push(...soc2Results);
      } else if (framework === 'iso27001') {
        const isoResults = await this.runIso27001(profile);
        results.push(...isoResults);
      }
    }

    // Persist to DB
    await this.persistResults(orgId, results, profileVersion);

    // Create OrganizationControl rows for all applicable controls
    await this.createOrganizationControls(orgId, results);

    this.logger.log(
      `Applicability run for org ${orgId}: ${results.filter((r) => r.applicable).length} applicable / ${results.length} total`,
    );

    return results;
  }

  // ── SOC 2 Applicability Rules ─────────────────────────────────────────────

  private async runSoc2(profile: BusinessProfileSnapshot): Promise<ApplicabilityResult[]> {
    const controls = await this.library.getControlsByFramework('SOC2');
    const selectedTSCs = profile.soc2TrustServiceCategories?.length
      ? profile.soc2TrustServiceCategories
      : ['security']; // security always included

    // Build set of applicable domain prefixes
    const applicableDomains = new Set<string>();
    for (const tsc of selectedTSCs) {
      for (const domain of SOC2_TSC_DOMAINS[tsc] ?? []) {
        applicableDomains.add(domain);
      }
    }

    const results: ApplicabilityResult[] = [];

    for (const control of controls) {
      const domainCode = this.getDomainCode(control.code);
      const result = this.evaluateSoc2Control(control, domainCode, profile, applicableDomains, selectedTSCs);
      results.push(result);
    }

    return results;
  }

  private evaluateSoc2Control(
    control: any,
    domainCode: string,
    profile: BusinessProfileSnapshot,
    applicableDomains: Set<string>,
    selectedTSCs: string[],
  ): ApplicabilityResult {
    // Core CC controls: always applicable when SOC 2 is selected
    if (['CC1', 'CC2', 'CC3', 'CC4', 'CC5', 'CC6', 'CC7', 'CC8', 'CC9'].includes(domainCode)) {
      return {
        controlId: control.id,
        controlCode: control.code,
        applicable: true,
        applicabilityStatus: 'applicable',
        rationale: 'SOC 2 Security (CC) controls are mandatory for all SOC 2 engagements',
        requiresHumanReview: false,
        confidence: 'high',
      };
    }

    // Availability (A1)
    if (domainCode === 'A1') {
      const applicable = applicableDomains.has('A1');
      return {
        controlId: control.id,
        controlCode: control.code,
        applicable,
        applicabilityStatus: applicable ? 'applicable' : 'not_applicable',
        rationale: applicable
          ? 'Availability trust service category selected'
          : 'Availability trust service category not selected',
        requiresHumanReview: false,
        confidence: 'high',
      };
    }

    // Confidentiality (C1)
    if (domainCode === 'C1') {
      const applicable = applicableDomains.has('C1');
      return {
        controlId: control.id,
        controlCode: control.code,
        applicable,
        applicabilityStatus: applicable ? 'applicable' : 'not_applicable',
        rationale: applicable
          ? 'Confidentiality trust service category selected'
          : 'Confidentiality trust service category not selected',
        requiresHumanReview: false,
        confidence: 'high',
      };
    }

    // Processing Integrity (PI1)
    if (domainCode === 'PI1') {
      const applicable = applicableDomains.has('PI1');
      return {
        controlId: control.id,
        controlCode: control.code,
        applicable,
        applicabilityStatus: applicable ? 'applicable' : 'not_applicable',
        rationale: applicable
          ? 'Processing Integrity trust service category selected'
          : 'Processing Integrity trust service category not selected',
        requiresHumanReview: false,
        confidence: 'high',
      };
    }

    // Privacy (P1-P8)
    if (['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].includes(domainCode)) {
      const privacyTscSelected = selectedTSCs.includes('privacy');
      const hasPii = profile.dataTypes.includes('pii');
      const gdprJurisdiction = profile.operatesIn?.includes('EU') || profile.operatesIn?.includes('EEA');

      const applicable = !!(privacyTscSelected || hasPii || gdprJurisdiction);

      return {
        controlId: control.id,
        controlCode: control.code,
        applicable,
        applicabilityStatus: applicable ? 'applicable' as const : 'not_applicable' as const,
        rationale: applicable
          ? [
              privacyTscSelected ? 'Privacy TSC selected' : null,
              hasPii ? 'organization handles PII' : null,
              gdprJurisdiction ? 'GDPR jurisdiction applies' : null,
            ].filter(Boolean).join('; ')
          : 'Privacy TSC not selected and no PII handling or GDPR jurisdiction detected',
        requiresHumanReview: !privacyTscSelected && !!(hasPii || gdprJurisdiction),
        confidence: privacyTscSelected ? 'high' as const : 'medium' as const,
      };
    }

    // Fallback: needs review
    return {
      controlId: control.id,
      controlCode: control.code,
      applicable: false,
      applicabilityStatus: 'needs_review',
      rationale: `Unable to determine applicability for domain ${domainCode} — human review required`,
      requiresHumanReview: true,
      confidence: 'low',
    };
  }

  // ── ISO 27001 Applicability Rules ─────────────────────────────────────────

  private async runIso27001(profile: BusinessProfileSnapshot): Promise<ApplicabilityResult[]> {
    const controls = await this.library.getControlsByFramework('ISO27001');
    const results: ApplicabilityResult[] = [];

    for (const control of controls) {
      const result = this.evaluateIsoControl(control, profile);
      results.push(result);
    }

    return results;
  }

  private evaluateIsoControl(control: any, profile: BusinessProfileSnapshot): ApplicabilityResult {
    const code = control.code;

    // A.7: Physical and environmental security
    // Cloud-only companies with no physical office → needs_review
    if (ISO_PHYSICAL_CONTROLS.has(code)) {
      const isCloudOnly = profile.cloudProviders.length > 0 && !profile.hasPhysicalOffice;

      if (isCloudOnly) {
        return {
          controlId: control.id,
          controlCode: code,
          applicable: false,
          applicabilityStatus: 'needs_review',
          rationale: 'Cloud-only organization with no detected physical office — physical control applicability requires human review for SoA',
          requiresHumanReview: true,
          confidence: 'medium',
        };
      }
    }

    // A.5.34 — Privacy and PII protection: applicable only if PII handled
    if (code === 'A.5.34') {
      const hasPii = profile.dataTypes.includes('pii') || profile.dataTypes.includes('health_phi');
      return {
        controlId: control.id,
        controlCode: code,
        applicable: hasPii,
        applicabilityStatus: hasPii ? 'applicable' : 'not_applicable',
        rationale: hasPii
          ? 'Organization handles PII — A.5.34 privacy controls apply'
          : 'No PII handling detected — A.5.34 may not apply',
        requiresHumanReview: !hasPii ? true : false,
        confidence: hasPii ? 'high' : 'medium',
      };
    }

    // A.5.33 — Protection of records: always applicable
    // A.6.3 — Information security awareness, education and training: always applicable
    // A.8.* — Technology controls: applicable if any technology infrastructure
    // Default: ISO 27001 requires ALL controls to have an applicability statement in the SoA
    // Default to applicable with note that human review needed for any exclusion
    return {
      controlId: control.id,
      controlCode: code,
      applicable: true,
      applicabilityStatus: 'applicable',
      rationale: 'ISO 27001:2022 requires applicability rationale for all Annex A controls in the Statement of Applicability',
      requiresHumanReview: false,
      confidence: 'high',
    };
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private async persistResults(
    orgId: string,
    results: ApplicabilityResult[],
    profileVersion: number,
  ) {
    for (const result of results) {
      await this.prisma.controlApplicability.upsert({
        where: { orgId_controlId: { orgId, controlId: result.controlId } },
        create: {
          orgId,
          controlId: result.controlId,
          applicable: result.applicable,
          applicabilityStatus: result.applicabilityStatus,
          rationale: result.rationale,
          confidence: result.confidence,
          requiresHumanReview: result.requiresHumanReview,
          profileVersionUsed: profileVersion,
        },
        update: {
          applicable: result.applicable,
          applicabilityStatus: result.applicabilityStatus,
          rationale: result.rationale,
          confidence: result.confidence,
          requiresHumanReview: result.requiresHumanReview,
          profileVersionUsed: profileVersion,
        },
      });
    }
  }

  private async createOrganizationControls(orgId: string, results: ApplicabilityResult[]) {
    const applicable = results.filter((r) => r.applicable);

    for (const result of applicable) {
      const existing = await this.prisma.organizationControl.findUnique({
        where: { orgId_controlId: { orgId, controlId: result.controlId } },
      });

      if (!existing) {
        await this.prisma.organizationControl.create({
          data: {
            orgId,
            controlId: result.controlId,
            status: 'not_started',
            score: 0,
          },
        });
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  private getDomainCode(controlCode: string): string {
    // CC6.3 → CC6, A.5.1 → A.5, PI1.1 → PI1, P1.1 → P1
    const match = controlCode.match(/^([A-Z]+\d+(?:\.\d+)?|[A-Z]\.\d+)/);
    if (!match) return controlCode;

    // For SOC2: CC6.3 → CC6
    const soc2Match = controlCode.match(/^(CC\d+|A\d+|C\d+|PI\d+|P\d+)/);
    if (soc2Match) return soc2Match[1];

    // For ISO: A.5.1 → A.5
    const isoMatch = controlCode.match(/^(A\.\d+)/);
    if (isoMatch) return isoMatch[1];

    return controlCode;
  }

  /**
   * Get current applicability matrix for an org.
   */
  async getApplicabilityMatrix(orgId: string) {
    return this.prisma.controlApplicability.findMany({
      where: { orgId },
      include: {
        control: { include: { framework: true } },
      },
      orderBy: { control: { code: 'asc' } },
    });
  }

  /**
   * Override a specific control's applicability (human override).
   */
  async overrideApplicability(
    orgId: string,
    controlId: string,
    applicable: boolean,
    rationale: string,
    overriddenBy: string,
  ) {
    return this.prisma.controlApplicability.update({
      where: { orgId_controlId: { orgId, controlId } },
      data: {
        applicable,
        applicabilityStatus: applicable ? 'applicable' : 'not_applicable',
        rationale,
        overriddenBy,
        overriddenAt: new Date(),
        confidence: 'high',
        requiresHumanReview: false,
      },
    });
  }
}
