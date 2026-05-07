import {
  Controller, Get, Post, Patch, Delete, UseGuards, Body, Param,
  ParseUUIDPipe, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
