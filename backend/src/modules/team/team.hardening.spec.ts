/**
 * P9 — Team Management Hardening Tests
 *
 * Auditor-grade acceptance tests covering:
 * - SoD enforcement (A.5.3)
 * - RACI assignment rules
 * - Tenant isolation for all new tables
 * - Audit trail integrity (A.8.15)
 * - User status lifecycle (A.6.1, A.6.2, A.6.5)
 * - Evidence generation patterns
 * - Guided task DAG invariants
 */

import { TeamService } from './team.service';
import { RaciService } from './raci.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

// ─── Mock Prisma factory ──────────────────────────────────────────────────────

const makePrisma = (overrides: Record<string, any> = {}) => ({
  user: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'new-user', ...args.data })),
    update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    count: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn().mockImplementation((fn: any) => fn({
      user: { create: jest.fn().mockResolvedValue({ id: 'new-user', status: 'suspended' }) },
      complianceResponsibility: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      task: { create: jest.fn().mockResolvedValue({ id: 'task-1' }) },
    })),
  },
  raciAssignment: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'raci-1', ...args.data })),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'raci-1', ...args.create })),
    delete: jest.fn().mockResolvedValue({ id: 'raci-1' }),
    count: jest.fn().mockResolvedValue(0),
  },
  complianceResponsibility: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'cr-1', ...args.data })),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'cr-1', ...args.create })),
  },
  teamAuditLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  },
  organizationControl: {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue({ id: 'oc-1', orgId: 'org-A', controlId: 'ctrl-1' }),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
    count: jest.fn().mockResolvedValue(0),
  },
  control: {
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  evidence: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ev-1', ...args.data })),
    findMany: jest.fn().mockResolvedValue([]),
  },
  controlEvidence: {
    create: jest.fn().mockResolvedValue({ id: 'ce-1' }),
    count: jest.fn().mockResolvedValue(0),
  },
  task: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'task-1', ...args.data })),
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn().mockResolvedValue(0),
  },
  trainingAssignment: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ta-1', ...args.data })),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
    groupBy: jest.fn().mockResolvedValue([]),
  },
  trainingModule: {
    findUnique: jest.fn().mockResolvedValue({ id: 'tm-1', content: { passingScore: 70 } }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  accessReview: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ar-1', ...args.data })),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
  },
  accessReviewItem: {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  managementReview: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mr-1', ...args.data })),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: args.where.id, ...args.data })),
  },
  controlEffectivenessSample: {
    create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ces-1', ...args.data })),
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ id: 'ces-1' }),
  },
  inviteToken: {
    create: jest.fn().mockResolvedValue({ id: 'it-1', tokenHash: 'hash', userId: 'new-user', orgId: 'org-A' }),
    update: jest.fn().mockResolvedValue({ id: 'it-1' }),
  },
  organization: {
    findUnique: jest.fn().mockResolvedValue({ id: 'org-A', name: 'ACME Corp' }),
  },
  $transaction: jest.fn().mockImplementation((fn: any) => {
    if (typeof fn === 'function') return fn(overrides);
    return Promise.all(fn);
  }),
  ...overrides,
});

// ─── Shared mock services ─────────────────────────────────────────────────────

const mockResend = {
  sendInviteEmail:        jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  sendTaskAssignment:     jest.fn().mockResolvedValue(undefined),
};
const mockConfig = { get: jest.fn().mockReturnValue('http://localhost:3001') };

// ─── RACI Service setup ───────────────────────────────────────────────────────

