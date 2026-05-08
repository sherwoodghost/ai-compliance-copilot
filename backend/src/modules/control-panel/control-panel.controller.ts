import { Controller, Get, Patch, Post, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ControlPanelService } from './control-panel.service';
import { LlmService } from '../../llm/llm.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('control-panel')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('control-panel')
export class ControlPanelController {
  constructor(
    private readonly controlPanelService: ControlPanelService,
    private readonly llm: LlmService,
  ) {}

  @Get('workflows')
  @ApiOperation({ summary: 'List all workflows for the control panel list view' })
  listWorkflows(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.controlPanelService.listWorkflows(user.orgId, limit ? parseInt(limit) : 20);
  }

  @Get('stats')
  @ApiOperation({ summary: 'System-wide stats: cost, tokens, run counts' })
  getSystemStats(@CurrentUser() user: JwtPayload) {
    return this.controlPanelService.getSystemStats(user.orgId);
  }

  @Get('workflows/:workflowId/canvas')
  @ApiOperation({ summary: 'Get full workflow canvas data (nodes + edges + run details)' })
  getCanvas(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    return this.controlPanelService.getWorkflowCanvas(user.orgId, workflowId);
  }

  @Post('workflows/:workflowId/ai-diagnose')
  @ApiOperation({ summary: 'AI: analyze a workflow run, identify failures and bottlenecks, and recommend fixes' })
  async aiDiagnose(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    const canvas = await this.controlPanelService.getWorkflowCanvas(user.orgId, workflowId);
    const nodes: any[] = canvas.nodes ?? [];

    if (!nodes.length) {
      return { workflowId, diagnosis: 'No agent runs found for this workflow.', issues: [], recommendations: [] };
    }

    const totalCostUsd = canvas.totalCostUsd ?? 0;
    const totalDurationMs = canvas.totalDurationMs ?? 0;

    // Build a textual summary of the run
    const agentSummary = nodes.map((n: any) => {
      const durationS = n.durationMs ? (n.durationMs / 1000).toFixed(1) : '?';
      const cost = n.llmCostUsd ? `$${Number(n.llmCostUsd).toFixed(4)}` : '$0';
      const retries = n.retryCount ? ` | retries: ${n.retryCount}` : '';
      const error = n.errorMessage ? ` | ERROR: ${String(n.errorMessage).slice(0, 150)}` : '';
      return `- ${n.agentName} | status: ${n.status} | ${durationS}s | ${cost}${retries}${error}`;
    }).join('\n');

    const failedCount = nodes.filter((n: any) => n.status === 'failed').length;
    const slowNodes = nodes.filter((n: any) => n.durationMs && n.durationMs > 30000);

    const systemPrompt = `You are a compliance platform reliability engineer. Analyze AI agent workflow runs and provide actionable diagnostics. Be concise and technical. Focus on what's broken and how to fix it.`;

    const userPrompt = `Analyze this compliance workflow run:

Workflow: "${canvas.workflow?.name ?? 'Unknown'}"
Overall status: ${canvas.workflow?.status ?? 'unknown'}
Total duration: ${(totalDurationMs / 1000).toFixed(1)}s
Total LLM cost: $${Number(totalCostUsd).toFixed(4)}
Failed agents: ${failedCount}/${nodes.length}
Slow agents (>30s): ${slowNodes.map((n: any) => n.agentName).join(', ') || 'none'}

AGENT RUN SUMMARY:
${agentSummary}

Return ONLY a JSON object (no markdown):
{
  "overallHealth": "healthy|degraded|failed",
  "summary": "1-2 sentence plain-English summary of what happened in this workflow run",
  "issues": [
    {
      "agentName": "agent-name",
      "issueType": "failure|timeout|high_cost|retry_loop|dependency_error",
      "severity": "critical|high|medium|low",
      "description": "what went wrong",
      "rootCause": "likely technical root cause",
      "fix": "concrete recommended fix or retry strategy"
    }
  ],
  "bottleneck": "name of the slowest or most expensive agent, or null",
  "costOptimizations": ["Specific suggestion to reduce cost/latency"],
  "recommendations": ["Action 1 to improve reliability", "Action 2"]
}

Focus on actionable findings. If the workflow completed successfully with no issues, say so and suggest optimizations.`;

    const raw = await this.llm.complete(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { agentName: 'audit', temperature: 0.2 },
    );

    let result: any = {};
    try {
      result = JSON.parse(raw.content.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim());
    } catch {
      result = {};
    }

    const validHealth = ['healthy', 'degraded', 'failed'];
    const validSeverity = ['critical', 'high', 'medium', 'low'];
    const validIssueType = ['failure', 'timeout', 'high_cost', 'retry_loop', 'dependency_error'];

    return {
      workflowId,
      workflowName: canvas.workflow?.name ?? '',
      overallHealth:  validHealth.includes(result.overallHealth) ? result.overallHealth : 'degraded',
      summary:        String(result.summary ?? '').slice(0, 400),
      issues: (Array.isArray(result.issues) ? result.issues : []).slice(0, 8).map((i: any) => ({
        agentName:   String(i.agentName ?? '').slice(0, 60),
        issueType:   validIssueType.includes(i.issueType) ? i.issueType : 'failure',
        severity:    validSeverity.includes(i.severity) ? i.severity : 'medium',
        description: String(i.description ?? '').slice(0, 200),
        rootCause:   String(i.rootCause ?? '').slice(0, 200),
        fix:         String(i.fix ?? '').slice(0, 250),
      })),
      bottleneck:          result.bottleneck ? String(result.bottleneck).slice(0, 60) : null,
      costOptimizations:   (Array.isArray(result.costOptimizations) ? result.costOptimizations : []).slice(0, 4).map(String),
      recommendations:     (Array.isArray(result.recommendations) ? result.recommendations : []).slice(0, 4).map(String),
      stats: { totalCostUsd, totalDurationMs, failedCount, totalAgents: nodes.length },
      generatedAt: new Date().toISOString(),
    };
  }

  @Get('runs/:runId/steps/:stepId')
  @ApiOperation({ summary: 'Get a specific step with input/output for replay' })
  getStepDetail(
    @CurrentUser() user: JwtPayload,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
  ) {
    return this.controlPanelService.getStepDetail(user.orgId, runId, stepId);
  }

  @Get('workflows/:workflowId/events')
  @ApiOperation({ summary: 'Get agent event log for a workflow (full trace)' })
  getEventLog(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
  ) {
    return this.controlPanelService.getAgentEventLog(user.orgId, workflowId);
  }

  @Patch('runs/:runId/steps/:stepId/input')
  @ApiOperation({ summary: 'Update a step input payload (for replay with custom input)' })
  updateStepInput(
    @CurrentUser() user: JwtPayload,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Param('stepId', ParseUUIDPipe) stepId: string,
    @Body() body: { input: Record<string, unknown> },
  ) {
    return this.controlPanelService.updateStepInput(user.orgId, runId, stepId, body.input);
  }
}
