import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

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
