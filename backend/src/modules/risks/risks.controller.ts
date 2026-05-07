import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

// Numeric values for risk score calculation
const LIKELIHOOD_SCORES: Record<string, number> = {
  rare: 1, unlikely: 2, possible: 3, likely: 4, almost_certain: 5,
};
const IMPACT_SCORES: Record<string, number> = {
  negligible: 1, minor: 2, moderate: 3, major: 4, catastrophic: 5,
};

function deriveSeverity(score: number): string {
  if (score >= 17) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5)  return 'medium';
  return 'low';
}

class CreateRiskDto {
  @ApiProperty() @IsString() title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;

  @ApiProperty({ enum: ['rare', 'unlikely', 'possible', 'likely', 'almost_certain'] })
  @IsEnum(['rare', 'unlikely', 'possible', 'likely', 'almost_certain'])
  likelihood: string;

  @ApiProperty({ enum: ['negligible', 'minor', 'moderate', 'major', 'catastrophic'] })
  @IsEnum(['negligible', 'minor', 'moderate', 'major', 'catastrophic'])
  impact: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() owner?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mitigationAdvice?: string;
}

class UpdateRiskDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mitigationAdvice?: string;
}

class CreateTreatmentDto {
  @ApiProperty({ enum: ['mitigate', 'accept', 'transfer', 'avoid'] })
  @IsEnum(['mitigate', 'accept', 'transfer', 'avoid'])
  treatmentType: string;

  @ApiProperty()
  @IsString()
  treatmentDescription: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  ownerRole?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsDateString()
  targetCompletionDate?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  residualRiskAfter?: string;
}

class AcceptTreatmentDto {
  @ApiPropertyOptional()
  @IsOptional() @IsString()
  acceptanceNote?: string;
}

