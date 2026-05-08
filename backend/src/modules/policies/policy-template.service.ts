import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

// Placeholder patterns extracted for variable substitution
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

// Profile field → display name mapping for variable resolution
const PROFILE_FIELD_MAP: Record<string, string> = {
  company_name:   'companyName',
  industry:       'industry',
  employee_count: 'employeeCount',
  hq_country:     'regions',
  frameworks:     'targetFrameworks',
  data_types:     'dataTypes',
  ciso_name:      'ownerAccess',
  dpo_name:       'ownerCompliance',
  it_admin_name:  'ownerInfrastructure',
};

@Injectable()
export class PolicyTemplateService {
  private readonly logger = new Logger(PolicyTemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** List all active policy templates */
  async listTemplates() {
    return this.prisma.policyTemplate.findMany({
      where: { isActive: true },
      select: {
        id: true,
        title: true,
        framework: true,
        controls: true,
      },
      orderBy: { title: 'asc' },
    });
  }

  /** Get one template */
  async getTemplate(templateId: string) {
    const t = await this.prisma.policyTemplate.findUnique({ where: { id: templateId } });
    if (!t) throw new NotFoundException('Policy template not found');
    return t;
  }

  /**
   * Instantiate a policy template for an org.
   * Steps:
   * 1. Load template + business profile
   * 2. Resolve {{variable}} placeholders from profile
   * 3. LLM personalization pass (temp 0.2, no new sections)
   * 4. Create Policy record with status=draft, authorId=initiatorId
   * 5. Create ControlEvidence mappings for all covered controls
   */
  async instantiateTemplate(
    orgId: string,
    templateId: string,
    initiatorId: string,
  ) {
    const template = await this.prisma.policyTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) throw new NotFoundException('Policy template not found');

    // Load business profile
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    const profileData = (profile as any) ?? {};

    // Step 1: Resolve simple string {{variable}} placeholders
    let draftContent = template.content.replace(VARIABLE_PATTERN, (_, key) => {
      const profileField = PROFILE_FIELD_MAP[key] ?? key;
      const val = profileData[profileField];
      if (!val) return `{{${key}}}`;
      if (Array.isArray(val)) return (val as string[]).join(', ');
      return String(val);
    });

    // Step 2: LLM personalization pass
    try {
      const companyName  = profileData.companyName  ?? 'the organization';
      const industry     = profileData.industry     ?? 'technology';
      const employeeCount = profileData.employeeCount ?? 'unknown size';
      const frameworks   = Array.isArray(profileData.targetFrameworks)
        ? profileData.targetFrameworks.join(', ')
        : String(profileData.targetFrameworks ?? 'ISO 27001, SOC 2');

      const systemPrompt =
        'You are a compliance policy writer. Personalize this policy draft for the specific organization. ' +
        'Rules: (1) Do NOT add new sections. (2) Do NOT remove required ISO clauses. ' +
        '(3) Replace generic references with org-specific language. (4) Fill remaining {{placeholder}} values with reasonable defaults. ' +
        '(5) Return ONLY the updated policy markdown — no preamble, no commentary.';

      const userPrompt =
        `Organization: ${companyName} (${industry}, ${employeeCount} employees, targeting: ${frameworks})\n\n` +
        `POLICY DRAFT:\n${draftContent}\n\n` +
        `Personalize the draft above for ${companyName}. Preserve all section headings and ISO clause references.`;

      const result = await this.llm.complete(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { agentName: 'audit', temperature: 0.2 },
      );

      if (result?.content && result.content.length > 200) {
        draftContent = result.content;
      }
    } catch (err) {
      this.logger.warn(`LLM personalization failed (non-fatal): ${(err as Error).message}`);
    }

    // Step 3: Find the primary control for this policy template
    // Templates have a `controls` array of control codes. Find the first org control.
    let controlId: string | undefined;
    if (template.controls.length > 0) {
      const orgControl = await this.prisma.organizationControl.findFirst({
        where: {
          orgId,
          control: { code: { in: template.controls } },
        },
        include: { control: { select: { id: true } } },
      });
      controlId = (orgControl as any)?.control?.id;
    }

    // Step 4: Create Policy record
    const existingVersions = await this.prisma.policy.findMany({
      where: { orgId, ...(controlId && { controlId }) },
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    const nextVersion = existingVersions.length > 0 ? (existingVersions[0].version ?? 0) + 1 : 1;

    const policy = await this.prisma.policy.create({
      data: {
        orgId,
        title:       template.title,
        content:     draftContent,
        status:      'draft',
        generatedBy: 'agent',
        authorId:    initiatorId,
        templateId,
        version:     nextVersion,
        ...(controlId && { controlId }),
      } as any,
    });

    this.logger.log(`Policy "${template.title}" instantiated for org ${orgId} (id=${policy.id})`);
    return {
      policy,
      unresolvedPlaceholders: (draftContent.match(VARIABLE_PATTERN) ?? []).length,
    };
  }

  /**
   * Instantiate all available templates for an org at once.
   * Used by the guided program / onboarding to generate a full policy library.
   * Idempotent: skips templates already instantiated (by templateId match).
   */
  async instantiateAll(orgId: string, initiatorId: string) {
    const templates = await this.prisma.policyTemplate.findMany({
      where: { isActive: true },
    });

    const existing = await this.prisma.policy.findMany({
      where: { orgId },
      select: { templateId: true },
    });
    const existingTemplateIds = new Set(existing.map((p) => (p as any).templateId).filter(Boolean));

    let created = 0;
    let skipped = 0;

    for (const template of templates) {
      if (existingTemplateIds.has(template.id)) {
        skipped++;
        continue;
      }
      try {
        await this.instantiateTemplate(orgId, template.id, initiatorId);
        created++;
      } catch (err) {
        this.logger.warn(`Failed to instantiate template "${template.title}": ${(err as Error).message}`);
      }
    }

    return { created, skipped };
  }
}
