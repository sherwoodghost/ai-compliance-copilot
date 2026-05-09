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
import { GitLabAdapter } from './adapters/gitlab.adapter';
import { GcpAdapter } from './adapters/gcp.adapter';
import { RipplingAdapter } from './adapters/rippling.adapter';
import { JamfAdapter } from './adapters/jamf.adapter';
import { AzureAdAdapter } from './adapters/azure-ad.adapter';
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
import { IntegrationAdapter } from './adapters/integration.interface';
import { IntegrationProvider } from '@prisma/client';
import { SecretManagerService } from '../../integrations/secret-manager.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly adapterMap: Record<string, IntegrationAdapter>;

  constructor(
    private readonly prisma: PrismaService,
    // Core adapters
    private readonly githubAdapter: GitHubAdapter,
    private readonly awsAdapter: AwsAdapter,
    private readonly oktaAdapter: OktaAdapter,
    private readonly jiraAdapter: JiraAdapter,
    private readonly datadogAdapter: DatadogAdapter,
    private readonly googleWorkspaceAdapter: GoogleWorkspaceAdapter,
    private readonly gitlabAdapter: GitLabAdapter,
    private readonly gcpAdapter: GcpAdapter,
    private readonly ripplingAdapter: RipplingAdapter,
    private readonly jamfAdapter: JamfAdapter,
    private readonly azureAdAdapter: AzureAdAdapter,
    // Identity
    private readonly oneLoginAdapter: OneLoginAdapter,
    private readonly auth0Adapter: Auth0Adapter,
    private readonly duoAdapter: DuoAdapter,
    private readonly jumpCloudAdapter: JumpCloudAdapter,
    private readonly pingIdentityAdapter: PingIdentityAdapter,
    private readonly cyberArkAdapter: CyberArkAdapter,
    private readonly delineaAdapter: DelineaAdapter,
    private readonly beyondTrustAdapter: BeyondTrustAdapter,
    // Cloud
    private readonly digitalOceanAdapter: DigitalOceanAdapter,
    private readonly cloudflareAdapter: CloudflareAdapter,
    private readonly vercelAdapter: VercelAdapter,
    private readonly herokuAdapter: HerokuAdapter,
    // CI/CD
    private readonly azureDevOpsAdapter: AzureDevOpsAdapter,
    private readonly bitbucketAdapter: BitbucketAdapter,
    private readonly circleCIAdapter: CircleCIAdapter,
    private readonly jenkinsAdapter: JenkinsAdapter,
    private readonly codecovAdapter: CodecovAdapter,
    private readonly sonarQubeAdapter: SonarQubeAdapter,
    private readonly semgrepAdapter: SemgrepAdapter,
    // Security
    private readonly crowdStrikeAdapter: CrowdStrikeAdapter,
    private readonly sentinelOneAdapter: SentinelOneAdapter,
    private readonly carbonBlackAdapter: CarbonBlackAdapter,
    private readonly rapid7Adapter: Rapid7Adapter,
    private readonly qualysAdapter: QualysAdapter,
    private readonly tenableAdapter: TenableAdapter,
    private readonly wizAdapter: WizAdapter,
    private readonly laceworkAdapter: LaceworkAdapter,
    private readonly aquaSecurityAdapter: AquaSecurityAdapter,
    private readonly veracodeAdapter: VeracodeAdapter,
    private readonly bugcrowdAdapter: BugcrowdAdapter,
    private readonly hackerOneAdapter: HackerOneAdapter,
    // MDM
    private readonly kandjiAdapter: KandjiAdapter,
    private readonly mosyleAdapter: MosyleAdapter,
    private readonly fleetAdapter: FleetAdapter,
    private readonly hexnodeAdapter: HexnodeAdapter,
    private readonly vmwareWorkspaceOneAdapter: VMwareWorkspaceOneAdapter,
    // HR
    private readonly workdayAdapter: WorkdayAdapter,
    private readonly adpAdapter: AdpAdapter,
    private readonly gustoAdapter: GustoAdapter,
    private readonly hiBobAdapter: HiBobAdapter,
    private readonly personioAdapter: PersonioAdapter,
    private readonly deelAdapter: DeelAdapter,
    // Ticketing
    private readonly serviceNowAdapter: ServiceNowAdapter,
    private readonly zendeskAdapter: ZendeskAdapter,
    private readonly freshserviceAdapter: FreshserviceAdapter,
    private readonly linearAdapter: LinearAdapter,
    private readonly asanaAdapter: AsanaAdapter,
    private readonly mondayAdapter: MondayAdapter,
    private readonly clickUpAdapter: ClickUpAdapter,
    private readonly notionAdapter: NotionAdapter,
    private readonly confluenceAdapter: ConfluenceAdapter,
    // Monitoring
    private readonly newRelicAdapter: NewRelicAdapter,
    private readonly grafanaAdapter: GrafanaAdapter,
    private readonly sentryAdapter: SentryAdapter,
    private readonly dynatraceAdapter: DynatraceAdapter,
    private readonly sumoLogicAdapter: SumoLogicAdapter,
    private readonly splunkAdapter: SplunkAdapter,
    private readonly elasticAdapter: ElasticAdapter,
    private readonly opsgenieAdapter: OpsgenieAdapter,
    private readonly victorOpsAdapter: VictorOpsAdapter,
    private readonly fireHydrantAdapter: FireHydrantAdapter,
    private readonly statuspageAdapter: StatuspageAdapter,
    // Collaboration
    private readonly slackAdapter: SlackAdapter,
    private readonly microsoftTeamsAdapter: MicrosoftTeamsAdapter,
    private readonly zoomAdapter: ZoomAdapter,
    private readonly mattermostAdapter: MattermostAdapter,
    // Secrets
    private readonly onePasswordAdapter: OnePasswordAdapter,
    private readonly lastPassAdapter: LastPassAdapter,
    private readonly bitwardenAdapter: BitwardenAdapter,
    private readonly hashiCorpVaultAdapter: HashiCorpVaultAdapter,
    private readonly dopplerAdapter: DopplerAdapter,
    // Training
    private readonly knowBe4Adapter: KnowBe4Adapter,
    private readonly proofpointAdapter: ProofpointAdapter,
    private readonly infosecIqAdapter: InfosecIqAdapter,
    // Background
    private readonly checkrAdapter: CheckrAdapter,
    private readonly sterlingAdapter: SterlingAdapter,
    // CRM
    private readonly salesforceAdapter: SalesforceAdapter,
    private readonly hubSpotAdapter: HubSpotAdapter,
    // Storage
    private readonly boxAdapter: BoxAdapter,
    private readonly dropboxAdapter: DropboxAdapter,
    private readonly sharepointAdapter: SharepointAdapter,
    private readonly googleDriveAdapter: GoogleDriveAdapter,
    // Data
    private readonly snowflakeAdapter: SnowflakeAdapter,
    private readonly mongoDBAtlasAdapter: MongoDBAtlasAdapter,
    private readonly databricksAdapter: DatabricksAdapter,
    private readonly secretManager: SecretManagerService,
  ) {
    this.adapterMap = {
      // Core
      github:           this.githubAdapter,
      aws:              this.awsAdapter,
      okta:             this.oktaAdapter,
      jira:             this.jiraAdapter,
      datadog:          this.datadogAdapter,
      google_workspace: this.googleWorkspaceAdapter,
      gitlab:           this.gitlabAdapter,
      gcp:              this.gcpAdapter,
      rippling:         this.ripplingAdapter,
      jamf:             this.jamfAdapter,
      azure:            this.azureAdAdapter,
      // Identity
      onelogin:         this.oneLoginAdapter,
      auth0:            this.auth0Adapter,
      duo:              this.duoAdapter,
      jumpcloud:        this.jumpCloudAdapter,
      ping_identity:    this.pingIdentityAdapter,
      cyberark:         this.cyberArkAdapter,
      delinea:          this.delineaAdapter,
      beyondtrust:      this.beyondTrustAdapter,
      // Cloud
      digitalocean:     this.digitalOceanAdapter,
      cloudflare:       this.cloudflareAdapter,
      vercel:           this.vercelAdapter,
      heroku:           this.herokuAdapter,
      // CI/CD
      azure_devops:     this.azureDevOpsAdapter,
      bitbucket:        this.bitbucketAdapter,
      circleci:         this.circleCIAdapter,
      jenkins:          this.jenkinsAdapter,
      codecov:          this.codecovAdapter,
      sonarqube:        this.sonarQubeAdapter,
      semgrep:          this.semgrepAdapter,
      // Security
      crowdstrike:      this.crowdStrikeAdapter,
      sentinelone:      this.sentinelOneAdapter,
      carbon_black:     this.carbonBlackAdapter,
      rapid7:           this.rapid7Adapter,
      qualys:           this.qualysAdapter,
      tenable:          this.tenableAdapter,
      wiz:              this.wizAdapter,
      lacework:         this.laceworkAdapter,
      aqua_security:    this.aquaSecurityAdapter,
      veracode:         this.veracodeAdapter,
      bugcrowd:         this.bugcrowdAdapter,
      hackerone:        this.hackerOneAdapter,
      // MDM
      kandji:              this.kandjiAdapter,
      mosyle:              this.mosyleAdapter,
      fleet:               this.fleetAdapter,
      hexnode:             this.hexnodeAdapter,
      vmware_workspace_one: this.vmwareWorkspaceOneAdapter,
      // HR
      workday:          this.workdayAdapter,
      adp:              this.adpAdapter,
      gusto:            this.gustoAdapter,
      hibob:            this.hiBobAdapter,
      personio:         this.personioAdapter,
      deel:             this.deelAdapter,
      // Ticketing
      servicenow:       this.serviceNowAdapter,
      zendesk:          this.zendeskAdapter,
      freshservice:     this.freshserviceAdapter,
      linear:           this.linearAdapter,
      asana:            this.asanaAdapter,
      monday:           this.mondayAdapter,
      clickup:          this.clickUpAdapter,
      notion:           this.notionAdapter,
      confluence:       this.confluenceAdapter,
      // Monitoring
      newrelic:         this.newRelicAdapter,
      grafana:          this.grafanaAdapter,
      sentry:           this.sentryAdapter,
      dynatrace:        this.dynatraceAdapter,
      sumo_logic:       this.sumoLogicAdapter,
      splunk:           this.splunkAdapter,
      elastic:          this.elasticAdapter,
      opsgenie:         this.opsgenieAdapter,
      victorops:        this.victorOpsAdapter,
      firehydrant:      this.fireHydrantAdapter,
      statuspage:       this.statuspageAdapter,
      // Collaboration
      slack:            this.slackAdapter,
      microsoft_teams:  this.microsoftTeamsAdapter,
      zoom:             this.zoomAdapter,
      mattermost:       this.mattermostAdapter,
      // Secrets
      onepassword:      this.onePasswordAdapter,
      lastpass:         this.lastPassAdapter,
      bitwarden:        this.bitwardenAdapter,
      hashicorp_vault:  this.hashiCorpVaultAdapter,
      doppler:          this.dopplerAdapter,
      // Training
      knowbe4:          this.knowBe4Adapter,
      proofpoint:       this.proofpointAdapter,
      infosec_iq:       this.infosecIqAdapter,
      // Background
      checkr:           this.checkrAdapter,
      sterling:         this.sterlingAdapter,
      // CRM
      salesforce:       this.salesforceAdapter,
      hubspot:          this.hubSpotAdapter,
      // Storage
      box:              this.boxAdapter,
      dropbox:          this.dropboxAdapter,
      sharepoint:       this.sharepointAdapter,
      google_drive:     this.googleDriveAdapter,
      // Data
      snowflake:        this.snowflakeAdapter,
      mongodb_atlas:    this.mongoDBAtlasAdapter,
      databricks:       this.databricksAdapter,
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
