import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { FrameworksModule } from './modules/frameworks/frameworks.module';
import { ControlsModule } from './modules/controls/controls.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { AgentsModule } from './agents/agents.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { ControlPanelModule } from './modules/control-panel/control-panel.module';
import { RisksModule } from './modules/risks/risks.module';
import { VendorRiskModule } from './modules/vendor-risk/vendor-risk.module';
import { ComplianceJourneyModule } from './compliance-journey/compliance-journey.module';
import { GatewaysModule } from './gateways/gateways.module';
import { LlmModule } from './llm/llm.module';
import { ControlLibraryModule } from './control-library/control-library.module';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';
import { ReadinessModule } from './readiness/readiness.module';
import { ScopingModule } from './scoping/scoping.module';
import { AuditExportModule } from './audit-exports/audit-export.module';
import { ControlLibraryApiModule } from './modules/control-library/control-library-api.module';
import { ScopingApiModule } from './modules/scoping/scoping-api.module';
import { ReadinessApiModule } from './modules/readiness/readiness-api.module';
import { AuditExportsApiModule } from './modules/audit-exports/audit-exports-api.module';
import { LlmGatewayApiModule } from './modules/llm-gateway/llm-gateway-api.module';
import { DashboardApiModule } from './modules/dashboard/dashboard.module';
import { InferenceModule } from './inference/inference.module';
import { AgentMemoryModule } from './agent-memory/agent-memory.module';
import { IntegrationsCoreModule } from './integrations/integrations-core.module';
import { ControlTestsModule } from './control-tests/control-tests.module';
import { ControlTestsApiModule } from './modules/control-tests/control-tests-api.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TrustCenterModule } from './modules/trust-center/trust-center.module';
import { InternalModule } from './internal/internal.module';
import { ExceptionsModule } from './modules/exceptions/exceptions.module';
import { AuditorPortalModule } from './modules/auditor-portal/auditor-portal.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { AuditMemoryModule } from './modules/audit-memory/audit-memory.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    LlmModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    FrameworksModule,
    ControlsModule,
    EvidenceModule,
    PoliciesModule,
    WorkflowsModule,
    TasksModule,
    IntegrationsModule,
    OnboardingModule,
    AgentsModule,
    OrchestratorModule,
    ControlPanelModule,
    RisksModule,
    VendorRiskModule,
    ComplianceJourneyModule,
    GatewaysModule,
    ControlLibraryModule,
    LlmGatewayModule,
    ReadinessModule,
    ScopingModule,
    AuditExportModule,
    ControlLibraryApiModule,
    ScopingApiModule,
    ReadinessApiModule,
    AuditExportsApiModule,
    LlmGatewayApiModule,
    DashboardApiModule,
    InferenceModule,
    AgentMemoryModule,
    IntegrationsCoreModule,
    ControlTestsModule,
    ControlTestsApiModule,
    MonitoringModule,
    NotificationsModule,
    TrustCenterModule,
    InternalModule,
    ExceptionsModule,
    AuditorPortalModule,
    CopilotModule,
    AuditMemoryModule,
  ],
})
export class AppModule {}
