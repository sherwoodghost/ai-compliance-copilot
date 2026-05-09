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
import { ExceptionsModule } from './modules/exceptions/exceptions.module'; // registered early for route priority
import { AuditorPortalModule } from './modules/auditor-portal/auditor-portal.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { AuditMemoryModule } from './modules/audit-memory/audit-memory.module';
import { AgentSchedulerModule } from './scheduler/scheduler.module';
import { PermissionsModule } from './common/permissions/permissions.module';
import { TeamModule } from './modules/team/team.module';
import { AccessReviewModule } from './modules/access-reviews/access-review.module';
import { TrainingModule } from './modules/training/training.module';
import { ManagementReviewModule } from './modules/management-reviews/management-review.module';
import { ControlEffectivenessModule } from './modules/control-effectiveness/control-effectiveness.module';
import { IncidentModule } from './modules/incidents/incident.module';
import { InternalAuditModule } from './modules/internal-audit/internal-audit.module';
// P19 — Documents + Enterprise Infrastructure
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DocumentsModule } from './modules/documents/documents.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { StorageModule } from './modules/storage/storage.module';
import { ConnectorsModule } from './modules/connectors/connectors.module';
import { ApprovalWorkflowModule } from './modules/approval-workflow/approval-workflow.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    PermissionsModule,
    TeamModule,
    AccessReviewModule,
    TrainingModule,
    ManagementReviewModule,
    ControlEffectivenessModule,
    IncidentModule,
    InternalAuditModule,
    LlmModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    FrameworksModule,
    ControlLibraryApiModule,  // ← must register before ControlsModule (controls/library prefix is more specific)
    ExceptionsModule,   // ← must register before ControlsModule to take /controls/exceptions routes
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
    AuditorPortalModule,
    CopilotModule,
    AuditMemoryModule,
    AgentSchedulerModule,
    // P19 — Documents + Enterprise Infrastructure
    BullModule.forRoot({
      redis: {
        host: process.env['REDIS_HOST'] ?? 'localhost',
        port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
        password: process.env['REDIS_PASSWORD'] ?? undefined,
      },
    }),
    EventEmitterModule.forRoot({ wildcard: false, delimiter: '.', global: true }),
    DocumentsModule,
    FeatureFlagsModule,
    StorageModule,
    ConnectorsModule,
    ApprovalWorkflowModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
