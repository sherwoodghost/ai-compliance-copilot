import { Global, Module } from '@nestjs/common';
import { PermissionService } from './permission.service';

/**
 * Global module — PermissionService is available in every module
 * without explicit imports. PermissionGuard is instantiated per-use
 * (inject PermissionService + Reflector in its constructor).
 */
@Global()
@Module({
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionsModule {}
