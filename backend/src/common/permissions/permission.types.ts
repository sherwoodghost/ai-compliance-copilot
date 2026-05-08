/**
 * All permissions in the system.
 * Format: resource.action
 */
export type Permission =
  // Policies
  | 'policy.read'
  | 'policy.create'
  | 'policy.edit'
  | 'policy.approve'
  | 'policy.archive'
  | 'policy.from_template'
  // Evidence
  | 'evidence.read'
  | 'evidence.upload'
  | 'evidence.validate'
  | 'evidence.delete'
  | 'evidence.map_controls'
  // Controls
  | 'control.read'
  | 'control.update'
  | 'control.assign'
  | 'control.raci'
  // Risks
  | 'risk.read'
  | 'risk.create'
  | 'risk.update'
  | 'risk.accept'
  // Tasks
  | 'task.read'
  | 'task.create'
  | 'task.complete'
  | 'task.assign'
  // Audit
  | 'audit.export'
  | 'audit.read'
  | 'audit.exception.create'
  | 'audit.exception.approve'
  // Team management
  | 'team.invite'
  | 'team.manage'
  | 'team.roles.change'
  | 'team.offboard'
  | 'team.audit_log.read'
  // RACI
  | 'raci.assign'
  // Access reviews
  | 'access_review.conduct'
  | 'access_review.sign'
  | 'access_review.generate'
  // Training
  | 'training.assign'
  | 'training.complete'
  // Org settings
  | 'org.settings'
  | 'org.reset'
  | 'org.integrations';

/**
 * Platform role → permissions baseline.
 * More specific grants (RACI, responsibility) layer on top.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  owner: [
    'policy.read', 'policy.create', 'policy.edit', 'policy.approve', 'policy.archive', 'policy.from_template',
    'evidence.read', 'evidence.upload', 'evidence.validate', 'evidence.delete', 'evidence.map_controls',
    'control.read', 'control.update', 'control.assign', 'control.raci',
    'risk.read', 'risk.create', 'risk.update', 'risk.accept',
    'task.read', 'task.create', 'task.complete', 'task.assign',
    'audit.export', 'audit.read', 'audit.exception.create', 'audit.exception.approve',
    'team.invite', 'team.manage', 'team.roles.change', 'team.offboard', 'team.audit_log.read',
    'raci.assign',
    'access_review.conduct', 'access_review.sign', 'access_review.generate',
    'training.assign', 'training.complete',
    'org.settings', 'org.reset', 'org.integrations',
  ],
  admin: [
    'policy.read', 'policy.create', 'policy.edit', 'policy.approve', 'policy.archive', 'policy.from_template',
    'evidence.read', 'evidence.upload', 'evidence.validate', 'evidence.delete', 'evidence.map_controls',
    'control.read', 'control.update', 'control.assign', 'control.raci',
    'risk.read', 'risk.create', 'risk.update', 'risk.accept',
    'task.read', 'task.create', 'task.complete', 'task.assign',
    'audit.export', 'audit.read', 'audit.exception.create', 'audit.exception.approve',
    'team.invite', 'team.manage', 'team.audit_log.read',
    'raci.assign',
    'access_review.conduct', 'access_review.sign', 'access_review.generate',
    'training.assign', 'training.complete',
    'org.settings', 'org.integrations',
  ],
  contributor: [
    'policy.read', 'policy.create', 'policy.edit',
    'evidence.read', 'evidence.upload', 'evidence.map_controls',
    'control.read',
    'risk.read', 'risk.create',
    'task.read', 'task.complete',
    'audit.read',
    'training.complete',
  ],
  approver: [
    'policy.read', 'policy.create', 'policy.edit', 'policy.approve', 'policy.archive',
    'evidence.read', 'evidence.upload', 'evidence.validate', 'evidence.map_controls',
    'control.read',
    'risk.read',
    'task.read', 'task.complete',
    'audit.read', 'audit.exception.create', 'audit.exception.approve',
    'access_review.conduct', 'access_review.sign',
    'training.complete',
  ],
  viewer: [
    'policy.read',
    'evidence.read',
    'control.read',
    'risk.read',
    'task.read',
    'audit.read',
  ],
  auditor_external: [
    'policy.read',
    'evidence.read',
    'audit.read', 'audit.export',
  ],
};
