import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { ReadinessService } from '../../readiness/readiness.service';
import { VelocityService } from './velocity.service';
import { BenchmarkService } from './benchmark.service';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('readiness')
@UseGuards(JwtAuthGuard)
export class ReadinessController {
  constructor(
    private readonly readinessService: ReadinessService,
    private readonly velocityService: VelocityService,
    private readonly benchmarkService: BenchmarkService,
    private readonly llm: LlmService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getCurrent(@Req() req: any) {
    return this.readinessService.getLatest(req.user.orgId);
  }

  @Get('history')
  async getHistory(@Req() req: any, @Query('limit') limit?: string) {
    return this.readinessService.getHistory(req.user.orgId, limit ? parseInt(limit) : 30);
  }

  @Get('breakdown')
  async getBreakdown(@Req() req: any) {
    const latest = await this.readinessService.getLatest(req.user.orgId);
    if (!latest) return { message: 'No readiness score computed yet. Run /readiness/recalculate first.' };
    return {
      overall: latest.overallScore,
      breakdown: {
        controlDesign: latest.controlDesignScore,
        evidence: latest.evidenceScore,
        policy: latest.policyScore,
        operational: latest.operationalScore,
        riskManagement: latest.riskManagementScore,
      },
      framework: latest.framework,
      formulaVersion: latest.formulaVersion,
      scoreInputs: latest.scoreInputs,
      snapshotAt: latest.snapshotAt,
    };
  }

  @Post('recalculate')
  async recalculate(@Req() req: any, @Query('frameworks') frameworks?: string) {
    const frameworkList = frameworks ? frameworks.split(',') : undefined;
    const result = await this.readinessService.calculate(req.user.orgId, frameworkList);
    return {
      success: true,
      overall: result.overall,
      soc2: result.soc2?.overall,
      iso27001: result.iso27001?.overall,
      computedAt: result.computedAt,
    };
  }

  @Get('velocity')
  async getVelocity(@Req() req: any) {
    return this.velocityService.getVelocity(req.user.orgId);
  }

  @Get('benchmark')
  async getBenchmark(@Req() req: any) {
    return this.benchmarkService.getBenchmark(req.user.orgId);
  }

  @Post('digest')
  async generateDigest(@Req() req: any) {
    const orgId = req.user.orgId;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Gather data concurrently
    const [readiness, velocity, openRisks, overdueTasks, expiringEvidence, recentWins, openExceptions] = await Promise.all([
      this.readinessService.getLatest(orgId),
      this.velocityService.getVelocity(orgId),
      this.prisma.riskItem.findMany({
        where: { orgId, status: 'open', severity: { in: ['critical', 'high'] } },
        orderBy: { riskScore: 'desc' },
        take: 5,
        select: { title: true, severity: true, riskScore: true },
      }),
      this.prisma.task.findMany({
        where: { orgId, status: { not: 'done' }, dueDate: { lt: now } },
        orderBy: { dueDate: 'asc' },
        take: 5,
        include: { assignee: { select: { fullName: true } } },
      }),
      this.prisma.evidence.findMany({
        where: { orgId, expiresAt: { gte: now, lte: thirtyDaysFromNow } },
        take: 5,
        select: { title: true, expiresAt: true },
      }),
      this.prisma.organizationControl.findMany({
        where: { orgId, status: 'implemented', updatedAt: { gte: sevenDaysAgo } },
        include: { control: { select: { code: true, title: true } } },
        take: 5,
      }),
      this.prisma.controlException.count({ where: { orgId, status: 'active' } }).catch(() => 0),
    ]);

    // Org profile for context
    const profile = await this.prisma.businessProfile.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    const profileData = (profile?.profileData as any) ?? {};
    const companyName = profileData.companyName ?? 'Your Organization';
    const frameworks = (profileData.complianceGoals?.targetFrameworks ?? ['SOC 2']).join(', ');

    // Build context for LLM
    const score = (readiness as any)?.overallScore ?? 'N/A';
    const vel = (velocity as any)?.velocity ?? {};
    const forecast = (velocity as any)?.forecast ?? {};

    const contextLines = [
      `Company: ${companyName}`,
      `Target Frameworks: ${frameworks}`,
      `Overall Readiness Score: ${score}%`,
      `Compliance velocity: ${vel.completedLast30Days ?? 0} controls implemented in the last 30 days (${vel.dailyRate ?? 0}/day)`,
      forecast.daysToCompletion != null ? `Estimated audit-ready in: ${forecast.daysToCompletion} days` : '',
      ``,
      `HIGH-PRIORITY OPEN RISKS (${openRisks.length}):`,
      ...openRisks.map((r) => `  - [${r.severity.toUpperCase()}] ${r.title} (score: ${r.riskScore})`),
      ``,
      `OVERDUE TASKS (${overdueTasks.length}):`,
      ...overdueTasks.map((t: any) => `  - "${t.title}" — due ${new Date(t.dueDate).toLocaleDateString()} — owner: ${t.assignee?.fullName ?? 'unassigned'}`),
      ``,
      `EVIDENCE EXPIRING IN 30 DAYS (${expiringEvidence.length}):`,
      ...expiringEvidence.map((e) => `  - "${e.title}" — expires ${new Date(e.expiresAt!).toLocaleDateString()}`),
      ``,
      `RECENT WINS (controls implemented in last 7 days, ${recentWins.length}):`,
      ...recentWins.map((w) => `  - [${w.control.code}] ${w.control.title}`),
      ``,
      `Active exceptions requiring attention: ${openExceptions}`,
    ].filter((l) => l !== undefined).join('\n');

    const systemPrompt = `You are a compliance program manager writing a concise weekly status update for executive stakeholders. Write in professional, clear language. Be specific with numbers. Focus on what matters: risks, blockers, and what's going well. Use Markdown for formatting.`;

    const userPrompt = `Generate a compliance weekly digest for ${companyName} based on this data:\n\n${contextLines}\n\nWrite a professional weekly update in Markdown with these sections:\n1. **Executive Summary** (2-3 sentences, overall posture)\n2. **Readiness Score** (brief commentary on the score)\n3. **Top Risks to Address** (if any critical/high open risks)\n4. **Action Items This Week** (overdue tasks + expiring evidence)\n5. **Progress This Week** (recent wins)\n6. **Coming Up** (what to focus on next)\n\nKeep it concise — fit on one page. Write it as if you're emailing the executive team.`;

    const response = await this.llm.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      { agentName: 'audit', temperature: 0.3 },
    );

    return {
      digest: response.content,
      generatedAt: now.toISOString(),
      metadata: {
        score,
        openHighRisks: openRisks.length,
        overdueTasks: overdueTasks.length,
        expiringEvidence: expiringEvidence.length,
        recentWins: recentWins.length,
      },
    };
  }
}
