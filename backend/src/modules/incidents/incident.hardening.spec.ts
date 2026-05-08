/**
 * P14 — Incident Management & Internal Audit Hardening Tests
 *
 * Covers:
 *  IM01–IM10  IncidentService lifecycle, SLA, evidence generation, tenant isolation
 *  CA01–CA05  Corrective action lifecycle
 *  IA01–IA10  InternalAuditService lifecycle, findings, evidence generation, tenant isolation
 */

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { IncidentService } from './incident.service';
import { InternalAuditService } from '../internal-audit/internal-audit.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockNotifications() {
  return { send: jest.fn().mockResolvedValue(undefined) } as any;
}

function makePrisma(overrides: Record<string, any> = {}) {
  return {
    securityIncident: {
      create:   jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count:    jest.fn(),
      update:   jest.fn(),
      groupBy:  jest.fn().mockResolvedValue([]),
    },
    correctiveAction: {
      create:     jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    complianceResponsibility: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    control: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    evidence: {
      create: jest.fn().mockResolvedValue({ id: 'ev-1' }),
    },
    controlEvidence: {
      create: jest.fn().mockResolvedValue({ id: 'ce-1' }),
    },
    internalAudit: {
      create:     jest.fn(),
      findUnique: jest.fn(),
      findMany:   jest.fn(),
      findFirst:  jest.fn().mockResolvedValue(null),
      update:     jest.fn(),
    },
    internalAuditFinding: {
      create:     jest.fn(),
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    raciAssignment: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any;
}

function makeIncident(overrides: any = {}) {
  return {
    id:        'inc-1',
    orgId:     'org-A',
    title:     'Test Incident',
    status:    'detected',
    severity:  'HIGH',
    category:  'unauthorized_access',
    detectedAt: new Date('2026-01-01T00:00:00Z'),
    containedAt: null,
    resolvedAt:  null,
    closedAt:    null,
    reportedBy: 'user-1',
    timeline:   [],
    correctiveActions: [],
    ...overrides,
  };
}

function makeAudit(overrides: any = {}) {
  return {
    id:       'audit-1',
    orgId:    'org-A',
    title:    'ISO 27001 Audit 2026',
    auditYear: 2026,
    scope:    ['A.5.1', 'A.8.2'],
    auditorId: 'user-2',
    status:   'planning',
    findings:  [],
    ...overrides,
  };
}

// ─── IM: Incident Management ──────────────────────────────────────────────────

describe('Incident Management — ISO A.5.24–A.5.27', () => {
  let svc: IncidentService;
  let prisma: ReturnType<typeof makePrisma>;
  let notif: ReturnType<typeof mockNotifications>;

  beforeEach(() => {
    prisma = makePrisma();
    notif  = mockNotifications();
    svc    = new IncidentService(prisma, notif);
  });

  // ─── IM01: createIncident stores reportedBy ────────────────────────────────
  test('IM01 — createIncident() sets reportedBy to actorId', async () => {
    const created = makeIncident({ reportedBy: 'user-1' });
    prisma.securityIncident.create.mockResolvedValue(created);

    await svc.createIncident('org-A', 'user-1', {
      title: 'Test', description: 'Desc', severity: 'HIGH', category: 'unauthorized_access',
    });

    const call = prisma.securityIncident.create.mock.calls[0][0];
    expect(call.data.reportedBy).toBe('user-1');
    expect(call.data.status).toBe('detected');
  });

  // ─── IM02: controlIds includes ISO A.5.24–A.5.27 ──────────────────────────
  test('IM02 — createIncident() seeds controlIds with A.5.24–A.5.27', async () => {
    prisma.securityIncident.create.mockResolvedValue(makeIncident());

    await svc.createIncident('org-A', 'u1', {
      title: 'T', description: 'D', severity: 'LOW', category: 'other',
    });

    const { controlIds } = prisma.securityIncident.create.mock.calls[0][0].data;
    expect(controlIds).toContain('A.5.24');
    expect(controlIds).toContain('A.5.25');
    expect(controlIds).toContain('A.5.26');
    expect(controlIds).toContain('A.5.27');
  });

  // ─── IM03: SECURITY_LEAD notified on creation ─────────────────────────────
  test('IM03 — createIncident() notifies SECURITY_LEAD (not actor)', async () => {
    prisma.securityIncident.create.mockResolvedValue(makeIncident());
    prisma.complianceResponsibility.findMany.mockResolvedValue([
      { userId: 'lead-1' },
      { userId: 'user-1' }, // actor — should be skipped
    ]);

    await svc.createIncident('org-A', 'user-1', {
      title: 'T', description: 'D', severity: 'CRITICAL', category: 'data_breach',
    });

    // Only lead-1 notified (user-1 is actor)
    expect(notif.send).toHaveBeenCalledTimes(1);
    const [orgId, userId] = notif.send.mock.calls[0];
    expect(orgId).toBe('org-A');
    expect(userId).toBe('lead-1');
  });

  // ─── IM04: status transition machine — valid ───────────────────────────────
  test('IM04 — updateStatus() allows valid transitions', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident({ status: 'detected' }));
    prisma.securityIncident.update.mockResolvedValue(makeIncident({ status: 'triaging' }));

    const result = await svc.updateStatus('org-A', 'inc-1', 'u1', 'triaging');
    expect(result.status).toBe('triaging');
  });

  // ─── IM05: status transition machine — invalid ────────────────────────────
  test('IM05 — updateStatus() rejects invalid transitions', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident({ status: 'detected' }));

    await expect(svc.updateStatus('org-A', 'inc-1', 'u1', 'closed'))
      .rejects.toThrow(BadRequestException);
  });

  // ─── IM06: close requires rootCause + lessonsLearned ─────────────────────
  test('IM06 — closeIncident() requires rootCause and lessonsLearned', async () => {
    const incident = makeIncident({ correctiveActions: [{ id: 'ca-1', status: 'closed' }] });
    prisma.securityIncident.findUnique.mockResolvedValue(incident);

    await expect(svc.closeIncident('org-A', 'inc-1', 'u1', {
      rootCause: '', lessonsLearned: 'Learned',
    })).rejects.toThrow(BadRequestException);

    await expect(svc.closeIncident('org-A', 'inc-1', 'u1', {
      rootCause: 'Root', lessonsLearned: '',
    })).rejects.toThrow(BadRequestException);
  });

  // ─── IM07: CRITICAL close blocks on open CAs ─────────────────────────────
  test('IM07 — closeIncident() blocks CRITICAL when corrective actions open', async () => {
    const incident = makeIncident({
      severity: 'CRITICAL',
      correctiveActions: [
        { id: 'ca-1', status: 'open' },    // open — blocks
        { id: 'ca-2', status: 'closed' },
      ],
    });
    prisma.securityIncident.findUnique.mockResolvedValue(incident);

    await expect(svc.closeIncident('org-A', 'inc-1', 'u1', {
      rootCause: 'Root', lessonsLearned: 'Learned',
    })).rejects.toThrow(/corrective action/i);
  });

  // ─── IM08: close requires ≥1 corrective action ────────────────────────────
  test('IM08 — closeIncident() requires at least one corrective action', async () => {
    const incident = makeIncident({ correctiveActions: [] });
    prisma.securityIncident.findUnique.mockResolvedValue(incident);

    await expect(svc.closeIncident('org-A', 'inc-1', 'u1', {
      rootCause: 'Root', lessonsLearned: 'Learned',
    })).rejects.toThrow(/corrective action/i);
  });

  // ─── IM09: close generates Evidence + ControlEvidence for ISO controls ─────
  test('IM09 — closeIncident() generates Evidence and maps to ISO A.5.24–A.5.27', async () => {
    const incident = makeIncident({
      correctiveActions: [{ id: 'ca-1', status: 'closed' }],
    });
    prisma.securityIncident.findUnique.mockResolvedValue(incident);
    prisma.control.findMany.mockResolvedValue([
      { id: 'ctrl-24', code: 'A.5.24' },
      { id: 'ctrl-25', code: 'A.5.25' },
      { id: 'ctrl-26', code: 'A.5.26' },
      { id: 'ctrl-27', code: 'A.5.27' },
    ]);
    prisma.evidence.create.mockResolvedValue({ id: 'ev-99' });
    prisma.securityIncident.update.mockResolvedValue({ ...incident, status: 'closed', evidenceId: 'ev-99' });

    const result = await svc.closeIncident('org-A', 'inc-1', 'u1', {
      rootCause: 'Misconfigured firewall', lessonsLearned: 'Review firewall rules quarterly',
    });

    expect(result.evidenceId).toBe('ev-99');
    expect(prisma.evidence.create).toHaveBeenCalledTimes(1);
    const evData = prisma.evidence.create.mock.calls[0][0].data;
    expect(evData.type).toBe('document');
    expect(evData.source).toBe('agent_generated');
    expect(evData.reviewedBy).toBe('u1');

    // 4 ControlEvidence records
    expect(prisma.controlEvidence.create).toHaveBeenCalledTimes(4);
  });

  // ─── IM10: tenant isolation — getIncident wrong org ─────────────────────
  test('IM10 — getIncident() throws NotFoundException for wrong orgId', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident({ orgId: 'org-B' }));

    await expect(svc.getIncident('org-A', 'inc-1'))
      .rejects.toThrow(NotFoundException);
  });
});

