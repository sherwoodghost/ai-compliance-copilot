import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
// Existing full adapters
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
// Stub adapters for all new providers
import {
  OneLoginAdapter, Auth0Adapter, DuoAdapter, JumpCloudAdapter, PingIdentityAdapter,
  CyberArkAdapter, DelineaAdapter, BeyondTrustAdapter,
  DigitalOceanAdapter, CloudflareAdapter, VercelAdapter, HerokuAdapter,
  AzureDevOpsAdapter, BitbucketAdapter, CircleCIAdapter, JenkinsAdapter,
  CodecovAdapter, SonarQubeAdapter, SemgrepAdapter,
  CrowdStrikeAdapter, SentinelOneAdapter, CarbonBlackAdapter, Rapid7Adapter,
  QualysAdapter, TenableAdapter, WizAdapter, LaceworkAdapter,
  AquaSecurityAdapter, VeracodeAdapter, BugcrowdAdapter, HackerOneAdapter,
  KandjiAdapter, MosyleAdapter, FleetAdapter, HexnodeAdapter, VMwareWorkspaceOneAdapter,
  WorkdayAdapter, AdpAdapter, GustoAdapter, HiBobAdapter, PersonioAdapter, DeelAdapter,
  ServiceNowAdapter, ZendeskAdapter, FreshserviceAdapter, LinearAdapter,
  AsanaAdapter, MondayAdapter, ClickUpAdapter, NotionAdapter, ConfluenceAdapter,
  NewRelicAdapter, GrafanaAdapter, SentryAdapter, DynatraceAdapter, SumoLogicAdapter,
  SplunkAdapter, ElasticAdapter, OpsgenieAdapter, VictorOpsAdapter,
  FireHydrantAdapter, StatuspageAdapter,
  SlackAdapter, MicrosoftTeamsAdapter, ZoomAdapter, MattermostAdapter,
  OnePasswordAdapter, LastPassAdapter, BitwardenAdapter, HashiCorpVaultAdapter, DopplerAdapter,
  KnowBe4Adapter, ProofpointAdapter, InfosecIqAdapter,
  CheckrAdapter, SterlingAdapter,
  SalesforceAdapter, HubSpotAdapter,
  BoxAdapter, DropboxAdapter, SharepointAdapter, GoogleDriveAdapter,
  SnowflakeAdapter, MongoDBAtlasAdapter, DatabricksAdapter,
} from './adapters/stub-adapters';
// OAuth controllers
import { GithubOauthController } from './oauth/github-oauth.controller';
import { UnifiedOAuthController } from './oauth/unified-oauth.controller';
import { IntegrationsCoreModule } from '../../integrations/integrations-core.module';
import { DatabaseModule } from '../../database/database.module';
import { LlmModule } from '../../llm/llm.module';

const STUB_ADAPTERS = [
  OneLoginAdapter, Auth0Adapter, DuoAdapter, JumpCloudAdapter, PingIdentityAdapter,
  CyberArkAdapter, DelineaAdapter, BeyondTrustAdapter,
  DigitalOceanAdapter, CloudflareAdapter, VercelAdapter, HerokuAdapter,
  AzureDevOpsAdapter, BitbucketAdapter, CircleCIAdapter, JenkinsAdapter,
  CodecovAdapter, SonarQubeAdapter, SemgrepAdapter,
  CrowdStrikeAdapter, SentinelOneAdapter, CarbonBlackAdapter, Rapid7Adapter,
  QualysAdapter, TenableAdapter, WizAdapter, LaceworkAdapter,
  AquaSecurityAdapter, VeracodeAdapter, BugcrowdAdapter, HackerOneAdapter,
  KandjiAdapter, MosyleAdapter, FleetAdapter, HexnodeAdapter, VMwareWorkspaceOneAdapter,
  WorkdayAdapter, AdpAdapter, GustoAdapter, HiBobAdapter, PersonioAdapter, DeelAdapter,
  ServiceNowAdapter, ZendeskAdapter, FreshserviceAdapter, LinearAdapter,
  AsanaAdapter, MondayAdapter, ClickUpAdapter, NotionAdapter, ConfluenceAdapter,
  NewRelicAdapter, GrafanaAdapter, SentryAdapter, DynatraceAdapter, SumoLogicAdapter,
  SplunkAdapter, ElasticAdapter, OpsgenieAdapter, VictorOpsAdapter,
  FireHydrantAdapter, StatuspageAdapter,
  SlackAdapter, MicrosoftTeamsAdapter, ZoomAdapter, MattermostAdapter,
  OnePasswordAdapter, LastPassAdapter, BitwardenAdapter, HashiCorpVaultAdapter, DopplerAdapter,
  KnowBe4Adapter, ProofpointAdapter, InfosecIqAdapter,
  CheckrAdapter, SterlingAdapter,
  SalesforceAdapter, HubSpotAdapter,
  BoxAdapter, DropboxAdapter, SharepointAdapter, GoogleDriveAdapter,
  SnowflakeAdapter, MongoDBAtlasAdapter, DatabricksAdapter,
];

@Module({
  imports: [IntegrationsCoreModule, DatabaseModule, LlmModule],
  providers: [
    IntegrationsService,
    // Core adapters
    GitHubAdapter, AwsAdapter, OktaAdapter,
    JiraAdapter, DatadogAdapter, GoogleWorkspaceAdapter, GitLabAdapter,
    GcpAdapter, RipplingAdapter, JamfAdapter, AzureAdAdapter,
    // All stub adapters
    ...STUB_ADAPTERS,
  ],
  controllers: [IntegrationsController, GithubOauthController, UnifiedOAuthController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
