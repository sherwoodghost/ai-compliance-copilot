import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GitHubAdapter } from './adapters/github.adapter';
import { AwsAdapter } from './adapters/aws.adapter';
import { OktaAdapter } from './adapters/okta.adapter';
import { JiraAdapter } from './adapters/jira.adapter';
import { DatadogAdapter } from './adapters/datadog.adapter';
import { GoogleWorkspaceAdapter } from './adapters/google-workspace.adapter';
import { IntegrationAdapter } from './adapters/integration.interface';
import { IntegrationProvider } from '@prisma/client';
import { SecretManagerService } from '../../integrations/secret-manager.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly adapterMap: Record<string, IntegrationAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAdapter: GitHubAdapter,
    private readonly awsAdapter: AwsAdapter,
    private readonly oktaAdapter: OktaAdapter,
    private readonly jiraAdapter: JiraAdapter,
    private readonly datadogAdapter: DatadogAdapter,
    private readonly googleWorkspaceAdapter: GoogleWorkspaceAdapter,
    private readonly secretManager: SecretManagerService,
  ) {
    this.adapterMap = {
      github: this.githubAdapter,
      aws: this.awsAdapter,
      okta: this.oktaAdapter,
      jira: this.jiraAdapter,
      datadog: this.datadogAdapter,
      google_workspace: this.googleWorkspaceAdapter,
    };
  }

  async findAll(orgId: string) {
    return this.prisma.integration.findMany({
      where: { orgId },
      select: {
        id: true,
        provider: true,
        status: true,
        lastSyncedAt: true,
        settings: true,
        createdAt: true,
        // Never expose credentials
      },
    });
  }

  async connect(
    orgId: string,
    provider: IntegrationProvider,
    credentials: Record<string, unknown>,
    settings?: Record<string, unknown>,
  ) {
    const adapter = this.adapterMap[provider];
    if (!adapter) {
      throw new BadRequestException(`Integration for "${provider}" is not yet supported`);
    }

    // Test connection before saving
    const testResult = await adapter.testConnection(credentials);
    if (!testResult.connected) {
      throw new BadRequestException(`Connection test failed: ${testResult.error}`);
    }

    const encryptedCredentials = this.secretManager.encrypt(credentials);

    return this.prisma.integration.upsert({
      where: { orgId_provider: { orgId, provider } },
      create: {
        orgId,
        provider,
        status: 'connected',
        credentials: encryptedCredentials as any,
        settings: (settings ?? {}) as any,
        lastSyncedAt: new Date(),
      },
      update: {
        status: 'connected',
        credentials: encryptedCredentials as any,
        settings: (settings ?? {}) as any,
        lastSyncedAt: new Date(),
      },
      select: { id: true, provider: true, status: true, lastSyncedAt: true },
    });
  }

  async testConnection(orgId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, orgId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const adapter = this.adapterMap[integration.provider];
    if (!adapter) throw new BadRequestException(`Adapter not found for ${integration.provider}`);

    const credentials = this.secretManager.safeDecrypt(integration.credentials);
    return adapter.testConnection(credentials);
  }

  async sync(orgId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, orgId, status: 'connected' },
    });
    if (!integration) throw new NotFoundException('Active integration not found');

    const adapter = this.adapterMap[integration.provider];
    if (!adapter) throw new BadRequestException(`Adapter not found for ${integration.provider}`);

    try {
      const credentials = this.secretManager.safeDecrypt(integration.credentials);
      const evidence = await adapter.collectEvidence(credentials);

      for (const item of evidence) {
        // Find matching control
        const control = await this.prisma.control.findFirst({
          where: { code: item.controlCode },
        });

        if (control) {
          const orgControl = await this.prisma.organizationControl.findUnique({
            where: { orgId_controlId: { orgId, controlId: control.id } },
          });

          if (orgControl) {
            await this.prisma.evidence.create({
              data: {
                orgId,
                controlId: control.id,
                title: item.title,
                type: 'api_response',
                source: 'integration',
                metadata: { ...item.data, provider: integration.provider },
                collectedAt: item.collectedAt,
                isValid: true,
              },
            });
          }
        }
      }

      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncedAt: new Date(), status: 'connected' },
      });

      this.logger.log(`Sync complete: ${integration.provider} | ${evidence.length} evidence items for org: ${orgId}`);
      return { synced: evidence.length };
    } catch (err: any) {
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { status: 'error' },
      });
      throw err;
    }
  }

  async disconnect(orgId: string, integrationId: string) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, orgId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: 'disconnected', credentials: {} },
    });
  }
}
