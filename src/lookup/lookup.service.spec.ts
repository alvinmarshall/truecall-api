import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LookupService } from './lookup.service';
import { TruecallerService } from './truecaller.service';
import { LookupCacheService } from './lookup-cache.service';
import { AuditService } from './audit.service';

const mockTruecaller = { search: jest.fn() };
const mockCache = { get: jest.fn(), set: jest.fn() };
const mockAudit = { write: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('GH') };

const RESULT = {
  phone: '+233200000000',
  name: 'Kwame Mensah',
  score: 0.92,
  carrier: 'MTN Ghana',
  lineType: 'mobile',
  country: 'GH',
  spamScore: 0,
  isSpam: false,
  cached: false,
  lookedUpAt: '2026-07-30T00:00:00.000Z',
};

describe('LookupService', () => {
  let service: LookupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LookupService,
        { provide: TruecallerService, useValue: mockTruecaller },
        { provide: LookupCacheService, useValue: mockCache },
        { provide: AuditService, useValue: mockAudit },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(LookupService);
    jest.clearAllMocks();
  });

  describe('lookup — phone validation', () => {
    it('throws 400 on unparseable number', async () => {
      await expect(
        service.lookup('not-a-number', 'sub', 'client'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('lookup — cache HIT', () => {
    it('returns cached result and skips TruecallerService', async () => {
      mockCache.get.mockResolvedValue(RESULT);

      const result = await service.lookup('+233200000000', 'sub', 'client');

      expect(result.cached).toBe(true);
      expect(mockTruecaller.search).not.toHaveBeenCalled();
      expect(mockAudit.write).toHaveBeenCalledWith(
        expect.objectContaining({ cached: true }),
      );
    });
  });

  describe('lookup — cache MISS', () => {
    beforeEach(() => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);
    });

    it('calls TruecallerService, caches result, returns it', async () => {
      mockTruecaller.search.mockResolvedValue(RESULT);

      const result = await service.lookup('+233200000000', 'sub', 'client');

      expect(mockTruecaller.search).toHaveBeenCalledWith('+233200000000');
      expect(mockCache.set).toHaveBeenCalledWith(
        '+233200000000',
        expect.objectContaining({ name: 'Kwame Mensah' }),
      );
      expect(result.cached).toBe(false);
      expect(mockAudit.write).toHaveBeenCalledWith(
        expect.objectContaining({ cached: false }),
      );
    });

    it('throws 404 when truecaller returns Unknown', async () => {
      mockTruecaller.search.mockResolvedValue({ ...RESULT, name: 'Unknown' });

      await expect(
        service.lookup('+233200000000', 'sub', 'client'),
      ).rejects.toThrow(NotFoundException);
    });

    it('normalises short GH number to E.164', async () => {
      mockTruecaller.search.mockResolvedValue(RESULT);

      await service.lookup('0200000000', 'sub', 'client');

      expect(mockTruecaller.search).toHaveBeenCalledWith('+233200000000');
    });
  });
});