const makeRaciService = (prismaOverrides: Record<string, any> = {}) => {
  // RaciService.assign() calls organizationControl.findUnique with composite key orgId_controlId
  const base = makePrisma(prismaOverrides);
  if (!prismaOverrides.organizationControl) {
    // Default: control exists (so assign() doesn't throw NotFoundException)
    base.organizationControl = {
      ...base.organizationControl,
      findUnique: jest.fn().mockResolvedValue({ id: 'oc-1', orgId: 'org-A', controlId: 'ctrl-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    };
  }
  return { service: new RaciService(base as any), prisma: base };
};

// ─── SoD01–SoD05: Segregation of Duties ─────────────────────────────────────

describe('SoD — Segregation of Duties', () => {
  describe('SoD01 — RACI: user cannot be both R and A on the same control', () => {
    it('throws ForbiddenException when assigning A to existing R holder', async () => {
      const { service, prisma } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findFirst: jest.fn().mockImplementation((args: any) => {
            // Simulate: user-1 already has R on this control
            if (args.where?.userId === 'user-1' && args.where?.raci === 'R') {
              return Promise.resolve({ id: 'existing', raci: 'R', userId: 'user-1' });
            }
            return Promise.resolve(null);
          }),
          create: jest.fn().mockResolvedValue({ id: 'new-raci' }),
          upsert: jest.fn().mockResolvedValue({ id: 'new-raci' }),
        },
        teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      });

      await expect(
        service.assign('org-A', 'ctrl-1', 'user-1', 'A', 'actor-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('logs SoD violation to TeamAuditLog before throwing', async () => {
      const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
      const { service } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args.where?.userId === 'user-1' && args.where?.raci === 'R') {
              return Promise.resolve({ id: 'existing', raci: 'R' });
            }
            return Promise.resolve(null);
          }),
          create: jest.fn(),
          upsert: jest.fn(),
        },
        teamAuditLog: { create: auditCreate },
      });

      try {
        await service.assign('org-A', 'ctrl-1', 'user-1', 'A', 'actor-1');
      } catch {
        // expected
      }

      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: expect.stringContaining('sod'),
          }),
        }),
      );
    });

    it('SoD02 — assigning R to existing A holder is also blocked', async () => {
      const { service } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findFirst: jest.fn().mockImplementation((args: any) => {
            if (args.where?.userId === 'user-2' && args.where?.raci === 'A') {
              return Promise.resolve({ id: 'existing', raci: 'A' });
            }
            return Promise.resolve(null);
          }),
          create: jest.fn(),
          upsert: jest.fn(),
        },
        teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      });

      await expect(
        service.assign('org-A', 'ctrl-1', 'user-2', 'R', 'actor-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('SoD03 — different users can hold R and A on the same control', async () => {
      const { service, prisma } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findFirst: jest.fn().mockResolvedValue(null), // no conflicts
          upsert: jest.fn().mockResolvedValue({ id: 'new-raci', raci: 'A', userId: 'user-A' }),
        },
        teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      });

      const result = await service.assign('org-A', 'ctrl-1', 'user-A', 'A', 'actor-1');
      expect(result).toBeDefined();
      expect(prisma.raciAssignment.upsert).toHaveBeenCalledTimes(1);
    });

    it('SoD04 — assigning C or I roles is never blocked by SoD', async () => {
      const { service, prisma } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findFirst: jest.fn().mockResolvedValue({ id: 'existing', raci: 'R' }), // has R
          upsert: jest.fn().mockResolvedValue({ id: 'new-raci', raci: 'C' }),
        },
        teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      });

      // C should succeed even if user has R on same control
      const result = await service.assign('org-A', 'ctrl-1', 'user-1', 'C', 'actor-1');
      expect(result).toBeDefined();
    });
  });

  describe('SoD05 — getSodConflicts returns controls where same user is R and A', () => {
    it('detects conflict when userId appears in both R and A for same control', async () => {
      const { service } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          // getSodConflicts calls findMany twice: once for R, once for A
          findMany: jest.fn()
            .mockResolvedValueOnce([
              { controlId: 'ctrl-1', userId: 'user-1' }, // R assignment
            ])
            .mockResolvedValueOnce([
              { controlId: 'ctrl-1', userId: 'user-1' }, // A assignment — same control, same user → conflict
              { controlId: 'ctrl-2', userId: 'user-2' }, // A on different control, different user → no conflict
            ]),
        },
      });

      const result = await service.getSodConflicts('org-A');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].controlId).toBe('ctrl-1');
      expect(result.conflicts[0].userId).toBe('user-1');
      expect(result.count).toBe(1);
    });

    it('returns empty conflicts when no SoD violations exist', async () => {
      const { service } = makeRaciService({
        raciAssignment: {
          ...makePrisma().raciAssignment,
          findMany: jest.fn()
            .mockResolvedValueOnce([{ controlId: 'ctrl-1', userId: 'user-1' }]) // R
            .mockResolvedValueOnce([{ controlId: 'ctrl-1', userId: 'user-2' }]), // A — different user
        },
      });

      const result = await service.getSodConflicts('org-A');
      expect(result.conflicts).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });
});

// ─── TI11–TI30: Tenant Isolation — new tables ────────────────────────────────