// ─── CA: Corrective Actions ────────────────────────────────────────────────────

describe('Corrective Actions', () => {
  let svc: IncidentService;
  let prisma: ReturnType<typeof makePrisma>;
  let notif: ReturnType<typeof mockNotifications>;

  beforeEach(() => {
    prisma = makePrisma();
    notif  = mockNotifications();
    svc    = new IncidentService(prisma, notif);
  });

  // ─── CA01: create stores incidentId + orgId ─────────────────────────────
  test('CA01 — addCorrectiveAction() stores incidentId and orgId', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident());
    prisma.correctiveAction.create.mockResolvedValue({ id: 'ca-1', orgId: 'org-A', incidentId: 'inc-1', status: 'open' });

    await svc.addCorrectiveAction('org-A', 'inc-1', 'actor', {
      title: 'Rotate creds', description: 'Rotate all service credentials',
      assignedTo: 'user-2', dueDate: '2026-06-01',
    });

    const d = prisma.correctiveAction.create.mock.calls[0][0].data;
    expect(d.incidentId).toBe('inc-1');
    expect(d.orgId).toBe('org-A');
    expect(d.status).toBe('open');
  });

  // ─── CA02: notify assignee unless actor ──────────────────────────────────
  test('CA02 — addCorrectiveAction() notifies assignee (not actor)', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident());
    prisma.correctiveAction.create.mockResolvedValue({ id: 'ca-1' });

    await svc.addCorrectiveAction('org-A', 'inc-1', 'actor', {
      title: 'Fix', description: 'Fix it', assignedTo: 'user-2', dueDate: '2026-06-01',
    });

    expect(notif.send).toHaveBeenCalledWith('org-A', 'user-2', expect.objectContaining({ type: 'task.assigned' }));
  });

  // ─── CA03: no notification when actor = assignee ─────────────────────────
  test('CA03 — addCorrectiveAction() skips notification when actor is assignee', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident());
    prisma.correctiveAction.create.mockResolvedValue({ id: 'ca-1' });

    await svc.addCorrectiveAction('org-A', 'inc-1', 'user-self', {
      title: 'Fix', description: 'Fix it', assignedTo: 'user-self', dueDate: '2026-06-01',
    });

    expect(notif.send).not.toHaveBeenCalled();
  });

  // ─── CA04: close sets status + completedAt ────────────────────────────────
  test('CA04 — closeCorrectiveAction() sets status closed and completedAt', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident());
    prisma.correctiveAction.findUnique.mockResolvedValue({ id: 'ca-1', orgId: 'org-A', incidentId: 'inc-1', status: 'open' });
    prisma.correctiveAction.update.mockResolvedValue({ id: 'ca-1', status: 'closed', completedAt: new Date() });

    const result = await svc.closeCorrectiveAction('org-A', 'inc-1', 'ca-1', 'actor');
    expect(result.status).toBe('closed');

    const updateData = prisma.correctiveAction.update.mock.calls[0][0].data;
    expect(updateData.status).toBe('closed');
    expect(updateData.completedAt).toBeInstanceOf(Date);
  });

  // ─── CA05: tenant isolation — wrong org throws ────────────────────────────
  test('CA05 — closeCorrectiveAction() throws NotFoundException for wrong org', async () => {
    prisma.securityIncident.findUnique.mockResolvedValue(makeIncident());
    prisma.correctiveAction.findUnique.mockResolvedValue({
      id: 'ca-1', orgId: 'org-B', incidentId: 'inc-1', status: 'open',
    });

    await expect(svc.closeCorrectiveAction('org-A', 'inc-1', 'ca-1', 'actor'))
      .rejects.toThrow(NotFoundException);
  });
});

