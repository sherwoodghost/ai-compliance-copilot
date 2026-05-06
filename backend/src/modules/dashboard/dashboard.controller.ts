import { Controller, Get, Post, Patch, Body, Query, UseGuards, Req } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /dashboard/config
   * Returns the latest dashboard config for the calling user's role (or ?role= override).
   */
  @Get('config')
  async getConfig(@Req() req: any, @Query('role') role?: string) {
    const roleView = role ?? 'executive';
    const orgId = req.user.orgId;

    const config = await this.prisma.dashboardConfig.findFirst({
      where: { orgId, roleView },
      orderBy: { version: 'desc' },
    });

    if (!config) {
      // Return a sensible default if no config has been generated yet
      return this.getDefaultConfig(orgId, roleView);
    }

    return config;
  }

  /**
   * GET /dashboard/config/all
   * Admin view — all configs for all roles.
   */
  @Get('config/all')
  async getAllConfigs(@Req() req: any) {
    return this.prisma.dashboardConfig.findMany({
      where: { orgId: req.user.orgId },
      orderBy: [{ roleView: 'asc' }, { version: 'desc' }],
    });
  }

  /**
   * POST /dashboard/regenerate
   * Queue the DashboardAgent to regenerate configs for one or all roles.
   */
  @Post('regenerate')
  async regenerate(@Req() req: any, @Body() body: { role?: string }) {
    // The actual agent queuing happens via the orchestrator.
    // For now, return a 202 indicating the request was accepted.
    return {
      message: 'Dashboard regeneration queued',
      role: body.role ?? 'all',
      orgId: req.user.orgId,
    };
  }

  /**
   * PATCH /dashboard/config/layout
   * Save manual widget layout overrides (position/visibility).
   */
  @Patch('config/layout')
  async updateLayout(
    @Req() req: any,
    @Body() body: { roleView: string; widgetOverrides: any[] },
  ) {
    const existing = await this.prisma.dashboardConfig.findFirst({
      where: { orgId: req.user.orgId, roleView: body.roleView },
      orderBy: { version: 'desc' },
    });

    if (!existing) {
      const defaultCfg = this.getDefaultConfig(req.user.orgId, body.roleView);
      return this.prisma.dashboardConfig.create({
        data: {
          orgId: req.user.orgId,
          roleView: body.roleView,
          widgets: body.widgetOverrides,
          navigation: [],
          alerts: [],
          recommendedActions: [],
          generatedBy: 'manual',
          version: 1,
        },
      });
    }

    const currentWidgets = (existing.widgets as any[]) ?? [];
    const merged = currentWidgets.map((w: any) => {
      const override = body.widgetOverrides.find((o: any) => o.id === w.id);
      return override ? { ...w, ...override } : w;
    });

    return this.prisma.dashboardConfig.create({
      data: {
        orgId: req.user.orgId,
        roleView: body.roleView,
        widgets: merged,
        navigation: existing.navigation as any,
        alerts: existing.alerts as any,
        recommendedActions: existing.recommendedActions as any,
        generatedBy: 'manual',
        version: existing.version + 1,
      },
    });
  }

  // ── Default config ────────────────────────────────────────────────────────

  private getDefaultConfig(orgId: string, roleView: string) {
    const ROLE_WIDGETS: Record<string, any[]> = {
      executive: [
        { id: 'readiness-score', type: 'stat', title: 'Readiness Score', priority: 1, dataSource: '/readiness/breakdown' },
        { id: 'open-risks', type: 'stat', title: 'Open High Risks', priority: 2, dataSource: '/risks/stats' },
        { id: 'pending-tasks', type: 'stat', title: 'Pending Tasks', priority: 3, dataSource: '/tasks' },
        { id: 'audit-timeline', type: 'chart', title: 'Readiness Over Time', priority: 4, dataSource: '/readiness/history' },
      ],
      security: [
        { id: 'control-status', type: 'chart', title: 'Control Implementation', priority: 1, dataSource: '/controls' },
        { id: 'evidence-gaps', type: 'table', title: 'Evidence Gaps', priority: 2, dataSource: '/evidence' },
        { id: 'open-risks', type: 'table', title: 'Open Risks', priority: 3, dataSource: '/risks' },
        { id: 'llm-calls', type: 'stat', title: 'AI Calls Today', priority: 4, dataSource: '/llm/stats' },
      ],
      auditor: [
        { id: 'evidence-completeness', type: 'progress', title: 'Evidence Completeness', priority: 1, dataSource: '/evidence' },
        { id: 'policy-coverage', type: 'progress', title: 'Policy Coverage', priority: 2, dataSource: '/policies' },
        { id: 'soa-status', type: 'table', title: 'Statement of Applicability', priority: 3, dataSource: '/scoping/iso/soa' },
        { id: 'audit-exports', type: 'table', title: 'Audit Exports', priority: 4, dataSource: '/audit-exports' },
      ],
      admin: [
        { id: 'readiness-score', type: 'stat', title: 'Readiness Score', priority: 1, dataSource: '/readiness/breakdown' },
        { id: 'agent-runs', type: 'table', title: 'Recent Agent Runs', priority: 2, dataSource: '/workflows' },
        { id: 'llm-stats', type: 'stat', title: 'LLM Gateway Stats', priority: 3, dataSource: '/llm/stats' },
        { id: 'integrations', type: 'table', title: 'Integration Status', priority: 4, dataSource: '/integrations' },
      ],
      contributor: [
        { id: 'my-tasks', type: 'table', title: 'My Tasks', priority: 1, dataSource: '/tasks' },
        { id: 'my-controls', type: 'table', title: 'Assigned Controls', priority: 2, dataSource: '/controls' },
        { id: 'evidence-needed', type: 'alert', title: 'Evidence Needed', priority: 3, dataSource: '/evidence' },
      ],
    };

    return {
      id: 'default',
      orgId,
      roleView,
      widgets: ROLE_WIDGETS[roleView] ?? ROLE_WIDGETS.executive,
      navigation: [],
      alerts: [],
      recommendedActions: [],
      generatedBy: 'default',
      version: 0,
      createdAt: new Date().toISOString(),
    };
  }
}
