import {
  Controller, Post, Get, Body, UnauthorizedException,
  UseGuards, Req, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { InternalAuthGuard } from './internal.guard';
import * as bcrypt from 'bcrypt';

// ─── Auth DTOs ────────────────────────────────────────────────────────────────

class LoginDto {
  email: string;
  password: string;
}

// ─── Auth controller ──────────────────────────────────────────────────────────

@ApiTags('internal-auth')
@Controller('internal/auth')
export class InternalAuthController {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Internal admin login' })
  async login(@Body() dto: LoginDto) {
    // Simple env-based admin credentials for bootstrap
    const adminEmail = this.config.get<string>('INTERNAL_ADMIN_EMAIL') ?? 'admin@internal.io';
    const adminPasswordHash = this.config.get<string>('INTERNAL_ADMIN_PASSWORD_HASH');

    if (dto.email !== adminEmail) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // If no hash configured, fall back to plaintext env variable (dev mode)
    const adminPasswordPlain = this.config.get<string>('INTERNAL_ADMIN_PASSWORD') ?? 'InternalAdmin1!';
    const passwordMatch = adminPasswordHash
      ? await bcrypt.compare(dto.password, adminPasswordHash)
      : dto.password === adminPasswordPlain;

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const secret = this.config.get<string>('INTERNAL_JWT_SECRET') ?? this.config.get<string>('JWT_SECRET');
    const token = this.jwt.sign(
      { sub: 'platform-admin', email: dto.email, role: 'platform_admin' },
      { secret, audience: 'internal', expiresIn: '1h' },
    );

    return { token, requiresMfa: false };
  }
}

// ─── Stats controller ─────────────────────────────────────────────────────────

@ApiTags('internal')
@ApiBearerAuth('internal-token')
@UseGuards(InternalAuthGuard)
@Controller('internal')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide stats' })
  async getStats() {
    const [
      totalWorkflows,
      runningWorkflows,
      totalAgentRuns,
      recentLlmCalls,
      orgCount,
    ] = await Promise.all([
      this.prisma.workflow.count(),
      this.prisma.workflow.count({ where: { status: 'running' } }),
      this.prisma.agentRun.count(),
      this.prisma.lLMCall.findMany({
        orderBy: { createdAt: 'desc' },
        take: 500,
        select: {
          costUsd: true,
          latencyMs: true,
          hallucinationDetected: true,
          forbiddenLanguageDetected: true,
        },
      }),
      this.prisma.organization.count(),
    ]);

    const totalCostUsd = recentLlmCalls.reduce(
      (s, c) => s + parseFloat((c.costUsd as any)?.toString() ?? '0'),
      0,
    );
    const avgLatencyMs = recentLlmCalls.length
      ? recentLlmCalls.reduce((s, c) => s + (c.latencyMs ?? 0), 0) / recentLlmCalls.length
      : 0;
    const hallucinationsDetected = recentLlmCalls.filter((c) => c.hallucinationDetected).length;

    // Error rate from agent runs
    const recentRuns = await this.prisma.agentRun.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { status: true },
    });
    const errorRate = recentRuns.length
      ? recentRuns.filter((r) => r.status === 'failed').length / recentRuns.length
      : 0;

    return {
      totalWorkflows,
      runningWorkflows,
      totalAgentRuns,
      avgLatencyMs: Math.round(avgLatencyMs),
      totalCostUsd,
      hallucinationsDetected,
      activeCustomers: orgCount,
      errorRate,
    };
  }

  @Get('runs/recent')
  @ApiOperation({ summary: 'Recent agent runs across all orgs' })
  async getRecentRuns() {
    const runs = await this.prisma.agentRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        organization: { select: { name: true } },
      },
    });

    return runs.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      orgName: r.organization.name,
      status: r.status,
      durationMs: r.durationMs,
      costUsd: r.llmCostUsd ? parseFloat(r.llmCostUsd.toString()) : undefined,
      createdAt: r.createdAt,
    }));
  }

  @Get('llm/calls')
  @ApiOperation({ summary: 'LLM call traces across all orgs' })
  async getLlmCalls() {
    const calls = await this.prisma.llmCall.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Enrich with agent run data where available
    const agentRunIds = calls.map((c) => c.agentRunId).filter(Boolean) as string[];
    const agentRuns = agentRunIds.length
      ? await this.prisma.agentRun.findMany({
          where: { id: { in: agentRunIds } },
          include: { organization: { select: { name: true } } },
        })
      : [];
    const agentRunMap = new Map(agentRuns.map((r) => [r.id, r]));

    return calls.map((c) => {
      const run = c.agentRunId ? agentRunMap.get(c.agentRunId) : undefined;
      return {
        id: c.id,
        agentName: run?.agentName ?? 'Unknown',
        orgName: run?.organization?.name ?? 'Unknown',
        taskType: c.taskType,
        model: c.model,
        promptVersion: c.promptTemplateVersion,
        inputTokens: c.inputTokens ?? 0,
        outputTokens: c.outputTokens ?? 0,
        costUsd: parseFloat((c.costUsd as any)?.toString() ?? '0'),
        latencyMs: c.latencyMs ?? 0,
        status: c.hallucinationDetected ? 'hallucination' :
                c.forbiddenLanguageDetected ? 'forbidden' :
                c.schemaValid === false ? 'error' : 'success',
        retryCount: c.retryCount,
        createdAt: c.createdAt,
      };
    });
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Active prompt templates' })
  async getPrompts() {
    const templates = await this.prisma.promptTemplate.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { llmCalls: true } },
      },
    });

    return templates.map((t) => ({
      id: t.id,
      agentName: t.agentName,
      taskType: t.taskType,
      version: t.version,
      purpose: t.purpose,
      content: t.systemPrompt,
      inputVariables: Array.isArray(t.inputVariables) ? t.inputVariables : [],
      usageCount: t._count.llmCalls,
      isActive: t.isActive,
    }));
  }
}
