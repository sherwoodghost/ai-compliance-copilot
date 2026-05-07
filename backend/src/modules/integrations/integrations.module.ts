import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GitHubAdapter } from './adapters/github.adapter';
import { AwsAdapter } from './adapters/aws.adapter';
import { OktaAdapter } from './adapters/okta.adapter';
import { JiraAdapter } from './adapters/jira.adapter';
import { DatadogAdapter } from './adapters/datadog.adapter';
import { GoogleWorkspaceAdapter } from './adapters/google-workspace.adapter';
import { GithubOauthController } from './oauth/github-oauth.controller';
import { IntegrationsCoreModule } from '../../integrations/integrations-core.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [IntegrationsCoreModule, DatabaseModule],
  providers: [
    IntegrationsService,
    GitHubAdapter, AwsAdapter, OktaAdapter,
    JiraAdapter, DatadogAdapter, GoogleWorkspaceAdapter,
  ],
  controllers: [IntegrationsController, GithubOauthController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