describe('Tenant Isolation — Team Management Tables', () => {
  const makeTeamService = (prismaOverrides: Record<string, any> = {}) => {
    const prisma = makePrisma(prismaOverrides);
    return { service: new TeamService(prisma as any, mockResend as any, mockConfig as any), prisma };
  };

  it('TI11 — getMembers() filters by orgId', async () => {
    const { service, prisma } = makeTeamService();
    await service.getMembers('org-A');
    const call = prisma.user.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe('org-A');
  });

  it('TI12 — getMembers() for org-B does NOT include org-A filter', async () => {
    const { service, prisma } = makeTeamService();
    await service.getMembers('org-B');
    const call = prisma.user.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe('org-B');
    expect(call.where.orgId).not.toBe('org-A');
  });

  it('TI13 — RACI assign() includes orgId in created record', async () => {
    // Direct service test via RaciService
    const raciPrisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'r1', ...args.create })),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const raciSvc = new RaciService(raciPrisma as any);

    await raciSvc.assign('org-A', 'ctrl-1', 'user-1', 'R', 'actor-1');
    const call = raciPrisma.raciAssignment.upsert.mock.calls[0][0];
    expect(call.create.orgId).toBe('org-A');
  });

  it('TI14 — getSodConflicts() filters by orgId on both R and A queries', async () => {
    const { service, prisma } = makeRaciService({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    await service.getSodConflicts('org-X');
    // Called twice: once for R, once for A
    for (const call of prisma.raciAssignment.findMany.mock.calls) {
      expect(call[0].where.orgId).toBe('org-X');
    }
  });

  it('TI15 — TeamAuditLog create always includes orgId', async () => {
    const raciPrisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const raciSvc = new RaciService(raciPrisma as any);

    await raciSvc.assign('org-A', 'ctrl-1', 'user-1', 'R', 'actor-1');
    const logCall = raciPrisma.teamAuditLog.create.mock.calls[0][0];
    expect(logCall.data.orgId).toBe('org-A');
  });

  it('TI16 — initiateOffboarding() sets status only on target user, verifies orgId match', async () => {
    const mockUser = {
      id: 'user-target', orgId: 'org-A', status: 'active',
      platformRole: 'contributor', fullName: 'Alice', email: 'alice@co.com',
    };
    const { service, prisma } = makeTeamService({
      user: {
        ...makePrisma().user,
        findFirst: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue({ ...mockUser, status: 'offboarding' }),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      task: {
        ...makePrisma().task,
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      raciAssignment: { ...makePrisma().raciAssignment, count: jest.fn().mockResolvedValue(0) },
    });

    await service.initiateOffboarding('org-A', 'user-target', new Date('2026-12-31'), 'actor-1');
    const updateCall = prisma.user.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe('user-target');
  });

  it('TI17 — initiateOffboarding() throws NotFoundException when user not in org', async () => {
    const { service } = makeTeamService({
      user: {
        ...makePrisma().user,
        findFirst: jest.fn().mockResolvedValue(null), // not found in org-A
      },
    });

    await expect(
      service.initiateOffboarding('org-A', 'user-other-org', new Date('2026-12-31'), 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── AL01–AL10: Audit Log Integrity (ISO A.8.15) ─────────────────────────────

describe('Audit Log — Every team action logs to TeamAuditLog', () => {
  it('AL01 — RACI assign logs action=raci.assign', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: auditCreate },
    });
    const svc = new RaciService(prisma as any);

    await svc.assign('org-A', 'ctrl-1', 'user-1', 'R', 'actor-1');

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: expect.stringContaining('raci'),
          actorId: 'actor-1',
          orgId: 'org-A',
        }),
      }),
    );
  });

  it('AL02 — RACI remove logs action=raci.remove', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', raci: 'R' }),
        delete: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: auditCreate },
    });
    const svc = new RaciService(prisma as any);

    await svc.remove('org-A', 'ctrl-1', 'user-1', 'R', 'actor-1');

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: expect.stringContaining('raci'),
          actorId: 'actor-1',
        }),
      }),
    );
  });

  it('AL03 — SoD violation logs action containing sod', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args.where?.userId === 'user-1' && args.where?.raci === 'R') {
            return Promise.resolve({ id: 'existing', raci: 'R' });
          }
          return Promise.resolve(null);
        }),
        upsert: jest.fn(),
      },
      teamAuditLog: { create: auditCreate },
    });
    const svc = new RaciService(prisma as any);

    try { await svc.assign('org-A', 'ctrl-1', 'user-1', 'A', 'actor-1'); } catch { /* expected */ }

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: expect.stringMatching(/sod/i),
        }),
      }),
    );
  });

  it('AL04 — Audit log entries include before and after state for role changes', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    const mockUser = { id: 'user-1', orgId: 'org-A', platformRole: 'contributor', status: 'active' };
    const prisma = makePrisma({
      user: {
        ...makePrisma().user,
        findFirst: jest.fn().mockResolvedValue(mockUser),
        update: jest.fn().mockResolvedValue({ ...mockUser, platformRole: 'approver' }),
      },
      teamAuditLog: { create: auditCreate },
      complianceResponsibility: {
        ...makePrisma().complianceResponsibility,
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({ id: 'cr-1' }),
      },
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findMany: jest.fn().mockResolvedValue([]),
      },
    });
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await svc.updateMember('org-A', 'user-1', { platformRole: 'approver' }, 'actor-1');

    const logCall = auditCreate.mock.calls.find((c: any) =>
      c[0].data?.action?.includes('role') || c[0].data?.action?.includes('member')
    );
    expect(logCall).toBeDefined();
    const logData = logCall![0].data;
    expect(logData.before).toBeDefined();
    expect(logData.after).toBeDefined();
  });

  it('AL05 — Audit log entries cannot be empty (orgId, actorId, action always present)', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'log-1' });
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: auditCreate },
    });
    const svc = new RaciService(prisma as any);

    await svc.assign('org-A', 'ctrl-1', 'user-1', 'C', 'actor-1');

    for (const call of auditCreate.mock.calls) {
      expect(call[0].data.orgId).toBeTruthy();
      expect(call[0].data.actorId).toBeTruthy();
      expect(call[0].data.action).toBeTruthy();
    }
  });
});

