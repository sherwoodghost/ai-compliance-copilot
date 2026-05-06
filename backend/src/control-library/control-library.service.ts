import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SOC2_DOMAINS, SOC2_CONTROLS, ControlSeedRecord } from './seeds/soc2-controls.seed';
import { ISO27001_DOMAINS, ISO27001_CONTROLS } from './seeds/iso27001-controls.seed';

@Injectable()
export class ControlLibraryService implements OnModuleInit {
  private readonly logger = new Logger(ControlLibraryService.name);

  // In-memory maps for fast validation (loaded at startup)
  private soc2ControlCodes = new Set<string>();
  private iso27001ControlCodes = new Set<string>();
  private controlIdByCode = new Map<string, string>(); // code → db uuid

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedLibrary();
    await this.loadControlMaps();
  }

  // ── Seeding ──────────────────────────────────────────────────────────────────

  private async seedLibrary() {
    this.logger.log('Seeding Control Library...');

    // SOC 2
    const soc2Framework = await this.upsertFramework('SOC2', 'SOC 2', '2017', 'SOC 2 Trust Services Criteria');
    await this.seedDomains(soc2Framework.id, SOC2_DOMAINS);
    await this.seedControls(soc2Framework.id, SOC2_CONTROLS, 'SOC2');

    // ISO 27001
    const isoFramework = await this.upsertFramework('ISO27001', 'ISO/IEC 27001', '2022', 'ISO/IEC 27001:2022 Information Security Management');
    await this.seedDomains(isoFramework.id, ISO27001_DOMAINS);
    await this.seedControls(isoFramework.id, ISO27001_CONTROLS, 'ISO27001');

    this.logger.log('Control Library seeding complete.');
  }

  private async upsertFramework(type: string, name: string, version: string, description: string) {
    return this.prisma.framework.upsert({
      where: { type_version: { type: type as any, version } },
      create: { type: type as any, name, version, description, isActive: true },
      update: { name, description, isActive: true },
    });
  }

  private async seedDomains(frameworkId: string, domains: Array<{
    code: string; name: string; trustServiceCategory?: string; description?: string; sortOrder: number;
  }>) {
    for (const domain of domains) {
      await this.prisma.controlDomain.upsert({
        where: { frameworkId_code: { frameworkId, code: domain.code } },
        create: {
          frameworkId,
          code: domain.code,
          name: domain.name,
          trustServiceCategory: domain.trustServiceCategory ?? null,
          description: domain.description ?? null,
          sortOrder: domain.sortOrder,
        },
        update: {
          name: domain.name,
          trustServiceCategory: domain.trustServiceCategory ?? null,
          description: domain.description ?? null,
          sortOrder: domain.sortOrder,
        },
      });
    }
  }

  private async seedControls(frameworkId: string, controls: ControlSeedRecord[], frameworkType: string) {
    // Build domain code → id map
    const domains = await this.prisma.controlDomain.findMany({ where: { frameworkId } });
    const domainMap = new Map(domains.map((d) => [d.code, d.id]));

    for (const ctrl of controls) {
      const domainId = domainMap.get(ctrl.domain) ?? null;

      // Upsert the base control
      const control = await this.prisma.control.upsert({
        where: { frameworkId_code: { frameworkId, code: ctrl.code } },
        create: {
          frameworkId,
          code: ctrl.code,
          title: ctrl.title,
          description: ctrl.description,
          category: ctrl.category,
          weight: ctrl.weight,
        },
        update: {
          title: ctrl.title,
          description: ctrl.description,
          category: ctrl.category,
          weight: ctrl.weight,
        },
      });

      // Upsert library meta
      await this.prisma.controlLibraryMeta.upsert({
        where: { controlId: control.id },
        create: {
          controlId: control.id,
          domainId,
          applicabilityNotes: ctrl.trustServiceCategory
            ? `Trust Service Category: ${ctrl.trustServiceCategory}`
            : null,
          confidence: 'high',
          sourceReference: frameworkType === 'SOC2'
            ? 'AICPA Trust Services Criteria 2017'
            : 'ISO/IEC 27001:2022 Annex A',
        },
        update: {
          domainId,
        },
      });

      // Upsert evidence requirements (delete+create to handle changes)
      await this.prisma.controlEvidenceRequirement.deleteMany({ where: { controlId: control.id } });
      if (ctrl.evidenceRequirements?.length) {
        await this.prisma.controlEvidenceRequirement.createMany({
          data: ctrl.evidenceRequirements.map((er) => ({
            controlId: control.id,
            evidenceType: er.evidenceType,
            description: er.description,
            isMandatory: er.isMandatory,
            freshnessDays: er.freshnessDays ?? null,
          })),
        });
      }

      // Upsert policy requirements
      await this.prisma.controlPolicyRequirement.deleteMany({ where: { controlId: control.id } });
      if (ctrl.policyRequirements?.length) {
        await this.prisma.controlPolicyRequirement.createMany({
          data: ctrl.policyRequirements.map((pr) => ({
            controlId: control.id,
            policyName: pr.policyName,
            description: pr.description,
          })),
        });
      }
    }

    this.logger.log(`Seeded ${controls.length} ${frameworkType} controls`);
  }

  // ── In-memory Maps ──────────────────────────────────────────────────────────

  private async loadControlMaps() {
    const allControls = await this.prisma.control.findMany({
      include: { framework: true },
    });

    for (const ctrl of allControls) {
      this.controlIdByCode.set(ctrl.code, ctrl.id);
      if (ctrl.framework.type === 'SOC2') {
        this.soc2ControlCodes.add(ctrl.code);
      } else if (ctrl.framework.type === 'ISO27001') {
        this.iso27001ControlCodes.add(ctrl.code);
      }
    }

    this.logger.log(
      `Loaded ${this.soc2ControlCodes.size} SOC2 + ${this.iso27001ControlCodes.size} ISO27001 control codes into memory`,
    );
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Validate a list of control codes against the library.
   * Used by LlmGatewayService to catch hallucinated control IDs.
   */
  validateControlIds(codes: string[]): { valid: string[]; invalid: string[] } {
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const code of codes) {
      if (this.controlIdByCode.has(code)) {
        valid.push(code);
      } else {
        invalid.push(code);
      }
    }
    return { valid, invalid };
  }

  /**
   * Get controls for a specific framework with full metadata.
   */
  async getControlsByFramework(frameworkType: 'SOC2' | 'ISO27001') {
    return this.prisma.control.findMany({
      where: { framework: { type: frameworkType as any } },
      include: {
        framework: true,
        libraryMeta: { include: { domain: true } },
        evidenceRequirements: true,
        policyRequirements: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get full control library (both frameworks).
   */
  async getFullLibrary() {
    return this.prisma.control.findMany({
      include: {
        framework: true,
        libraryMeta: { include: { domain: true } },
        evidenceRequirements: true,
        policyRequirements: true,
      },
      orderBy: [{ framework: { type: 'asc' } }, { code: 'asc' }],
    });
  }

  /**
   * Get a single control by its code (e.g. "CC6.3").
   */
  async getControlByCode(code: string) {
    const id = this.controlIdByCode.get(code);
    if (!id) return null;
    return this.prisma.control.findUnique({
      where: { id },
      include: {
        framework: true,
        libraryMeta: { include: { domain: true } },
        evidenceRequirements: true,
        policyRequirements: true,
        crosswalkSources: { include: { targetControl: true } },
        crosswalkTargets: { include: { sourceControl: true } },
      },
    });
  }

  /**
   * Get cross-framework mappings for a control.
   */
  async getCrosswalks(controlId: string) {
    return this.prisma.frameworkCrosswalk.findMany({
      where: { OR: [{ sourceControlId: controlId }, { targetControlId: controlId }] },
      include: {
        sourceControl: { include: { framework: true } },
        targetControl: { include: { framework: true } },
      },
    });
  }

  /**
   * Get the internal DB uuid for a control code (for FK relations).
   */
  getControlId(code: string): string | undefined {
    return this.controlIdByCode.get(code);
  }

  /**
   * Get all control codes for a framework (for applicability engine).
   */
  getFrameworkCodes(frameworkType: 'SOC2' | 'ISO27001'): Set<string> {
    return frameworkType === 'SOC2' ? this.soc2ControlCodes : this.iso27001ControlCodes;
  }

  /**
   * Get controls by their DB ids.
   */
  async getControlsByIds(ids: string[]) {
    return this.prisma.control.findMany({
      where: { id: { in: ids } },
      include: { framework: true, evidenceRequirements: true, policyRequirements: true },
    });
  }

  /**
   * Seed SOC2×ISO27001 crosswalk mappings (called once after both frameworks seeded).
   */
  async seedCrosswalks(mappings: Array<{
    sourceCode: string;
    targetCode: string;
    mappingType: 'equivalent' | 'partial' | 'related';
    confidence: 'high' | 'medium' | 'low';
    rationale?: string;
    automatable?: boolean;
  }>) {
    for (const m of mappings) {
      const sourceId = this.controlIdByCode.get(m.sourceCode);
      const targetId = this.controlIdByCode.get(m.targetCode);
      if (!sourceId || !targetId) continue;

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
    }
    this.logger.log(`Seeded ${mappings.length} crosswalk mappings`);
  }
}
