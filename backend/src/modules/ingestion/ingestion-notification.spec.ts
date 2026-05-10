import { IngestionNotificationService } from './ingestion-notification.service';

describe('IngestionNotificationService', () => {
  let service: IngestionNotificationService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      ingestionBatch: { findFirst: jest.fn() },
      user: { findMany: jest.fn() },
    };
  });

  describe('when RESEND_API_KEY is not configured', () => {
    beforeEach(() => {
      mockConfig = {
        get: jest.fn((key: string, defaultVal?: string) => {
          if (key === 'RESEND_API_KEY') return '';
          return defaultVal ?? '';
        }),
      };
      service = new IngestionNotificationService(mockPrisma, mockConfig);
    });

    it('should skip sending and not query the database', async () => {
      await service.notifyBatchCompleted('batch-1', 'org-1');

      expect(mockPrisma.ingestionBatch.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('buildBatchEmailHtml', () => {
    beforeEach(() => {
      mockConfig = {
        get: jest.fn((key: string, defaultVal?: string) => {
          if (key === 'RESEND_API_KEY') return 'test-key';
          return defaultVal ?? '';
        }),
      };
      service = new IngestionNotificationService(mockPrisma, mockConfig);
    });

    it('should include total file count', () => {
      const html = service.buildBatchEmailHtml({
        totalFiles: 25,
        autoPlaced: 20,
        needsReview: 3,
        failed: 2,
        reviewUrl: 'https://app.example.com/import',
      });

      expect(html).toContain('25 files');
      expect(html).toContain('20');
      expect(html).toContain('Auto-placed');
    });

    it('should include review section when needsReview > 0', () => {
      const html = service.buildBatchEmailHtml({
        totalFiles: 10,
        autoPlaced: 5,
        needsReview: 5,
        failed: 0,
        reviewUrl: 'https://app.example.com/import',
      });

      expect(html).toContain('Needs review');
      expect(html).toContain('Review 5 files');
      expect(html).toContain('https://app.example.com/import');
    });

    it('should omit review section when needsReview is 0', () => {
      const html = service.buildBatchEmailHtml({
        totalFiles: 10,
        autoPlaced: 10,
        needsReview: 0,
        failed: 0,
        reviewUrl: 'https://app.example.com/import',
      });

      expect(html).not.toContain('Needs review');
      expect(html).not.toContain('Review 0 files');
    });

    it('should include failed section when failed > 0', () => {
      const html = service.buildBatchEmailHtml({
        totalFiles: 10,
        autoPlaced: 7,
        needsReview: 0,
        failed: 3,
        reviewUrl: 'https://app.example.com/import',
      });

      expect(html).toContain('Failed');
      expect(html).toContain('3');
    });

    it('should omit failed section when failed is 0', () => {
      const html = service.buildBatchEmailHtml({
        totalFiles: 10,
        autoPlaced: 10,
        needsReview: 0,
        failed: 0,
        reviewUrl: 'https://app.example.com/import',
      });

      expect(html).not.toContain('Failed');
    });
  });
});
