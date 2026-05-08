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

  resendInvite: (userId: string): Promise<{ message: string }> =>
    apiClient.post(`/team/members/${userId}/resend-invite`).then((r) => r.data),

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

  // Training
  getTrainingStats: (): Promise<any> =>
    apiClient.get('/training/stats').then((r) => r.data),

  assignSecurityAwarenessToAll: (): Promise<{ assigned: number; skipped: number; total: number }> =>
    apiClient.post('/training/assign-all-security-awareness').then((r) => r.data),

  getMyTraining: (): Promise<any[]> =>
    apiClient.get('/training/assignments/mine').then((r) => r.data),

  completeTraining: (assignmentId: string, score?: number): Promise<any> =>
    apiClient.post(`/training/assignments/${assignmentId}/complete`, { score }).then((r) => r.data),

  // Access reviews
  getAccessReviews: (): Promise<any[]> =>
    apiClient.get('/access-reviews').then((r) => r.data),

  generateAccessReviews: (): Promise<{ created: number }> =>
    apiClient.post('/access-reviews/generate').then((r) => r.data),

  signOffAccessReview: (reviewId: string, decisions: { itemId: string; decision: string; reason?: string }[]): Promise<any> =>
    apiClient.post(`/access-reviews/${reviewId}/sign-off`, { decisions }).then((r) => r.data),

  // Management reviews (ISO Clause 9.3)
  getManagementReviews: (): Promise<any[]> =>
    apiClient.get('/management-reviews').then((r) => r.data),

  scheduleManagementReview: (dto: { scheduledAt: string; attendees: string[] }): Promise<any> =>
    apiClient.post('/management-reviews/schedule', dto).then((r) => r.data),

  updateManagementReview: (reviewId: string, dto: { minutes?: string; actions?: any[]; completedAt?: string }): Promise<any> =>
    apiClient.patch(`/management-reviews/${reviewId}`, dto).then((r) => r.data),

  signOffManagementReview: (reviewId: string): Promise<any> =>
    apiClient.post(`/management-reviews/${reviewId}/sign-off`).then((r) => r.data),

  // Control effectiveness sampling (ISO A.5.35)
  getControlEffectivenessSummary: (): Promise<any> =>
    apiClient.get('/control-effectiveness/summary').then((r) => r.data),

  getControlEffectivenessSamples: (controlId?: string): Promise<any[]> =>
    apiClient.get('/control-effectiveness/samples', { params: controlId ? { controlId } : {} }).then((r) => r.data),

  sampleControl: (controlId: string, notes?: string): Promise<any> =>
    apiClient.post(`/control-effectiveness/sample/${controlId}`, { notes }).then((r) => r.data),

  runBatchSample: (): Promise<{ sampled: number; results: any[]; evidenceId: string | null }> =>
    apiClient.post('/control-effectiveness/batch-sample').then((r) => r.data),

  // ─── Incidents (ISO A.5.24–A.5.27) ──────────────────────────────────────────

  listIncidents: (filters?: { status?: string; severity?: string; category?: string }): Promise<any> =>
    apiClient.get('/incidents', { params: filters }).then((r) => r.data),

  getIncident: (id: string): Promise<any> =>
    apiClient.get(`/incidents/${id}`).then((r) => r.data),

  getIncidentMetrics: (): Promise<any> =>
    apiClient.get('/incidents/metrics').then((r) => r.data),

  createIncident: (dto: {
    title: string;
    description: string;
    severity: string;
    category: string;
    detectedAt?: string;
    affectedSystems?: string[];
    impactedUsers?: number;
    dataClassification?: string;
    assignedTo?: string;
  }): Promise<any> =>
    apiClient.post('/incidents', dto).then((r) => r.data),

  updateIncidentStatus: (id: string, status: string, note?: string): Promise<any> =>
    apiClient.post(`/incidents/${id}/status`, { status, note }).then((r) => r.data),

  closeIncident: (id: string, dto: { rootCause: string; lessonsLearned: string }): Promise<any> =>
    apiClient.post(`/incidents/${id}/close`, dto).then((r) => r.data),

  addCorrectiveAction: (incidentId: string, dto: {
    title: string;
    description: string;
    assignedTo: string;
    dueDate: string;
  }): Promise<any> =>
    apiClient.post(`/incidents/${incidentId}/corrective-actions`, dto).then((r) => r.data),

  closeCorrectiveAction: (incidentId: string, actionId: string): Promise<any> =>
    apiClient.post(`/incidents/${incidentId}/corrective-actions/${actionId}/close`).then((r) => r.data),

  // ─── Internal Audit (ISO Clause 9.2) ─────────────────────────────────────────

  listInternalAudits: (): Promise<any[]> =>
    apiClient.get('/internal-audit').then((r) => r.data),

  getInternalAudit: (id: string): Promise<any> =>
    apiClient.get(`/internal-audit/${id}`).then((r) => r.data),

  createInternalAudit: (dto: {
    title: string;
    auditYear: number;
    scope: string[];
    auditorId: string;
    plannedStartAt: string;
    plannedEndAt: string;
  }): Promise<any> =>
    apiClient.post('/internal-audit', dto).then((r) => r.data),

  startAuditFieldwork: (id: string): Promise<any> =>
    apiClient.post(`/internal-audit/${id}/start-fieldwork`).then((r) => r.data),

  startAuditReporting: (id: string): Promise<any> =>
    apiClient.post(`/internal-audit/${id}/start-reporting`).then((r) => r.data),

  closeInternalAudit: (id: string, dto?: { summary?: string }): Promise<any> =>
    apiClient.post(`/internal-audit/${id}/close`, dto ?? {}).then((r) => r.data),

  addAuditFinding: (auditId: string, dto: {
    controlCode?: string;
    title: string;
    description: string;
    severity: string;
  }): Promise<any> =>
    apiClient.post(`/internal-audit/${auditId}/findings`, dto).then((r) => r.data),

  closeAuditFinding: (auditId: string, findingId: string): Promise<any> =>
    apiClient.post(`/internal-audit/${auditId}/findings/${findingId}/close`).then((r) => r.data),

  acceptRiskFinding: (auditId: string, findingId: string): Promise<any> =>
    apiClient.post(`/internal-audit/${auditId}/findings/${findingId}/accept-risk`).then((r) => r.data),
};
