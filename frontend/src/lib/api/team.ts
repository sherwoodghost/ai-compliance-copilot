import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlatformRole = 'owner' | 'admin' | 'contributor' | 'approver' | 'viewer' | 'auditor_external';
export type UserStatus = 'active' | 'suspended' | 'offboarding' | 'deactivated';
export type ComplianceRole =
  | 'SECURITY_LEAD' | 'COMPLIANCE_LEAD' | 'DPO' | 'IT_ADMIN'
  | 'ENGINEERING_LEAD' | 'HR_LEAD' | 'LEGAL' | 'RISK_OWNER'
  | 'CONTROL_OWNER' | 'EVIDENCE_REVIEWER' | 'INCIDENT_RESPONDER' | 'VENDOR_MANAGER';

export type RaciLetter = 'R' | 'A' | 'C' | 'I';

export interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  platformRole: PlatformRole;
  status: UserStatus;
  responsibilities: { role: ComplianceRole; isPrimary: boolean }[];
  manager?: { id: string; fullName: string } | null;
  ndaSignedAt?: string | null;
  aupSignedAt?: string | null;
  lastAccessReviewAt?: string | null;
  createdAt: string;
  stats?: {
    controlsAssigned: number;
    raciAccountable: number;
    tasksCompleted: number;
    evidenceUploaded: number;
    trainingComplete: number;
    sodConflicts: number;
  };
}

export interface InviteMemberDto {
  email: string;
  fullName: string;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  platformRole: PlatformRole;
  employmentType?: 'full_time' | 'part_time' | 'contractor' | 'vendor';
  startDate?: string;
  responsibilities?: ComplianceRole[];
  requireNda?: boolean;
  requireAup?: boolean;
  requireTraining?: boolean;
  requireBackgroundCheck?: boolean;
}

export interface UpdateMemberDto {
  platformRole?: PlatformRole;
  jobTitle?: string;
  department?: string;
  managerId?: string;
  responsibilities?: ComplianceRole[];
}

export interface RaciMatrixRow {
  controlId: string;
  controlCode: string;
  controlTitle: string;
  assignments: { userId: string; raci: RaciLetter }[];
}

export interface SodConflict {
  controlId: string;
  controlCode: string;
  controlTitle: string;
  userId: string;
  userFullName: string;
  userEmail: string;
  roles: RaciLetter[];
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actor?: { fullName: string; email: string };
  action: string;
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  createdAt: string;
}

export interface GuidedTask {
  id: string;
  title: string;
  description?: string;
  kind: string;
  status: string;
  priority: string;
  isGuided: boolean;
  guidance?: {
    why: string;
    evidenceHint: string;
    fileFormat?: string;
    stepByStep: string[];
    exampleDescription?: string;
    estimatedMinutes?: number;
    controlCategory?: string;
  };
  dependsOn: string[];
  approvalRequired: boolean;
  approverId?: string | null;
  approvedAt?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number;
  recurrence?: { frequency: string; nextDueAt?: string } | null;
  control?: { id: string; code: string; title: string; category: string } | null;
  assignee?: { id: string; fullName: string; email: string } | null;
  approver?: { id: string; fullName: string; email: string } | null;
  blockedBy?: { id: string; title: string }[];
}

export interface GuidedProgram {
  stats: {
    total: number;
    done: number;
    inProgress: number;
    blocked: number;
    percentComplete: number;
  };
  thisWeek: GuidedTask[];
  readyNow: GuidedTask[];
  blocked: GuidedTask[];
  recurring: GuidedTask[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const teamApi = {
  // Members
  getMembers: (): Promise<TeamMember[]> =>
    apiClient.get('/team/members').then((r) => r.data),

  inviteMember: (dto: InviteMemberDto): Promise<TeamMember> =>
    apiClient.post('/team/members/invite', dto).then((r) => r.data),

  updateMember: (userId: string, dto: UpdateMemberDto): Promise<TeamMember> =>
    apiClient.patch(`/team/members/${userId}`, dto).then((r) => r.data),

  offboardMember: (userId: string, offboardDate: string): Promise<void> =>
    apiClient.post(`/team/members/${userId}/offboard`, { offboardDate }).then((r) => r.data),

  // RACI
  getRaci: (): Promise<RaciMatrixRow[]> =>
    apiClient.get('/team/raci').then((r) => r.data),

  assignRaci: (controlId: string, userId: string, raci: RaciLetter): Promise<void> =>
    apiClient.post('/team/raci/assign', { controlId, userId, raci }).then((r) => r.data),

  removeRaci: (controlId: string, userId: string, raci: RaciLetter): Promise<void> =>
    apiClient.post('/team/raci/remove', { controlId, userId, raci }).then((r) => r.data),

  autoFillRaci: (): Promise<{ assigned: number }> =>
    apiClient.post('/team/raci/auto-fill').then((r) => r.data),

  getSodConflicts: (): Promise<SodConflict[]> =>
    apiClient.get('/team/sod-conflicts').then((r) => r.data),

  // Audit log
  getAuditLog: (limit = 50): Promise<AuditLogEntry[]> =>
    apiClient.get('/team/audit-log', { params: { limit } }).then((r) => r.data),

  // Guided program
  getGuidedProgram: (mine?: boolean): Promise<GuidedProgram> =>
    apiClient.get('/tasks/guided-program', { params: mine ? { mine: 'true' } : {} }).then((r) => r.data),

  generateGuidedProgram: (): Promise<{ created: number; skipped: number }> =>
    apiClient.post('/tasks/generate-guided-program').then((r) => r.data),
};
