import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuditExportService } from '../../audit-exports/audit-export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('audit-exports')
@UseGuards(JwtAuthGuard)
export class AuditExportsController {
  constructor(private readonly auditExportService: AuditExportService) {}

  @Get()
  async listExports(@Req() req: any) {
    return this.auditExportService.listExports(req.user.orgId);
  }

  @Get(':id')
  async getExport(@Param('id') id: string) {
    return this.auditExportService.getExport(id);
  }

  @Post('soc2-readiness')
  async generateSoc2Report(@Req() req: any) {
    return this.auditExportService.generateSoc2ReadinessReport(req.user.orgId, req.user.id);
  }

  @Post('iso-soa')
  async generateIsoSoa(@Req() req: any) {
    return this.auditExportService.generateIsoSoa(req.user.orgId, req.user.id);
  }

  @Post('control-matrix')
  async generateControlMatrix(@Req() req: any) {
    return this.auditExportService.generateControlMatrix(req.user.orgId, req.user.id);
  }
}
