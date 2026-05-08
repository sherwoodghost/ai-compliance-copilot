import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GitHubAdapter } from './adapters/github.adapter';
import { AwsAdapter } from './adapters/aws.adapter';
import { OktaAdapter } from './adapters/okta.adapter';
import { JiraAdapter } from './adapters/jira.adapter';
import { DatadogAdapter } from './adapters/datadog.adapter';
import { GoogleWorkspaceAdapter } from './adapters/google-workspace.adapter';
import { GitLabAdapter } from './adapters/gitlab.adapter';
import { GcpAdapter } from './adapters/gcp.adapter';
import { RipplingAdapter } from './adapters/rippling.adapter';
import { JamfAdapter } from './adapters/jamf.adapter';
import { AzureAdAdapter } from './adapters/azure-ad.adapter';
import { GithubOauthController } from './oauth/github-oauth.controller';
import { IntegrationsCoreModule } from '../../integrations/integrations-core.module';
import { DatabaseModule } from '../../database/database.module';
import { LlmModule } from '../../llm/llm.module';

@Module({
  imports: [IntegrationsCoreModule, DatabaseModule, LlmModule],
  providers: [
    IntegrationsService,
    GitHubAdapter, AwsAdapter, OktaAdapter,
    JiraAdapter, DatadogAdapter, GoogleWorkspaceAdapter, GitLabAdapter,
    GcpAdapter, RipplingAdapter, JamfAdapter, AzureAdAdapter,
  ],
  controllers: [IntegrationsController, GithubOauthController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