// ─── IA: Internal Audit ────────────────────────────────────────────────────────

describe('Internal Audit — ISO Clause 9.2', () => {
  let svc: InternalAuditService;
  let prisma: ReturnType<typeof makePrisma>;
  let notif: ReturnType<typeof mockNotifications>;

  beforeEach(() => {
    prisma = makePrisma();
    notif  = mockNotifications();
    svc    = new InternalAuditService(prisma, notif);
  });

  // ─── IA01: create stores scope and auditorId ─────────────────────────────
  test('IA01 — createAudit() stores scope, auditorId, planning status', async () => {
    const audit = makeAudit();
    prisma.internalAudit.create.mockResolvedValue(audit);

    await svc.createAudit('org-A', 'actor', {
      title: 'Audit', auditYear: 2026,
      scope: ['A.5.1', 'A.8.2'],
      auditorId: 'user-2',
      plannedStartAt: '2026-06-01', plannedEndAt: '2026-06-30',
    });

    const d = prisma.internalAudit.create.mock.calls[0][0].data;
    expect(d.status).toBe('planning');
    expect(d.scope).toEqual(['A.5.1', 'A.8.2']);
    expect(d.auditorId).toBe('user-2');
  });

  // ─── IA02: phase transition planning → fieldwork ──────────────────────────
  test('IA02 — startFieldwork() transitions planning → fieldwork and sets actualStartAt', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ status: 'planning' }));
    prisma.internalAudit.update.mockResolvedValue(makeAudit({ status: 'fieldwork' }));

    await svc.startFieldwork('org-A', 'audit-1', 'actor');

    const d = prisma.internalAudit.update.mock.calls[0][0].data;
    expect(d.status).toBe('fieldwork');
    expect(d.actualStartAt).toBeInstanceOf(Date);
  });

  // ─── IA03: startFieldwork blocks on non-planning status ──────────────────
  test('IA03 — startFieldwork() throws if not in planning phase', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ status: 'fieldwork' }));

    await expect(svc.startFieldwork('org-A', 'audit-1', 'actor'))
      .rejects.toThrow(BadRequestException);
  });

  // ─── IA04: closeAudit blocks on open major findings ───────────────────────
  test('IA04 — closeAudit() blocks when major findings are open', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({
      status: 'reporting',
      findings: [
        { id: 'f-1', severity: 'major', status: 'open' },        // blocks
        { id: 'f-2', severity: 'minor', status: 'open' },        // ok
        { id: 'f-3', severity: 'major', status: 'closed' },      // ok
      ],
    }));

    await expect(svc.closeAudit('org-A', 'audit-1', 'actor', {}))
      .rejects.toThrow(/major finding/i);
  });

  // ─── IA05: closeAudit allows accepted_risk majors ─────────────────────────
  test('IA05 — closeAudit() allows closing when major findings are accepted_risk', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({
      status: 'reporting',
      findings: [
        { id: 'f-1', severity: 'major', status: 'accepted_risk' },
        { id: 'f-2', severity: 'minor', status: 'open' },
      ],
    }));
    prisma.control.findFirst.mockResolvedValue({ id: 'ctrl-92' });
    prisma.evidence.create.mockResolvedValue({ id: 'ev-92' });
    prisma.internalAudit.update.mockResolvedValue(makeAudit({ status: 'closed', evidenceId: 'ev-92' }));

    const result = await svc.closeAudit('org-A', 'audit-1', 'actor', {});
    expect(result.status).toBe('closed');
  });

  // ─── IA06: closeAudit generates Evidence for ISO 9.2 ─────────────────────
  test('IA06 — closeAudit() generates Evidence and maps to ISO 9.2', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({
      status: 'reporting',
      findings: [],
    }));
    prisma.control.findFirst.mockResolvedValue({ id: 'ctrl-92' });
    prisma.evidence.create.mockResolvedValue({ id: 'ev-92' });
    prisma.controlEvidence.create.mockResolvedValue({ id: 'ce-92' });
    prisma.internalAudit.update.mockResolvedValue(makeAudit({ status: 'closed', evidenceId: 'ev-92' }));

    const result = await svc.closeAudit('org-A', 'audit-1', 'actor', {});

    expect(result.evidenceId).toBe('ev-92');
    expect(prisma.evidence.create).toHaveBeenCalledTimes(1);
    const evData = prisma.evidence.create.mock.calls[0][0].data;
    expect(evData.type).toBe('document');
    expect(evData.source).toBe('agent_generated');
    expect(evData.reviewedBy).toBe('actor');
    expect(evData.metadata).toMatchObject({
      auditId: 'audit-1',
      auditYear: 2026,
    });

    // ControlEvidence linked to ISO 9.2
    expect(prisma.controlEvidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ controlId: 'ctrl-92', evidenceId: 'ev-92' }),
      }),
    );
  });

  // ─── IA07: addFinding resolves controlId from code ────────────────────────
  test('IA07 — addFinding() resolves controlId from controlCode', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ status: 'fieldwork' }));
    prisma.control.findFirst.mockResolvedValue({ id: 'ctrl-82' });
    prisma.internalAuditFinding.create.mockResolvedValue({
      id: 'find-1', severity: 'minor', status: 'open', controlId: 'ctrl-82',
    });

    await svc.addFinding('org-A', 'audit-1', 'actor', {
      controlCode: 'A.8.2', title: 'MFA gap', description: 'No MFA on admin', severity: 'minor',
    });

    const d = prisma.internalAuditFinding.create.mock.calls[0][0].data;
    expect(d.controlId).toBe('ctrl-82');
    expect(d.controlCode).toBe('A.8.2');
  });

  // ─── IA08: major finding auto-creates CorrectiveAction ────────────────────
  test('IA08 — addFinding() auto-creates CorrectiveAction for major severity', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ status: 'fieldwork' }));
    prisma.control.findFirst.mockResolvedValue(null);
    prisma.internalAuditFinding.create.mockResolvedValue({
      id: 'find-1', severity: 'major', status: 'open',
    });
    prisma.correctiveAction.create.mockResolvedValue({ id: 'ca-audit-1' });

    await svc.addFinding('org-A', 'audit-1', 'actor', {
      title: 'Critical gap', description: 'Missing control', severity: 'major',
    });

    expect(prisma.correctiveAction.create).toHaveBeenCalledTimes(1);
    const d = prisma.correctiveAction.create.mock.calls[0][0].data;
    expect(d.auditFindingId).toBe('find-1');
    expect(d.status).toBe('open');
    expect(d.dueDate).toBeInstanceOf(Date);
  });

  // ─── IA09: minor finding does NOT auto-create CorrectiveAction ────────────
  test('IA09 — addFinding() does not auto-create CorrectiveAction for non-major', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ status: 'fieldwork' }));
    prisma.control.findFirst.mockResolvedValue(null);
    prisma.internalAuditFinding.create.mockResolvedValue({
      id: 'find-1', severity: 'minor', status: 'open',
    });

    await svc.addFinding('org-A', 'audit-1', 'actor', {
      title: 'Minor gap', description: 'Observation', severity: 'minor',
    });

    expect(prisma.correctiveAction.create).not.toHaveBeenCalled();
  });

  // ─── IA10: tenant isolation — getAudit wrong org ──────────────────────────
  test('IA10 — getAudit() throws NotFoundException for wrong orgId', async () => {
    prisma.internalAudit.findUnique.mockResolvedValue(makeAudit({ orgId: 'org-B' }));

    await expect(svc.getAudit('org-A', 'audit-1'))
      .rejects.toThrow(NotFoundException);
  });
});