// ─── UL01–UL10: User Lifecycle (A.6.1, A.6.2, A.6.5) ────────────────────────

describe('User Lifecycle — Status Transitions', () => {
  it('UL01 — Newly invited user has status=suspended until activation', async () => {
    const txUserCreate = jest.fn().mockResolvedValue({ id: 'new-user', status: 'suspended', platformRole: 'contributor', orgId: 'org-A' });
    const txCompResp  = { createMany: jest.fn().mockResolvedValue({ count: 0 }) };
    const txTask      = { create: jest.fn().mockResolvedValue({ id: 'task-1' }) };

    const prisma = {
      ...makePrisma(),
      user: {
        ...makePrisma().user,
        findUnique: jest.fn().mockResolvedValue(null), // no duplicate email
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        return fn({ user: { create: txUserCreate }, complianceResponsibility: txCompResp, task: txTask });
      }),
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      trainingAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'ta-1' }) },
    };
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await svc.inviteMember('org-A', {
      email: 'new@co.com',
      fullName: 'New User',
      platformRole: 'contributor',
    }, 'actor-1');

    // The user created inside the transaction must have status=suspended
    expect(txUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'suspended' }) }),
    );
  });

  it('UL02 — User with requireNda=true creates an NDA task inside transaction', async () => {
    const txUserCreate = jest.fn().mockResolvedValue({ id: 'new-user', status: 'suspended', orgId: 'org-A' });
    const txTaskCreate = jest.fn().mockResolvedValue({ id: 'nda-task' });
    const txCompResp   = { createMany: jest.fn().mockResolvedValue({ count: 0 }) };

    const prisma = {
      ...makePrisma(),
      user: { ...makePrisma().user, findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation(async (fn: any) => {
        return fn({ user: { create: txUserCreate }, complianceResponsibility: txCompResp, task: { create: txTaskCreate } });
      }),
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      trainingAssignment: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'ta-1' }) },
    };
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await svc.inviteMember('org-A', {
      email: 'nda@co.com',
      fullName: 'NDA User',
      platformRole: 'contributor',
      requireNda: true,
    }, 'actor-1');

    // At least one task should be created (NDA task)
    expect(txTaskCreate).toHaveBeenCalled();
    const ndaCall = txTaskCreate.mock.calls.find((c: any) =>
      c[0]?.data?.title?.toLowerCase().includes('nda') || c[0]?.data?.kind === 'ATTESTATION'
    );
    expect(ndaCall).toBeDefined();
  });

  it('UL03 — initiateOffboarding() sets user status to offboarding', async () => {
    const mockUser = { id: 'user-1', orgId: 'org-A', status: 'active', platformRole: 'contributor', fullName: 'Alice', email: 'alice@co.com' };
    const userUpdate = jest.fn().mockResolvedValue({ ...mockUser, status: 'offboarding' });
    const prisma = makePrisma({
      user: {
        ...makePrisma().user,
        findFirst: jest.fn().mockResolvedValue(mockUser),
        update: userUpdate,
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
      task: {
        ...makePrisma().task,
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      raciAssignment: {
        ...makePrisma().raciAssignment,
        count: jest.fn().mockResolvedValue(0),
      },
    });
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await svc.initiateOffboarding('org-A', 'user-1', new Date('2026-12-31'), 'actor-1');

    expect(userUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'offboarding' }),
      }),
    );
  });

  it('UL04 — initiateOffboarding() throws when user is already deactivated', async () => {
    const mockUser = { id: 'user-1', orgId: 'org-A', status: 'deactivated' };
    const prisma = makePrisma({
      user: { ...makePrisma().user, findFirst: jest.fn().mockResolvedValue(mockUser) },
    });
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await expect(
      svc.initiateOffboarding('org-A', 'user-1', new Date('2026-12-31'), 'actor-1'),
    ).rejects.toThrow();
  });

  it('UL05 — initiateOffboarding() throws NotFoundException when user not in org', async () => {
    const prisma = makePrisma({
      user: { ...makePrisma().user, findFirst: jest.fn().mockResolvedValue(null) },
    });
    const svc = new TeamService(prisma as any, mockResend as any, mockConfig as any);

    await expect(
      svc.initiateOffboarding('org-A', 'user-from-org-B', new Date('2026-12-31'), 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── EV01–EV10: Evidence Generation Patterns ─────────────────────────────────

describe('Evidence Generation — Consistent patterns across P6/P8', () => {
  it('EV01 — Management review sign-off creates Evidence with orgId', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const mockReview = {
      id: 'review-1', orgId: 'org-A', scheduledAt: new Date(),
      completedAt: new Date(), minutes: 'Meeting minutes here', attendees: ['a@b.com'],
      actions: [], signedBy: null,
    };
    const prisma = makePrisma({
      managementReview: {
        findFirst: jest.fn().mockResolvedValue(mockReview),
        update: jest.fn().mockImplementation((args: any) => Promise.resolve({ ...mockReview, ...args.data })),
      },
      organizationControl: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      evidence: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ev-1', ...args.data })),
      },
      controlEvidence: {
        create: jest.fn().mockResolvedValue({ id: 'ce-1' }),
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    const result = await svc.signOff('org-A', 'review-1', 'actor-1');

    expect(prisma.evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org-A', uploadedBy: 'actor-1' }),
      }),
    );
    expect(result.evidence).toBeDefined();
  });

  it('EV02 — Evidence record always has storageUrl set', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const mockReview = {
      id: 'review-2', orgId: 'org-A', scheduledAt: new Date(),
      completedAt: new Date(), minutes: 'Minutes', attendees: [], actions: [], signedBy: null,
    };
    const prisma = makePrisma({
      managementReview: {
        findFirst: jest.fn().mockResolvedValue(mockReview),
        update: jest.fn().mockImplementation((args: any) => Promise.resolve({ ...mockReview, ...args.data })),
      },
      organizationControl: { findFirst: jest.fn().mockResolvedValue(null) },
      evidence: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ev-2', ...args.data })),
      },
      controlEvidence: { create: jest.fn().mockResolvedValue({ id: 'ce-1' }) },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.signOff('org-A', 'review-2', 'actor-1');

    const createCall = prisma.evidence.create.mock.calls[0][0];
    expect(createCall.data.storageUrl).toBeTruthy();
  });

  it('EV03 — Cannot sign off a management review without minutes', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const mockReview = {
      id: 'review-3', orgId: 'org-A', scheduledAt: new Date(),
      completedAt: null, minutes: null, // <-- no minutes
      attendees: [], actions: [], signedBy: null,
    };
    const prisma = makePrisma({
      managementReview: { findFirst: jest.fn().mockResolvedValue(mockReview) },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await expect(svc.signOff('org-A', 'review-3', 'actor-1')).rejects.toThrow();
  });

  it('EV04 — Cannot sign off a management review that is already signed', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const mockReview = {
      id: 'review-4', orgId: 'org-A', scheduledAt: new Date(),
      completedAt: new Date(), minutes: 'Minutes',
      attendees: [], actions: [], signedBy: 'already-signed-user', // already signed
    };
    const prisma = makePrisma({
      managementReview: { findFirst: jest.fn().mockResolvedValue(mockReview) },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await expect(svc.signOff('org-A', 'review-4', 'actor-1')).rejects.toThrow();
  });

  it('EV05 — Evidence expiresAt is set to 1 year from sign-off', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const mockReview = {
      id: 'review-5', orgId: 'org-A', scheduledAt: new Date(),
      completedAt: new Date(), minutes: 'Minutes', attendees: [], actions: [], signedBy: null,
    };
    const prisma = makePrisma({
      managementReview: {
        findFirst: jest.fn().mockResolvedValue(mockReview),
        update: jest.fn().mockImplementation((args: any) => Promise.resolve({ ...mockReview, ...args.data })),
      },
      organizationControl: { findFirst: jest.fn().mockResolvedValue(null) },
      evidence: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ev-5', ...args.data })),
      },
      controlEvidence: { create: jest.fn().mockResolvedValue({ id: 'ce-1' }) },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.signOff('org-A', 'review-5', 'actor-1');

    const evCall = prisma.evidence.create.mock.calls[0][0];
    const expiresAt: Date = evCall.data.expiresAt;
    const expectedMin = new Date(Date.now() + 360 * 24 * 60 * 60 * 1000);
    const expectedMax = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(expectedMin.getTime());
    expect(expiresAt.getTime()).toBeLessThan(expectedMax.getTime());
  });
});

// ─── RI01–RI05: RACI Invariants ───────────────────────────────────────────────

describe('RACI Invariants', () => {
  it('RI01 — assign() writes orgId, controlId, userId, raci to the record', async () => {
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'r1', ...args.create })),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const svc = new RaciService(prisma as any);

    await svc.assign('org-A', 'ctrl-X', 'user-Y', 'A', 'actor-Z');

    const upsertCall = prisma.raciAssignment.upsert.mock.calls[0][0];
    expect(upsertCall.create).toMatchObject({
      orgId: 'org-A',
      controlId: 'ctrl-X',
      userId: 'user-Y',
      raci: 'A',
      assignedBy: 'actor-Z',
    });
  });

  it('RI02 — remove() returns {removed:false} when assignment does not exist (idempotent)', async () => {
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const svc = new RaciService(prisma as any);

    // remove() is idempotent — returns {removed:false} not throws
    const result = await svc.remove('org-A', 'ctrl-1', 'user-1', 'R', 'actor-1');
    expect(result).toMatchObject({ removed: false });
  });

  it('RI03 — RACI uniqueness: same (orgId, controlId, userId, raci) is upserted, not duplicated', async () => {
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const svc = new RaciService(prisma as any);

    await svc.assign('org-A', 'ctrl-1', 'user-1', 'C', 'actor-1');
    await svc.assign('org-A', 'ctrl-1', 'user-1', 'C', 'actor-1');

    // Should use upsert (not create), so DB won't get duplicates
    expect(prisma.raciAssignment.upsert).toHaveBeenCalledTimes(2);
  });

  it('RI04 — bulkFromResponsibilities() queries responsibilities scoped to org (not cross-tenant)', async () => {
    const respFindMany = jest.fn().mockResolvedValue([
      { userId: 'u1', role: 'SECURITY_LEAD', orgId: 'org-A' },
    ]);
    const prisma = makePrisma({
      complianceResponsibility: {
        ...makePrisma().complianceResponsibility,
        findMany: respFindMany,
      },
      organizationControl: {
        findMany: jest.fn().mockResolvedValue([
          { controlId: 'c1', control: { id: 'c1', code: 'A.5.1' } },
          { controlId: 'c2', control: { id: 'c2', code: 'CC6.1' } },
        ]),
        findUnique: jest.fn().mockResolvedValue({ id: 'oc-1', orgId: 'org-A', controlId: 'c1' }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'r1' }),
      },
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const svc = new RaciService(prisma as any);

    await svc.bulkFromResponsibilities('org-A', 'actor-1');

    // Responsibilities query must be scoped to org-A only
    expect(respFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-A' }) }),
    );
  });
});

// ─── CT01–CT05: Control Effectiveness ────────────────────────────────────────

describe('Control Effectiveness — Sampling invariants', () => {
  it('CT01 — sampleControl() throws NotFoundException for unknown controlId', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const prisma = makePrisma({
      organizationControl: {
        findFirst: jest.fn().mockResolvedValue(null), // not found
      },
    } as any);
    const svc = new ControlEffectivenessService(prisma as any);

    await expect(
      svc.sampleControl('org-A', 'nonexistent-id', 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('CT02 — sampleControl() creates a ControlEffectivenessSample with orgId', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const mockOrgControl = {
      id: 'oc-1', orgId: 'org-A', controlId: 'ctrl-1',
      control: { id: 'ctrl-1', code: 'A.8.2', title: 'Privileged Access' },
    };
    const prisma = makePrisma({
      organizationControl: { findFirst: jest.fn().mockResolvedValue(mockOrgControl) },
      controlEffectivenessSample: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ces-1', ...args.data })),
      },
      controlEvidence: {
        count: jest.fn().mockResolvedValue(2),
      },
      task: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any);
    const svc = new ControlEffectivenessService(prisma as any);

    const result = await svc.sampleControl('org-A', 'ctrl-1', 'actor-1');
    expect((prisma as any).controlEffectivenessSample.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: 'org-A', controlId: 'ctrl-1' }),
      }),
    );
    expect(result.sample).toBeDefined();
    expect(result.evaluation.result).toMatch(/PASS|FAIL|PARTIAL/);
  });

  it('CT03 — getSummary() filters by orgId', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const prisma = makePrisma({
      controlEffectivenessSample: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);
    const svc = new ControlEffectivenessService(prisma as any);

    await svc.getSummary('org-B');

    const call = (prisma as any).controlEffectivenessSample.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe('org-B');
  });

  it('CT04 — PASS result when recent evidence exists', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const mockOrgControl = {
      id: 'oc-1', orgId: 'org-A', controlId: 'ctrl-1',
      control: { id: 'ctrl-1', code: 'A.8.2', title: 'Access' },
    };
    const prisma = makePrisma({
      organizationControl: { findFirst: jest.fn().mockResolvedValue(mockOrgControl) },
      controlEffectivenessSample: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ces-1', ...args.data })),
      },
      controlEvidence: { count: jest.fn().mockResolvedValue(3) }, // 3 recent
      task: { count: jest.fn().mockResolvedValue(0) },
    } as any);
    const svc = new ControlEffectivenessService(prisma as any);

    const result = await svc.sampleControl('org-A', 'ctrl-1', 'actor-1');
    expect(result.evaluation.result).toBe('PASS');
  });

  it('CT05 — Batch sample generates a single Evidence record', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const prisma = makePrisma({
      organizationControl: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'oc-1', orgId: 'org-A', controlId: 'ctrl-1',
          control: { id: 'ctrl-1', code: 'A.8.2' },
        }),
      },
      controlEffectivenessSample: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ces-1', ...args.data })),
        update: jest.fn().mockResolvedValue({ id: 'ces-1' }),
      },
      evidence: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'ev-batch', ...args.data })),
      },
      controlEvidence: { create: jest.fn().mockResolvedValue({ id: 'ce-1' }) },
      control: { findFirst: jest.fn().mockResolvedValue({ id: 'ctrl-A535', code: 'A.5.35' }) },
      controlEvidence2: { create: jest.fn().mockResolvedValue({ id: 'ce-2' }) },
      task: { count: jest.fn().mockResolvedValue(0) },
    } as any);

    // Only A.8.2 will match (single integration-testable control that resolves)
    const svc = new ControlEffectivenessService(prisma as any);
    const result = await svc.runBatchSample('org-A', 'actor-1');

    // Evidence should be created once for the batch
    expect((prisma as any).evidence.create).toHaveBeenCalledTimes(1);
    expect(result.evidenceId).toBeTruthy();
  });
});

