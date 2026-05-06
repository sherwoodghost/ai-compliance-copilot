import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

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
      };
    });
  }
}