@ApiTags('risks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('risks')
export class RisksController {
  constructor(private readonly prisma: PrismaService) {}

  // ── Risk Items ────────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Manually create a new risk item' })
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRiskDto) {
    if (dto.controlId) {
      const control = await this.prisma.organizationControl.findUnique({
        where: { orgId_controlId: { orgId: user.orgId, controlId: dto.controlId } },
      });
      if (!control) throw new BadRequestException('Control not found in this organization');
    }

    const lScore = LIKELIHOOD_SCORES[dto.likelihood];
    const iScore = IMPACT_SCORES[dto.impact];
    const riskScore = lScore * iScore;
    const severity = deriveSeverity(riskScore);

    return this.prisma.riskItem.create({
      data: {
        orgId: user.orgId,
        title: dto.title,
        description: dto.description ?? null,
        likelihood: dto.likelihood as any,
        impact: dto.impact as any,
        riskScore,
        severity,
        mitigationAdvice: dto.mitigationAdvice ?? null,
        owner: dto.owner ?? null,
        controlId: dto.controlId ?? null,
        identifiedBy: 'human' as any,
        status: 'open' as any,
      },
      include: { riskTreatments: true },
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all risk items for the org' })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
  ) {
    return this.prisma.riskItem.findMany({
      where: {
        orgId: user.orgId,
        ...(status && { status: status as any }),
        ...(severity && { severity }),
      },
      include: {
        riskTreatments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Risk summary stats' })
  async getStats(@CurrentUser() user: JwtPayload) {
    const [total, open, mitigated, accepted, highRisks] = await Promise.all([
      this.prisma.riskItem.count({ where: { orgId: user.orgId } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'open' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'mitigated' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'accepted' } }),
      this.prisma.riskItem.count({ where: { orgId: user.orgId, status: 'open', severity: { in: ['critical', 'high'] } } }),
    ]);

    const bySeverity = await this.prisma.riskItem.groupBy({
      by: ['severity'] as any,
      where: { orgId: user.orgId, status: 'open' as any },
      _count: true,
    });

    const severityMap = Object.fromEntries(
      (bySeverity as any[]).map((r: any) => [r.severity, r._count]),
    );

    return { total, open, mitigated, accepted, highRisks, bySeverity: severityMap };
  }

  @Get(':riskId')
  @ApiOperation({ summary: 'Get a specific risk with full treatment history' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
      include: {
        control: { include: { framework: true } },
        riskTreatments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!risk) throw new NotFoundException('Risk not found');
    return risk;
  }

  @Patch(':riskId')
  @ApiOperation({ summary: 'Update a risk item status or mitigation advice' })
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: UpdateRiskDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    return this.prisma.riskItem.update({
      where: { id: riskId },
      data: {
        ...(dto.status && { status: dto.status as any }),
        ...(dto.mitigationAdvice !== undefined && { mitigationAdvice: dto.mitigationAdvice }),
      },
    });
  }

  // ── Risk Treatments ────────────────────────────────────────────────────────

  @Get(':riskId/treatments')
  @ApiOperation({ summary: 'List all treatment decisions for a risk' })
  async listTreatments(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    return this.prisma.riskTreatment.findMany({
      where: { riskId },
      orderBy: { createdAt: 'desc' as any },
    });
  }

  @Post(':riskId/treatments')
  @ApiOperation({ summary: 'Create a risk treatment decision (mitigate/accept/transfer/avoid)' })
  async createTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Body() dto: CreateTreatmentDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.create({
      data: {
        riskId,
        orgId: user.orgId,
        treatmentType: dto.treatmentType as any,
        treatmentDescription: dto.treatmentDescription,
        targetCompletionDate: dto.targetCompletionDate ? new Date(dto.targetCompletionDate) : null,
        residualRiskAfter: dto.residualRiskAfter ?? null,
        status: 'open',
      },
    });

    return treatment;
  }

  @Patch(':riskId/treatments/:treatmentId/accept')
  @ApiOperation({ summary: 'Accept/sign-off on a risk treatment decision' })
  async acceptTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('treatmentId', ParseUUIDPipe) treatmentId: string,
    @Body() dto: AcceptTreatmentDto,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.findFirst({
      where: { id: treatmentId, riskId },
    });
    if (!treatment) throw new NotFoundException('Treatment not found');

    const updated = await this.prisma.riskTreatment.update({
      where: { id: treatmentId },
      data: {
        status: 'accepted',
        acceptedBy: user.sub,
        acceptedAt: new Date(),
      },
    });

    // If the treatment type is 'accept', close the risk as accepted
    // If 'avoid' or 'transfer', mark the risk as resolved
    if (treatment.treatmentType === 'accept') {
      await this.prisma.riskItem.update({
        where: { id: riskId },
        data: { status: 'accepted' as any },
      });
    } else if (treatment.treatmentType === 'avoid' || treatment.treatmentType === 'transfer') {
      await this.prisma.riskItem.update({
        where: { id: riskId },
        data: { status: 'mitigated' as any },
      });
    }

    return updated;
  }

  @Patch(':riskId/treatments/:treatmentId/complete')
  @ApiOperation({ summary: 'Mark a mitigation treatment as completed' })
  async completeTreatment(
    @CurrentUser() user: JwtPayload,
    @Param('riskId', ParseUUIDPipe) riskId: string,
    @Param('treatmentId', ParseUUIDPipe) treatmentId: string,
  ) {
    const risk = await this.prisma.riskItem.findFirst({
      where: { id: riskId, orgId: user.orgId },
    });
    if (!risk) throw new NotFoundException('Risk not found');

    const treatment = await this.prisma.riskTreatment.findFirst({
      where: { id: treatmentId, riskId },
    });
    if (!treatment) throw new NotFoundException('Treatment not found');

    if (treatment.treatmentType !== 'mitigate') {
      throw new BadRequestException('Only mitigate treatments can be marked complete');
    }

    await this.prisma.riskTreatment.update({
      where: { id: treatmentId },
      data: { status: 'completed' },
    });

    return this.prisma.riskItem.update({
      where: { id: riskId },
      data: { status: 'mitigated' as any },
    });
  }
}
