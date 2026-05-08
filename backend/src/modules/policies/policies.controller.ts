import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PoliciesService } from './policies.service';
import { PolicyTemplateService } from './policy-template.service';
import { CreatePolicyDto, UpdatePolicyDto } from './dto/policies.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('policies')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(
    private readonly policiesService: PoliciesService,
    private readonly policyTemplateService: PolicyTemplateService,
  ) {}

  @Get('templates')
  @ApiOperation({ summary: 'List all active policy templates' })
  listTemplates() {
    return this.policyTemplateService.listTemplates();
  }

  @Post('from-template/:templateId')
  @ApiOperation({ summary: 'Instantiate a policy template for the org (LLM-personalized draft)' })
  instantiateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.policyTemplateService.instantiateTemplate(user.orgId, templateId, user.sub);
  }

  @Post('from-template-all')
  @ApiOperation({ summary: 'Instantiate all policy templates for the org (idempotent)' })
  instantiateAll(@CurrentUser() user: JwtPayload) {
    return this.policyTemplateService.instantiateAll(user.orgId, user.sub);
  }

  @Get()
  @ApiQuery({ name: 'controlId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('controlId') controlId?: string,
    @Query('status') status?: string,
  ) {
    return this.policiesService.findAll(user.orgId, controlId, status);
  }

  @Get(':policyId')
  findOne(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.policiesService.findOne(user.orgId, policyId);
  }

  @Get(':policyId/versions')
  @ApiOperation({ summary: 'Get version history for the control this policy belongs to' })
  getVersionHistory(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.policiesService.findOne(user.orgId, policyId).then((p) =>
      this.policiesService.getVersionHistory(user.orgId, p.controlId),
    );
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreatePolicyDto) {
    return this.policiesService.create(user.orgId, dto, user.sub);
  }

  @Patch(':policyId')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.policiesService.update(user.orgId, policyId, dto);
  }

  @Patch(':policyId/approve')
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Approve a policy (admin only)' })
  approve(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.policiesService.approve(user.orgId, policyId, user.sub);
  }

  @Patch(':policyId/archive')
  @Roles(UserRole.admin)
  archive(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.policiesService.archive(user.orgId, policyId);
  }

  @Post(':policyId/new-version')
  @ApiOperation({ summary: 'Create new draft version of a policy' })
  newVersion(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() body: { content: string },
  ) {
    return this.policiesService.createNewVersion(user.orgId, policyId, body.content);
  }

  @Post(':policyId/ai-draft')
  @ApiOperation({ summary: 'AI: generate or improve a policy document based on control requirements and org context' })
  aiDraft(
    @CurrentUser() user: JwtPayload,
    @Param('policyId', ParseUUIDPipe) policyId: string,
  ) {
    return this.policiesService.aiDraft(user.orgId, policyId);
  }

  @Post('ai-coverage-check')
  @Roles(UserRole.admin, UserRole.auditor, UserRole.member)
  @ApiOperation({ summary: 'AI: check policy library coverage against target compliance frameworks and identify gaps' })
  aiCoverageCheck(@CurrentUser() user: JwtPayload) {
    return this.policiesService.aiCoverageCheck(user.orgId);
  }
}
