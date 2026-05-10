import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';

export interface OrgContext {
  orgName: string;
  industry: string;
  employeeCount: string;
  cloudProviders: string[];
  dataTypes: string[];
  operatingRegions: string[];
  techStack: string[];
}

export interface GapResult {
  controlCode: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  finding: string;
  recommendation: string;
}

export interface GapAnalysisResult {
  frameworkId: string;
  frameworkName: string;
  gaps: GapResult[];
  readinessPercent: number;
  prioritizedActions: string[];
}

@Injectable()
export abstract class BaseFrameworkExpertAgent {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly llm: LlmService,
  ) {
    this.logger = new Logger(this.constructor.name);
  }

  abstract readonly frameworkId: string;
  abstract readonly frameworkDisplayName: string;
  protected abstract readonly agentName: string;
  protected abstract readonly expertSystemContext: string;

  abstract getControlCodePrefix(): string;

  isFrameworkControl(code: string): boolean {
    return code.startsWith(this.getControlCodePrefix());
  }

  async analyzeGap(orgContext: OrgContext): Promise<GapAnalysisResult> {
    const systemPrompt = this.buildSystemPrompt(orgContext);
    const userPrompt = `Analyze compliance gaps for ${orgContext.orgName}. Industry: ${orgContext.industry}. Employees: ${orgContext.employeeCount}. Cloud: ${orgContext.cloudProviders.join(', ')}. Data types: ${orgContext.dataTypes.join(', ')}. Regions: ${orgContext.operatingRegions.join(', ')}.

Return a JSON object with:
- gaps: array of {controlCode, title, severity, finding, recommendation}
- readinessPercent: 0-100
- prioritizedActions: string[] (top 5 actions)`;

    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: userPrompt }],
      { agentName: this.agentName, systemPrompt, maxTokens: 4096, temperature: 0.2 },
    );

    const parsed = this.llm.parseJSON<Omit<GapAnalysisResult, 'frameworkId' | 'frameworkName'>>(response.content);
    return {
      frameworkId: this.frameworkId,
      frameworkName: this.frameworkDisplayName,
      ...parsed,
    };
  }

  async explainRequirement(clause: string, orgContext: OrgContext): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(orgContext);
    const response = await this.llm.completeWithRetry(
      [{ role: 'user', content: `Explain requirement ${clause} in practical terms for ${orgContext.orgName}, a ${orgContext.industry} company with ${orgContext.employeeCount} employees. What specifically must they do to comply? What evidence is expected?` }],
      { agentName: this.agentName, systemPrompt, maxTokens: 2048, temperature: 0.3 },
    );
    return response.content;
  }

  protected buildSystemPrompt(orgContext: OrgContext): string {
    return `You are a ${this.frameworkDisplayName} compliance expert.

${this.expertSystemContext}

Organization context:
- Name: ${orgContext.orgName}
- Industry: ${orgContext.industry}
- Size: ${orgContext.employeeCount} employees
- Cloud: ${orgContext.cloudProviders.join(', ') || 'Not specified'}
- Data types: ${orgContext.dataTypes.join(', ') || 'Not specified'}
- Regions: ${orgContext.operatingRegions.join(', ') || 'Not specified'}

Always return valid JSON when asked. Be specific to this organization's context.`;
  }
}
