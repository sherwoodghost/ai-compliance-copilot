import { Injectable, Logger } from '@nestjs/common';
import { IntegrationAdapter, IntegrationEvidence, IntegrationTestResult } from './integration.interface';

/**
 * GoogleWorkspaceAdapter
 *
 * Connects to Google Workspace Admin SDK via a service account with
 * domain-wide delegation, OR via an admin user's OAuth token.
 *
 * For simplicity we accept an admin email + service account key JSON,
 * OR a Google OAuth access token.
 *
 * Evidence collected:
 * - CC6.1 Logical Access: MFA enrollment status (2-step verification)
 * - CC6.2 User Provisioning: active/suspended user list
 * - CC6.3 Access Management: admin role assignments
 */
@Injectable()
export class GoogleWorkspaceAdapter implements IntegrationAdapter {
  readonly provider = 'google_workspace';
  private readonly logger = new Logger(GoogleWorkspaceAdapter.name);

  async testConnection(credentials: Record<string, unknown>): Promise<IntegrationTestResult> {
    const token = credentials['accessToken'] as string;
    if (!token) {
      return { connected: false, error: 'Missing accessToken' };
    }

    try {
      const res = await fetch(
        'https://admin.googleapis.com/admin/directory/v1/users?domain=me&maxResults=1',
        {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        },
      );

      if (res.status === 401) return { connected: false, error: 'Invalid or expired access token' };
      if (res.status === 403) return { connected: false, error: 'Insufficient permissions — ensure Admin SDK is enabled and user has super admin role' };
      if (!res.ok) return { connected: false, error: `Google API returned HTTP ${res.status}` };

      const data = await res.json() as any;
      return {
        connected: true,
        details: { userCount: data.users?.length ?? 0 },
      };
    } catch (err: any) {
      return { connected: false, error: err.message };
    }
  }

  async collectEvidence(credentials: Record<string, unknown>): Promise<IntegrationEvidence[]> {
    const token = credentials['accessToken'] as string;
    const domain = credentials['domain'] as string ?? 'my_customer';
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
    const evidence: IntegrationEvidence[] = [];
    const customerId = credentials['customerId'] as string ?? 'my_customer';

    try {
      // ── CC6.2: User list (provisioning evidence) ────────────────────────────
      const usersRes = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/users?customer=${customerId}&maxResults=100&orderBy=email&projection=basic`,
        { headers },
      );

      if (usersRes.ok) {
        const usersData = await usersRes.json() as any;
        const users = usersData.users ?? [];
        const activeUsers = users.filter((u: any) => !u.suspended);
        const suspendedUsers = users.filter((u: any) => u.suspended);
        const mfaEnrolled = users.filter((u: any) => u.isEnrolledIn2Sv);

        evidence.push({
          controlCode: 'CC6.2',
          title: 'Google Workspace User Provisioning Report',
          data: {
            totalUsers: users.length,
            activeUsers: activeUsers.length,
            suspendedUsers: suspendedUsers.length,
            mfaEnrolledCount: mfaEnrolled.length,
            mfaEnrollmentRate: users.length > 0
              ? Math.round((mfaEnrolled.length / users.length) * 100)
              : 0,
            sampleUsers: users.slice(0, 10).map((u: any) => ({
              email: u.primaryEmail,
              name: u.name?.fullName,
              isAdmin: u.isAdmin,
              isSuspended: u.suspended,
              mfaEnrolled: u.isEnrolledIn2Sv,
              lastLogin: u.lastLoginTime,
              createdAt: u.creationTime,
            })),
            collectedAt: new Date().toISOString(),
            note: 'User lifecycle and provisioning evidence from Google Workspace directory',
          },
          collectedAt: new Date(),
        });

        // ── CC6.1: MFA enforcement ────────────────────────────────────────────
        evidence.push({
          controlCode: 'CC6.1',
          title: 'Google Workspace 2-Step Verification Enrollment',
          data: {
            totalUsers: users.length,
            enrolled: mfaEnrolled.length,
            notEnrolled: users.length - mfaEnrolled.length,
            enrollmentRate: users.length > 0
              ? Math.round((mfaEnrolled.length / users.length) * 100)
              : 0,
            usersNotEnrolled: users
              .filter((u: any) => !u.isEnrolledIn2Sv && !u.suspended)
              .slice(0, 5)
              .map((u: any) => ({ email: u.primaryEmail, isAdmin: u.isAdmin })),
            collectedAt: new Date().toISOString(),
            note: 'MFA (2-step verification) enrollment status across all active users',
          },
          collectedAt: new Date(),
        });
      }

      // ── CC6.3: Admin role assignments ────────────────────────────────────────
      const roleAssignmentsRes = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/customer/${customerId}/roleassignments`,
        { headers },
      );

      if (roleAssignmentsRes.ok) {
        const rolesData = await roleAssignmentsRes.json() as any;
        const assignments = rolesData.items ?? [];

        evidence.push({
          controlCode: 'CC6.3',
          title: 'Google Workspace Admin Role Assignments',
          data: {
            totalAdminAssignments: assignments.length,
            assignments: assignments.slice(0, 20).map((a: any) => ({
              assigneeEmail: a.assignedTo,
              roleId: a.roleId,
              scopeType: a.scopeType,
            })),
            collectedAt: new Date().toISOString(),
            note: 'Privileged access (admin role) assignments evidencing principle of least privilege',
          },
          collectedAt: new Date(),
        });
      }

      this.logger.log(`Google Workspace: collected ${evidence.length} evidence items`);
    } catch (err: any) {
      this.logger.error(`Google Workspace evidence collection failed: ${err.message}`);
    }

    return evidence;
  }
}
