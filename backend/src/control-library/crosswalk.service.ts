import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ControlLibraryService } from './control-library.service';

/**
 * Core SOC 2 ↔ ISO 27001 crosswalk mappings.
 * These are seeded once into the framework_crosswalks table.
 */
const SOC2_ISO_CROSSWALKS: Array<{
  sourceCode: string;
  targetCode: string;
  mappingType: 'equivalent' | 'partial' | 'related';
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  automatable: boolean;
}> = [
  // CC1 — Control Environment ↔ A.5 Organizational Controls
  { sourceCode: 'CC1.1', targetCode: 'A.5.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require documented IS policies with management commitment', automatable: true },
  { sourceCode: 'CC1.2', targetCode: 'A.5.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Both cover information security roles and responsibilities', automatable: true },
  { sourceCode: 'CC1.3', targetCode: 'A.5.4', mappingType: 'partial', confidence: 'high', rationale: 'CC1.3 board oversight partially maps to ISO management direction', automatable: false },
  { sourceCode: 'CC1.4', targetCode: 'A.6.1', mappingType: 'equivalent', confidence: 'high', rationale: 'Both cover screening / personnel responsibilities', automatable: true },
  { sourceCode: 'CC1.5', targetCode: 'A.5.3', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address segregation of duties', automatable: true },

  // CC2 — Communication ↔ A.5 / A.6
  { sourceCode: 'CC2.1', targetCode: 'A.5.1', mappingType: 'partial', confidence: 'medium', rationale: 'Policy communication aligns with policy management', automatable: false },
  { sourceCode: 'CC2.2', targetCode: 'A.5.37', mappingType: 'partial', confidence: 'medium', rationale: 'External communication of objectives relates to documented procedures', automatable: false },
  { sourceCode: 'CC2.3', targetCode: 'A.6.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security event reporting lines', automatable: true },

  // CC3 — Risk Assessment ↔ A.5.7, A.5.8
  { sourceCode: 'CC3.1', targetCode: 'A.5.7', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require threat intelligence / risk identification processes', automatable: true },
  { sourceCode: 'CC3.2', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require IS risk management embedded in organizational processes', automatable: true },
  { sourceCode: 'CC3.3', targetCode: 'A.5.7', mappingType: 'partial', confidence: 'medium', rationale: 'Fraud risk partially covered by threat intelligence', automatable: false },
  { sourceCode: 'CC3.4', targetCode: 'A.5.8', mappingType: 'partial', confidence: 'medium', rationale: 'Change risk partially covered by risk management process', automatable: false },

  // CC4 — Monitoring Activities ↔ A.8 Technology Controls
  { sourceCode: 'CC4.1', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require ongoing monitoring of systems and networks', automatable: true },
  { sourceCode: 'CC4.2', targetCode: 'A.5.36', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address compliance evaluation and deficiency remediation', automatable: true },

  // CC5 — Control Activities ↔ A.5 / A.8
  { sourceCode: 'CC5.1', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address selecting controls to address risks', automatable: true },
  { sourceCode: 'CC5.2', targetCode: 'A.5.1', mappingType: 'partial', confidence: 'medium', rationale: 'Technology general controls partially mapped to policy requirements', automatable: false },
  { sourceCode: 'CC5.3', targetCode: 'A.5.5', mappingType: 'partial', confidence: 'medium', rationale: 'Both address liaison with regulators and relevant authorities', automatable: false },

  // CC6 — Logical Access ↔ A.5, A.6, A.8
  { sourceCode: 'CC6.1', targetCode: 'A.5.15', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require access control policies and user account management', automatable: true },
  { sourceCode: 'CC6.1', targetCode: 'A.5.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require identity management processes', automatable: true },
  { sourceCode: 'CC6.2', targetCode: 'A.5.17', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require authentication information management', automatable: true },
  { sourceCode: 'CC6.3', targetCode: 'A.5.18', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require access rights provisioning, review, and revocation', automatable: true },
  { sourceCode: 'CC6.4', targetCode: 'A.7.2', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address physical access restrictions', automatable: true },
  { sourceCode: 'CC6.5', targetCode: 'A.5.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address secure disposal and return of assets', automatable: true },
  { sourceCode: 'CC6.6', targetCode: 'A.8.21', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require network service security management', automatable: true },
  { sourceCode: 'CC6.7', targetCode: 'A.8.20', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address network security controls', automatable: true },
  { sourceCode: 'CC6.8', targetCode: 'A.8.7', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require malware protection controls', automatable: true },

  // CC7 — System Operations ↔ A.8
  { sourceCode: 'CC7.1', targetCode: 'A.8.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require management of technical vulnerabilities', automatable: true },
  { sourceCode: 'CC7.2', targetCode: 'A.8.16', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require monitoring for anomalous behavior and events', automatable: true },
  { sourceCode: 'CC7.3', targetCode: 'A.5.26', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address response to information security incidents', automatable: true },
  { sourceCode: 'CC7.4', targetCode: 'A.5.24', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security incident management planning', automatable: true },
  { sourceCode: 'CC7.5', targetCode: 'A.5.30', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address ICT readiness for business continuity', automatable: true },

  // CC8 — Change Management ↔ A.8
  { sourceCode: 'CC8.1', targetCode: 'A.8.32', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require formal change management procedures', automatable: true },

  // CC9 — Risk Mitigation ↔ A.5
  { sourceCode: 'CC9.1', targetCode: 'A.5.8', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address risk assessment and selection of mitigating controls', automatable: true },
  { sourceCode: 'CC9.2', targetCode: 'A.5.19', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information security in supplier relationships', automatable: true },

  // Availability ↔ A.5.30, A.8.14
  { sourceCode: 'A1.1', targetCode: 'A.5.30', mappingType: 'equivalent', confidence: 'high', rationale: 'Both address business continuity planning for ICT', automatable: true },
  { sourceCode: 'A1.2', targetCode: 'A.8.14', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require redundancy of information processing facilities', automatable: true },
  { sourceCode: 'A1.3', targetCode: 'A.8.13', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require information backup procedures', automatable: true },

  // Privacy ↔ A.5.34
  { sourceCode: 'P1.1', targetCode: 'A.5.34', mappingType: 'equivalent', confidence: 'high', rationale: 'Both require privacy and PII protection management', automatable: true },
];

@Injectable()
export class CrosswalkService implements OnModuleInit {
  private readonly logger = new Logger(CrosswalkService.name);

  constructor(
    private readonly library: ControlLibraryService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    // Seed crosswalks using direct DB lookups (not in-memory map) to avoid
    // initialization ordering race conditions.
    try {
      await this.seedCrosswalksFromDb();
    } catch (err) {
      this.logger.warn('Crosswalk seeding failed:', err.message);
    }
  }

  /**
   * Seeds crosswalk mappings by looking up control IDs directly from the DB.
   * This avoids the race condition where the in-memory map might not be ready.
   */
  private async seedCrosswalksFromDb(): Promise<void> {
    // Load all needed control codes in one query
    const allCodes = [
      ...new Set([
        ...SOC2_ISO_CROSSWALKS.map((m) => m.sourceCode),
        ...SOC2_ISO_CROSSWALKS.map((m) => m.targetCode),
      ]),
    ];

    const controls = await this.prisma.control.findMany({
      where: { code: { in: allCodes } },
      select: { id: true, code: true },
    });

    if (controls.length === 0) {
      this.logger.warn('Crosswalk seeding skipped — no controls found in DB yet');
      return;
    }

    const codeToId = new Map(controls.map((c) => [c.code, c.id]));
    let seeded = 0;
    let skipped = 0;

    for (const m of SOC2_ISO_CROSSWALKS) {
      const sourceId = codeToId.get(m.sourceCode);
      const targetId = codeToId.get(m.targetCode);
      if (!sourceId || !targetId) {
        skipped++;
        continue;
      }

      await this.prisma.frameworkCrosswalk.upsert({
        where: { sourceControlId_targetControlId: { sourceControlId: sourceId, targetControlId: targetId } },
        create: {
          sourceControlId: sourceId,
          targetControlId: targetId,
          mappingType: m.mappingType,
          confidence: m.confidence,
          rationale: m.rationale ?? null,
          automatable: m.automatable ?? false,
        },
        update: {
          mappingType: m.mappingType,
          confidence: m.confidence,
          rationale: m.rationale ?? null,
          automatable: m.automatable ?? false,
        },
      });
      seeded++;
    }

    this.logger.log(`Crosswalk seeding: ${seeded} upserted, ${skipped} skipped (missing codes)`);
  }

  /**
   * Get cross-framework mappings for a given control code.
   */
  async getMappingsForCode(controlCode: string) {
    const control = await this.library.getControlByCode(controlCode);
    if (!control) return [];
    return this.library.getCrosswalks(control.id);
  }

  /**
   * For a set of SOC2 control codes, return the ISO27001 equivalents.
   */
  getSoc2ToIsoMappings(soc2Codes: string[]): Array<{ soc2: string; iso: string; type: string }> {
    return SOC2_ISO_CROSSWALKS.filter((m) => soc2Codes.includes(m.sourceCode)).map((m) => ({
      soc2: m.sourceCode,
      iso: m.targetCode,
      type: m.mappingType,
    }));
  }

  /**
   * For a set of ISO27001 codes, return the SOC2 equivalents.
   */
  getIsoToSoc2Mappings(isoCodes: string[]): Array<{ iso: string; soc2: string; type: string }> {
    return SOC2_ISO_CROSSWALKS.filter((m) => isoCodes.includes(m.targetCode)).map((m) => ({
      iso: m.targetCode,
      soc2: m.sourceCode,
      type: m.mappingType,
    }));
  }
}
