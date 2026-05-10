/**
 * Documents Service Tests (unit)
 *
 * DS01-DS04: Verify service method behavior with mocked Prisma.
 */

import { DocumentsService } from './documents.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  document: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    groupBy: jest.fn(),
  },
  documentVersion: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
};

const mockStorage = {
  assertOrgOwnership: jest.fn(),
  getSignedUrl: jest.fn(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentsService(
      mockPrisma as any,
      mockStorage as any,
    );
  });

  it('DS01 — list returns paginated results', async () => {
    const docs = [
      { id: '1', title: 'Policy A', docType: 'policy' },
      { id: '2', title: 'Evidence B', docType: 'evidence' },
    ];
    mockPrisma.document.findMany.mockResolvedValue(docs);
    mockPrisma.document.count.mockResolvedValue(2);

    const result = await service.list('org-1', { page: 1, limit: 20 });

    expect(result.documents).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('DS02 — getById throws NotFoundException when not found', async () => {
    mockPrisma.document.findFirst.mockResolvedValue(null);

    await expect(service.getById('org-1', 'nonexistent'))
      .rejects.toThrow(NotFoundException);
  });

  it('DS03 — softDelete sets activeForOrg to false', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({ id: '1', orgId: 'org-1' });
    mockPrisma.document.update.mockResolvedValue({ id: '1', activeForOrg: false });

    await service.softDelete('org-1', '1');

    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { activeForOrg: false },
    });
  });

  it('DS04 — getDownloadUrl throws when no sourceStorageKey', async () => {
    mockPrisma.document.findFirst.mockResolvedValue({
      id: '1', orgId: 'org-1', sourceStorageKey: null,
    });

    await expect(service.getDownloadUrl('org-1', '1'))
      .rejects.toThrow(NotFoundException);
  });
});