// ─── MR01–MR05: Management Reviews ───────────────────────────────────────────

describe('Management Reviews — ISO Clause 9.3', () => {
  it('MR01 — scheduleReview() pre-populates ISO 9.3 agenda items', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const prisma = makePrisma({
      managementReview: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mr-1', ...args.data })),
      },
      complianceResponsibility: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      task: {
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.scheduleReview('org-A', 'actor-1', {
      scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      attendees: ['ciso@co.com'],
    });

    const createCall = (prisma as any).managementReview.create.mock.calls[0][0];
    expect(Array.isArray(createCall.data.agendaItems)).toBe(true);
    expect(createCall.data.agendaItems.length).toBeGreaterThanOrEqual(5);
    // Must include ISO 9.3 standard items
    const items = createCall.data.agendaItems.map((a: any) => a.item);
    expect(items.some((i: string) => i.toLowerCase().includes('previous'))).toBe(true);
    expect(items.some((i: string) => i.toLowerCase().includes('risk'))).toBe(true);
  });

  it('MR02 — scheduleReview() creates a preparation task for COMPLIANCE_LEAD', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const prisma = makePrisma({
      managementReview: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mr-2', ...args.data })),
      },
      complianceResponsibility: {
        findFirst: jest.fn().mockResolvedValue({ user: { id: 'compliance-lead-user' } }),
      },
      task: {
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.scheduleReview('org-A', 'actor-1', {
      scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      attendees: ['ciso@co.com'],
    });

    expect((prisma as any).task.create).toHaveBeenCalledTimes(1);
    const taskCall = (prisma as any).task.create.mock.calls[0][0];
    expect(taskCall.data.assignedTo).toBe('compliance-lead-user');
  });

  it('MR03 — scheduleReview() task due date is 7 days before the review', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const reviewDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const prisma = makePrisma({
      managementReview: {
        create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mr-3', ...args.data })),
      },
      complianceResponsibility: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { create: jest.fn().mockResolvedValue({ id: 'task-1' }) },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.scheduleReview('org-A', 'actor-1', {
      scheduledAt: reviewDate.toISOString(),
      attendees: [],
    });

    const taskCall = (prisma as any).task.create.mock.calls[0][0];
    const dueDate: Date = taskCall.data.dueDate;
    const expectedDue = new Date(reviewDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    // Allow 5 second tolerance
    expect(Math.abs(dueDate.getTime() - expectedDue.getTime())).toBeLessThan(5000);
  });

  it('MR04 — listReviews() filters by orgId', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const prisma = makePrisma({
      managementReview: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await svc.listReviews('org-C');

    const call = (prisma as any).managementReview.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe('org-C');
  });

  it('MR05 — getReview() throws NotFoundException for wrong org', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const prisma = makePrisma({
      managementReview: {
        findFirst: jest.fn().mockResolvedValue(null), // not found for this org
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await expect(
      svc.getReview('org-A', 'review-belongs-to-org-B'),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─── TI20–TI30: Cross-table Tenant Isolation ─────────────────────────────────

describe('Tenant Isolation — Cross-table checks', () => {
  it('TI20 — Access review generate() filters org members by orgId', async () => {
    const { AccessReviewService } = await import('../access-reviews/access-review.service');
    const prisma = makePrisma({
      user: {
        ...makePrisma().user,
        findMany: jest.fn().mockResolvedValue([]),
      },
      accessReview: {
        ...makePrisma().accessReview,
        create: jest.fn().mockResolvedValue({ id: 'ar-1' }),
      },
    } as any);
    const svc = new AccessReviewService(prisma as any);

    await svc.generateQuarterlyReviews('org-D', 'actor-1');

    const usersCall = (prisma as any).user.findMany.mock.calls[0][0];
    expect(usersCall.where.orgId).toBe('org-D');
  });

  it('TI21 — Training stats query scopes to orgId', async () => {
    const { TrainingService } = await import('../training/training.service');
    const prisma = makePrisma({
      trainingAssignment: {
        ...makePrisma().trainingAssignment,
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
      },
    } as any);
    const svc = new TrainingService(prisma as any);

    await svc.getStats('org-E');

    // All calls should include orgId filter
    const allCalls = [
      ...((prisma as any).trainingAssignment.count?.mock?.calls ?? []),
      ...((prisma as any).trainingAssignment.findMany?.mock?.calls ?? []),
    ];
    for (const call of allCalls) {
      if (call[0]?.where) {
        expect(call[0].where.orgId).toBe('org-E');
      }
    }
  });

  it('TI22 — Control effectiveness getSamples() scopes to orgId', async () => {
    const { ControlEffectivenessService } = await import('../control-effectiveness/control-effectiveness.service');
    const prisma = makePrisma({
      controlEffectivenessSample: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any);
    const svc = new ControlEffectivenessService(prisma as any);

    await svc.getSamples('org-F');

    const call = (prisma as any).controlEffectivenessSample.findMany.mock.calls[0][0];
    expect(call.where.orgId).toBe('org-F');
  });

  it('TI23 — Management review signOff() verifies orgId before writing Evidence', async () => {
    const { ManagementReviewService } = await import('../management-reviews/management-review.service');
    const prisma = makePrisma({
      managementReview: {
        findFirst: jest.fn().mockResolvedValue(null), // not in org-G
      },
    } as any);
    const svc = new ManagementReviewService(prisma as any);

    await expect(
      svc.signOff('org-G', 'review-from-org-H', 'actor-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('TI24 — RACI bulkFromResponsibilities queries org scoped controls only', async () => {
    const respFindMany = jest.fn().mockResolvedValue([]);
    const orgControlFindMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({
      complianceResponsibility: {
        ...makePrisma().complianceResponsibility,
        findMany: respFindMany,
      },
      organizationControl: {
        findMany: orgControlFindMany,
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      raciAssignment: makePrisma().raciAssignment,
      teamAuditLog: { create: jest.fn().mockResolvedValue({ id: 'log-1' }) },
    });
    const svc = new RaciService(prisma as any);

    await svc.bulkFromResponsibilities('org-H', 'actor-1');

    expect(respFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ orgId: 'org-H' }) }),
    );
  });

  it('TI25 — Two orgs with same userId cannot see each other\'s RACI conflicts', async () => {
    // getSodConflicts calls findMany twice (for R and for A)
    // For org-A: user-1 has both R and A on ctrl-1 → 1 conflict
    // For org-B: no data → 0 conflicts
    const callCount = { orgA: 0, orgB: 0 };
    const prisma = makePrisma({
      raciAssignment: {
        ...makePrisma().raciAssignment,
        findMany: jest.fn().mockImplementation((args: any) => {
          if (args.where.orgId === 'org-A') {
            callCount.orgA++;
            // First call (R): return user-1; Second call (A): return user-1 → conflict
            return Promise.resolve([{ controlId: 'ctrl-1', userId: 'user-1' }]);
          }
          callCount.orgB++;
          return Promise.resolve([]);
        }),
      },
    });
    const svc = new RaciService(prisma as any);

    const orgBResult = await svc.getSodConflicts('org-B');
    expect(orgBResult.conflicts).toHaveLength(0);
    // org-B queries should never return org-A's data
    expect(callCount.orgA).toBe(0);
  });
});
