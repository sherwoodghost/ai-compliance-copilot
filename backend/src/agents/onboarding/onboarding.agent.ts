import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LlmService } from '../../llm/llm.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { ComplianceJourneyService } from '../../compliance-journey/compliance-journey.service';
import { DialogueManagerService } from './dialogue-manager.service';
import { BaseAgent } from '../base/base.agent';
import { AgentJobData, AgentOutput } from '../base/agent.interfaces';
import { BusinessProfile } from '../types/business-profile.type';

const ONBOARDING_STATES = [
  'GREETING',
  'COMPANY_BASICS',
  'TECH_STACK',
  'DATA_HANDLING',
  'CURRENT_POSTURE',
  'COMPLIANCE_GOALS',
  'CLARIFICATION',
  'CONFIRMATION',
] as const;

type OnboardingState = (typeof ONBOARDING_STATES)[number];


@Injectable()
export class OnboardingAgent extends BaseAgent {
  protected readonly agentName = 'onboarding';

  constructor(
    prisma: PrismaService,
    llm: LlmService,
    journeyService: ComplianceJourneyService,
    gateway: LlmGatewayService,
    private readonly dialogueManager: DialogueManagerService,
  ) {
    super(prisma, llm, journeyService, gateway);
  }

  protected async process(jobData: AgentJobData, runId: string): Promise<AgentOutput> {
    const { orgId, inputPayload } = jobData;
    const { sessionId, userMessage } = inputPayload as {
      sessionId: string;
      userMessage: string;
    };

    // ── Step 1: Load session state ──────────────────────────────────────────
    const session = await this.recordStep(runId, 'load_session', 0, { sessionId }, async () => {
      const s = await this.prisma.onboardingSession.findUnique({
        where: { id: sessionId },
        include: { messages: { orderBy: { turnIndex: 'asc' } } },
      });
      if (!s) throw new Error(`Session not found: ${sessionId}`);
      return { state: s.currentState, turnCount: s.turnCount, extractedData: s.extractedData };
    });

    // ── Step 2: Store user message ──────────────────────────────────────────
    const sessionData = await this.prisma.onboardingSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { turnIndex: 'asc' } } },
    });
    const turnIndex = sessionData!.turnCount;

    if (userMessage) {
      await this.prisma.onboardingMessage.create({
        data: {
          sessionId,
          turnIndex,
          role: 'user',
          content: userMessage,
          extractedFields: {},
          stateAtTime: sessionData!.currentState,
        },
      });
    }

    // ── Step 3: Build conversation history for LLM ──────────────────────────
    const history = sessionData!.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const extractedSoFar = sessionData!.extractedData as Record<string, unknown>;
    const currentState = sessionData!.currentState as OnboardingState;

    // ── Step 4: Call LLM for next response ─────────────────────────────────
    const llmResponse = await this.recordStep(runId, 'generate_response', 1, {
      state: currentState,
      extractedFields: Object.keys(extractedSoFar).length,
    }, async () => {
      const contextPrompt = userMessage
        ? `Current state: ${currentState}\nAlready extracted: ${JSON.stringify(extractedSoFar, null, 2)}\n\nUser just said: "${userMessage}"\n\nGenerate the next response and extract any new information from what the user said.`
        : `Current state: GREETING\nThis is the start of the onboarding interview. Greet the user warmly, explain what you're about to do in 1-2 sentences, and ask for their company name and what they do.`;

      const response = await this.callGateway(runId, { promptTemplateId: 'onboarding-dialogue', userMessage: contextPrompt, taskType: 'onboarding', orgId, workflowId: jobData?.workflowId, maxTokens: 1024 });

      return { content: response.content };
    });

    const assistantContent = (llmResponse as any).content as string;

    // ── Step 5: Extract JSON if present ────────────────────────────────────
    let newExtractedFields: Record<string, unknown> = {};
    let nextState = currentState;
    let stateComplete = false;

    const jsonMatch = assistantContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        newExtractedFields = parsed.extracted ?? {};
        nextState = parsed.nextState ?? currentState;
        stateComplete = parsed.stateComplete ?? false;
      } catch {
        this.logger.warn('Failed to parse extraction JSON from onboarding response');
      }
    }

    // Strip JSON block from displayed content
    const displayContent = assistantContent.replace(/```(?:json)?[\s\S]*?```/g, '').trim();

    // ── Step 6: Merge extracted data ────────────────────────────────────────
    const mergedData = this.mergeExtracted(extractedSoFar, newExtractedFields);

    // ── Step 7: Check completion ────────────────────────────────────────────
    const isComplete = this.checkCompletion(mergedData);
    const finalState = isComplete ? 'CONFIRMATION' : nextState;

    // ── Step 8: Persist updates ─────────────────────────────────────────────
    await this.prisma.$transaction(async (tx) => {
      await tx.onboardingMessage.create({
        data: {
          sessionId,
          turnIndex: turnIndex + 1,
          role: 'assistant',
          content: displayContent,
          extractedFields: newExtractedFields as any,
          stateAtTime: finalState,
        },
      });

      await tx.onboardingSession.update({
        where: { id: sessionId },
        data: {
          currentState: finalState,
          extractedData: mergedData as any,
          turnCount: { increment: userMessage ? 2 : 1 },
          status: isComplete ? 'completed' : 'in_progress',
          completedAt: isComplete ? new Date() : undefined,
        },
      });
    });

    // ── Step 9: If complete, build and save BusinessProfile ─────────────────
    if (isComplete) {
      await this.buildBusinessProfile(orgId, mergedData, runId);
    }

    return {
      success: true,
      data: {
        assistantMessage: displayContent,
        extractedFields: newExtractedFields,
        currentState: finalState,
        isComplete,
        turnCount: turnIndex + (userMessage ? 2 : 1),
      },
    };
  }

  private mergeExtracted(
    existing: Record<string, unknown>,
    newFields: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...existing };
    for (const [key, value] of Object.entries(newFields)) {
      if (value !== null && value !== undefined && value !== '') {
        result[key] = value;
      }
    }
    return result;
  }

  private checkCompletion(data: Record<string, unknown>): boolean {
    const required = [
      'companyName',
      'companyType',
      'industry',
      'employeeCount',
      'infrastructure.cloudProviders',
      'dataHandling.dataTypes',
      'complianceGoals.frameworks',
    ];
    return required.every((field) => data[field] !== undefined && data[field] !== null);
  }

  private async buildBusinessProfile(
    orgId: string,
    data: Record<string, unknown>,
    runId: string,
  ) {
    await this.recordStep(runId, 'build_business_profile', 2, { orgId }, async () => {
      const riskLevel = this.calculateRiskLevel(data);
      const riskFactors = this.identifyRiskFactors(data);

      const profileData = {
        orgId,
        companyName: (data['companyName'] as string) ?? 'Unknown',
        companyType: (data['companyType'] as any) ?? 'startup',
        industry: (data['industry'] as any) ?? 'saas',
        subIndustry: data['subIndustry'] as string | undefined,
        employeeCount: (data['employeeCount'] as string) ?? '1-10',
        engineeringCount: data['engineeringCount'] as string | undefined,
        hqCountry: data['hqCountry'] as string | undefined,
        operatesIn: (data['operatesIn'] as string[]) ?? [],
        infrastructure: {
          cloudProviders: data['infrastructure.cloudProviders'] ?? [],
          usesTerraform: data['infrastructure.usesTerraform'] ?? false,
          usesKubernetes: data['infrastructure.usesKubernetes'] ?? false,
          ciCd: data['infrastructure.ciCd'] ?? [],
        },
        tools: {
          versionControl: (data['tools.versionControl'] as string) ?? null,
          identityProvider: (data['tools.identityProvider'] as string) ?? null,
          ticketing: (data['tools.ticketing'] as string) ?? null,
          monitoring: (data['tools.monitoring'] as string) ?? null,
          communication: (data['tools.communication'] as string) ?? null,
        } as any,
        dataHandling: {
          dataTypes: (data['dataHandling.dataTypes'] as string[]) ?? [],
          piiVolume: data['dataHandling.piiVolume'],
          storesDataIn: data['dataHandling.storesDataIn'],
          dataResidency: data['dataHandling.dataResidency'] ?? [],
        },
        currentPosture: {
          hasSecurityTeam: data['currentPosture.hasSecurityTeam'] ?? false,
          usesMfa: data['currentPosture.usesMfa'] ?? 'none',
          hasSso: data['currentPosture.hasSso'] ?? false,
          hasVulnScanning: data['currentPosture.hasVulnScanning'] ?? false,
          hasIncidentResponsePlan: data['currentPosture.hasIncidentResponsePlan'] ?? false,
          hasExistingPolicies: data['currentPosture.hasExistingPolicies'] ?? false,
        },
        complianceGoals: {
          frameworks: (data['complianceGoals.frameworks'] as string[]) ?? [],
          soc2Type: data['complianceGoals.soc2Type'] ?? 'type_ii',
          targetDate: data['complianceGoals.targetDate'],
          driver: data['complianceGoals.driver'],
        },
        riskProfile: {
          riskLevel,
          riskFactors,
          recommendedPriority: this.buildPriorityList(data),
          estimatedReadiness: this.estimateReadiness(data),
        },
        collectedVia: 'onboarding_agent' as const,
        isComplete: true,
        completedAt: new Date(),
      };

      await this.prisma.businessProfile.upsert({
        where: { orgId },
        create: profileData as any,
        update: { ...profileData, version: { increment: 1 } } as any,
      });

      return { riskLevel, riskFactors };
    });
  }

  private calculateRiskLevel(data: Record<string, unknown>): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;
    const dataTypes = (data['dataHandling.dataTypes'] as string[]) ?? [];
    if (dataTypes.includes('health_phi')) score += 3;
    if (dataTypes.includes('payment_card')) score += 3;
    if (dataTypes.includes('financial')) score += 2;
    if (dataTypes.includes('pii')) score += 1;
    if (data['currentPosture.usesMfa'] === 'none') score += 2;
    if (!data['currentPosture.hasSecurityTeam']) score += 1;
    if (!data['currentPosture.hasIncidentResponsePlan']) score += 1;
    if (score >= 6) return 'critical';
    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private identifyRiskFactors(data: Record<string, unknown>): string[] {
    const factors: string[] = [];
    const dataTypes = (data['dataHandling.dataTypes'] as string[]) ?? [];
    if (dataTypes.includes('health_phi')) factors.push('handles_phi');
    if (dataTypes.includes('payment_card')) factors.push('handles_payment_cards');
    if (data['currentPosture.usesMfa'] === 'none') factors.push('no_mfa');
    if (!data['currentPosture.hasSecurityTeam']) factors.push('no_security_team');
    if (!data['currentPosture.hasIncidentResponsePlan']) factors.push('no_incident_response_plan');
    if (!data['currentPosture.hasVulnScanning']) factors.push('no_vulnerability_scanning');
    return factors;
  }

  private buildPriorityList(data: Record<string, unknown>): string[] {
    const base = ['Logical and Physical Access', 'Risk Assessment', 'Control Environment'];
    const dataTypes = (data['dataHandling.dataTypes'] as string[]) ?? [];
    if (dataTypes.includes('health_phi')) base.unshift('Data Protection');
    if (dataTypes.includes('payment_card')) base.unshift('Cryptography');
    return base;
  }

  private estimateReadiness(data: Record<string, unknown>): number {
    let score = 20; // baseline
    if (data['currentPosture.hasExistingPolicies']) score += 15;
    if (data['currentPosture.usesMfa'] === 'full') score += 20;
    if (data['currentPosture.usesMfa'] === 'partial') score += 10;
    if (data['currentPosture.hasSso']) score += 10;
    if (data['currentPosture.hasSecurityTeam']) score += 15;
    if (data['currentPosture.hasVulnScanning']) score += 10;
    if (data['currentPosture.hasIncidentResponsePlan']) score += 10;
    return Math.min(score, 100);
  }
}
