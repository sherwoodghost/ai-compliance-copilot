import { Controller, Get, Param, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { ControlLibraryService } from '../../control-library/control-library.service';
import { ControlApplicabilityEngine } from '../../control-library/applicability-engine.service';
import { CrosswalkService } from '../../control-library/crosswalk.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('controls/library')
@UseGuards(JwtAuthGuard)
export class ControlLibraryController {
  constructor(
    private readonly library: ControlLibraryService,
    private readonly applicability: ControlApplicabilityEngine,
    private readonly crosswalk: CrosswalkService,
  ) {}

  @Get()
  async getFullLibrary() {
    return this.library.getFullLibrary();
  }

  @Get(':framework')
  async getByFramework(@Param('framework') framework: string) {
    const type = framework.toUpperCase() as 'SOC2' | 'ISO27001';
    return this.library.getControlsByFramework(type);
  }

  @Get('control/:code')
  async getByCode(@Param('code') code: string) {
    return this.library.getControlByCode(code);
  }

  @Get('control/:code/crosswalks')
  async getCrosswalks(@Param('code') code: string) {
    return this.crosswalk.getMappingsForCode(code);
  }

  @Get('applicability')
  async getApplicabilityMatrix(@Req() req: any) {
    return this.applicability.getApplicabilityMatrix(req.user.orgId);
  }

  @Patch('applicability/:controlId')
  async overrideApplicability(
    @Param('controlId') controlId: string,
    @Body() body: { applicable: boolean; rationale: string },
    @Req() req: any,
  ) {
    return this.applicability.overrideApplicability(
      req.user.orgId,
      controlId,
      body.applicable,
      body.rationale,
      req.user.id,
    );
  }
}
