import {
  Controller, Get, Post, Patch, Delete, UseGuards, Body, Param,
  ParseUUIDPipe, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

class CreateVendorDto {
  @IsString() vendorName: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['critical', 'high', 'medium', 'low']) riskLevel?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() website?: string;
}

class UpdateVendorDto {
  @IsOptional() @IsString() vendorName?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(['critical', 'high', 'medium', 'low']) riskLevel?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() notes?: string | null;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() findings?: string[];
  @IsOptional() mitigations?: string[];
  @IsOptional() summary?: string;
}

@ApiTags('vendor-risk')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('vendor-risk')
export class VendorRiskController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all vendor risk assessments for the org' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const vendors = await this.prisma.vendorRisk.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ riskLevel: 'asc' }, { updatedAt: 'desc' }],
    });

    return vendors.map((v) => {
      const assessment = (v.assessment as Record<string, unknown>) ?? {};
      return {
        id: v.id,
        vendorName: v.vendorName,
        category: v.category,
        riskLevel: v.riskLevel,
        lastReviewedAt: v.lastAssessedAt,
        findings: assessment.findings ?? [],
        mitigations: assessment.mitigations ?? [],
        status: assessment.status ?? 'pending',
        summary: assessment.summary,
        contactEmail: assessment.contactEmail,
        website: assessment.website,
        notes: assessment.notes,
      };
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a vendor risk entry' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateVendorDto) {
    const vendor = await this.prisma.vendorRisk.create({
      data: {
        orgId: user.orgId,
        vendorName: dto.vendorName,
        category: dto.category,
        riskLevel: (dto.riskLevel as any) ?? 'medium',
        assessment: {
          status: 'pending',
          findings: [],
          mitigations: [],
          notes: dto.notes ?? null,
          contactEmail: dto.contactEmail ?? null,
          website: dto.website ?? null,
        },
        lastAssessedAt: new Date(),
      },
    });

    const a = vendor.assessment as any;
    return {
      id: vendor.id,
      vendorName: vendor.vendorName,
      category: vendor.category,
      riskLevel: vendor.riskLevel,
      lastReviewedAt: vendor.lastAssessedAt,
      findings: a.findings ?? [],
      mitigations: a.mitigations ?? [],
      status: a.status ?? 'pending',
      summary: a.summary,
      contactEmail: a.contactEmail,
      website: a.website,
      notes: a.notes,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vendor risk entry' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    const existing = await this.prisma.vendorRisk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    if (existing.orgId !== user.orgId) throw new ForbiddenException();

    const currentAssessment = (existing.assessment as Record<string, unknown>) ?? {};
    const updatedAssessment: Record<string, unknown> = {
      ...currentAssessment,
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.findings !== undefined && { findings: dto.findings }),
      ...(dto.mitigations !== undefined && { mitigations: dto.mitigations }),
      ...(dto.summary !== undefined && { summary: dto.summary }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail }),
      ...(dto.website !== undefined && { website: dto.website }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
    };

    const updated = await this.prisma.vendorRisk.update({
      where: { id },
      data: {
        ...(dto.vendorName && { vendorName: dto.vendorName }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.riskLevel && { riskLevel: dto.riskLevel as any }),
        assessment: updatedAssessment as any,
        lastAssessedAt: new Date(),
      },
    });

    const a = updated.assessment as any;
    return {
      id: updated.id,
      vendorName: updated.vendorName,
      category: updated.category,
      riskLevel: updated.riskLevel,
      lastReviewedAt: updated.lastAssessedAt,
      findings: a.findings ?? [],
      mitigations: a.mitigations ?? [],
      status: a.status ?? 'pending',
      summary: a.summary,
      contactEmail: a.contactEmail,
      website: a.website,
      notes: a.notes,
    };
  }

  @Post(':id/analyze')
  @ApiOperation({ summary: 'AI: analyze a vendor and generate findings, mitigations, and risk level' })
  async analyzeVendor(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.prisma.vendorRisk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    if (existing.orgId !== user.orgId) throw new ForbiddenException();

    const currentAssessment = (existing.assessment as Record<string, unknown>) ?? {};
    const notes = (currentAssessment.notes as string) ?? '';

    // Fetch org profile for context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const profileData = (profile?.profileData as any) ?? {};

    const systemPrompt = `You are a vendor security and compliance analyst. Assess third-party vendors based on their known security practices, certifications, breach history, and compliance posture. Return ONLY valid JSON.`;
    const userPrompt = `Analyze this vendor for a ${profileData.industry ?? 'software'} company:

Vendor: ${existing.vendorName}
Category: ${existing.category ?? 'unknown'}
${notes ? `Internal notes: ${notes}` : ''}

Company's data types: ${(profileData.dataHandling?.dataTypes ?? []).join(', ') || 'general business data'}
Company's compliance frameworks: ${(profileData.complianceGoals?.targetFrameworks ?? []).join(', ') || 'SOC 2'}

Return JSON with this structure:
{
  "riskLevel": "critical" | "high" | "medium" | "low",
  "summary": "2-3 sentence executive summary of this vendor's risk posture",
  "findings": ["finding 1", "finding 2", ...],  (3-5 specific security/compliance findings)
  "mitigations": ["mitigation 1", ...],  (3-5 actionable mitigations)
  "certifications": ["ISO 27001", ...],  (known certifications if any)
  "subprocessors": ["vendor A", ...],  (notable subprocessors if known)
  "dataRetentionRisk": "low" | "medium" | "high"
}`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'vendor-risk', temperature: 0.2 },
    );

    let aiResult: any = {};
    try {
      const raw = response.content.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      aiResult = JSON.parse(raw);
    } catch {
      aiResult = { summary: response.content, findings: [], mitigations: [] };
    }

    const updatedAssessment = {
      ...currentAssessment,
      summary: aiResult.summary ?? currentAssessment['summary'],
      findings: aiResult.findings ?? [],
      mitigations: aiResult.mitigations ?? [],
      certifications: aiResult.certifications ?? [],
      subprocessors: aiResult.subprocessors ?? [],
      dataRetentionRisk: aiResult.dataRetentionRisk ?? 'medium',
      status: 'approved',
      aiAnalyzedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.vendorRisk.update({
      where: { id },
      data: {
        riskLevel: aiResult.riskLevel ?? existing.riskLevel,
        assessment: updatedAssessment as any,
        lastAssessedAt: new Date(),
      },
    });

    const a = updated.assessment as any;
    return {
      id: updated.id,
      vendorName: updated.vendorName,
      category: updated.category,
      riskLevel: updated.riskLevel,
      lastReviewedAt: updated.lastAssessedAt,
      findings: a.findings ?? [],
      mitigations: a.mitigations ?? [],
      certifications: a.certifications ?? [],
      subprocessors: a.subprocessors ?? [],
      dataRetentionRisk: a.dataRetentionRisk,
      status: a.status ?? 'approved',
      summary: a.summary,
      aiAnalyzedAt: a.aiAnalyzedAt,
    };
  }

  @Post(':id/ai-questionnaire')
  @ApiOperation({ summary: 'AI: generate a vendor security questionnaire tailored to this vendor\'s risk profile' })
  async generateQuestionnaire(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.prisma.vendorRisk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    if (existing.orgId !== user.orgId) throw new ForbiddenException();

    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    const pd = (profile?.profileData as any) ?? {};
    const frameworks = (pd.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');
    const dataTypes  = (pd.dataHandling?.dataTypes ?? []).join(', ') || 'customer data';
    const a = (existing.assessment as any) ?? {};

    const systemPrompt = `You are a vendor risk manager creating a security questionnaire to send to a third-party vendor. Write questions that are specific, answerable, and directly relevant to the vendor's risk profile.`;

    const userPrompt = `Generate a vendor security questionnaire for this vendor:

Vendor: ${existing.vendorName}
Category: ${existing.category ?? 'unknown'}
Risk Level: ${existing.riskLevel}
${a.summary ? `Risk Summary: ${a.summary}` : ''}
${(a.findings ?? []).length > 0 ? `Known Risk Areas: ${(a.findings as string[]).slice(0, 4).join('; ')}` : ''}

Our Organisation's Compliance Frameworks: ${frameworks}
Data we share with this vendor: ${dataTypes}

Generate 12-15 questions covering: Data Security, Access Controls, Incident Response, Business Continuity, Compliance Certifications, Subprocessors, Data Retention, Penetration Testing, Employee Security Training.

Return ONLY a JSON array (no markdown):
[
  {
    "category": "Data Security|Access Controls|Incident Response|Business Continuity|Compliance|Subprocessors|Data Retention|Penetration Testing|Employee Security",
    "question": "The specific question to ask",
    "required": true|false,
    "notes": "Brief note on what a good answer looks like (optional, 1 sentence max)"
  }
]`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'vendor-risk', temperature: 0.2 },
    );

    let questions: any[] = [];
    try {
      const match = raw.content.match(/\[[\s\S]*\]/);
      if (match) questions = JSON.parse(match[0]);
      if (!Array.isArray(questions)) questions = [];
    } catch {
      questions = [];
    }

    const validCategories = ['Data Security', 'Access Controls', 'Incident Response', 'Business Continuity', 'Compliance', 'Subprocessors', 'Data Retention', 'Penetration Testing', 'Employee Security'];

    return {
      vendorId:   existing.id,
      vendorName: existing.vendorName,
      riskLevel:  existing.riskLevel,
      frameworks,
      questions:  questions.slice(0, 15).map((q: any) => ({
        category: validCategories.includes(q.category) ? q.category : 'Data Security',
        question: String(q.question ?? '').slice(0, 400),
        required: Boolean(q.required ?? true),
        notes:    q.notes ? String(q.notes).slice(0, 150) : null,
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vendor risk entry' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.prisma.vendorRisk.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Vendor not found');
    if (existing.orgId !== user.orgId) throw new ForbiddenException();

    await this.prisma.vendorRisk.delete({ where: { id } });
    return { deleted: true };
  }
}
