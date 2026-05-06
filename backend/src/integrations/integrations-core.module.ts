import { Module } from '@nestjs/common';
import { SecretManagerService } from './secret-manager.service';
import { IntegrationSuggestionsService } from './integration-suggestions.service';
import { DatabaseModule } from '../database/database.module';

/**
 * IntegrationsCoreModule
 *
 * Core integration infrastructure:
 * - SecretManagerService   — AES-256-GCM credential encryption
 * - IntegrationSuggestionsService — deterministic suggestions from inference
 *
 * Separate from the HTTP-layer IntegrationsModule so these services can be
 * imported by agents without pulling in controllers.
 */
@Module({
  imports: [DatabaseModule],
  providers: [SecretManagerService, IntegrationSuggestionsService],
  exports: [SecretManagerService, IntegrationSuggestionsService],
})
export class IntegrationsCoreModule {}
