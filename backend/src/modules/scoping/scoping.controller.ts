import { Controller, Get, Post, Patch, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ScopingService } from '../../scoping/scoping.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('scoping')
@UseGuards(JwtAuthGuard)
export class ScopingController {
  constructor(private readonly scopingService: ScopingService) {}

  // ── SOC 2 ─────────────────────────────────────────────────────────────────

  @Get('soc2/current')
  async getCurrentSoc2Scope(@Req() req: any) {
    return this.scopingService.getCurrentSoc2Scope(req.user.orgId);
  }

  @Post('soc2/generate')
  async createSoc2Scope(@Req() req: any, @Body() body: any) {
    return this.scopingService.createSoc2Scope(req.user.orgId, body.workflowId, body);
  }

  @Patch('soc2/:id/approve')
  async approveSoc2Scope(@Param('id') id: string, @Req() req: any) {
    return this.scopingService.approveSoc2Scope(id, req.user.id);
  }

  // ── ISO 27001 ─────────────────────────────────────────────────────────────

  @Get('iso/current')
  async getCurrentIsoScope(@Req() req: any) {
    return this.scopingService.getCurrentIsoScope(req.user.orgId);
  }

  @Post('iso/generate')
  async createIsoScope(@Req() req: any, @Body() body: any) {
    return this.scopingService.createIsoScope(req.user.orgId, body);
  }

  @Patch('iso/:id/approve')
  async approveIsoScope(@Param('id') id: string, @Req() req: any) {
    return this.scopingService.approveIsoScope(id, req.user.id);
  }

  // ── Statement of Applicability ─────────────────────────────────────────────

  @Get('iso/soa')
  async getSoa(@Req() req: any) {
    return this.scopingService.getSoa(req.user.orgId);
  }

  @Post('iso/soa/generate')
  async generateSoa(@Req() req: any) {
    return this.scopingService.generateSoa(req.user.orgId);
  }
}
