import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  ServiceUnavailableException,
  BadGatewayException,
} from '@nestjs/common';
import { TruecallerService } from './truecaller.service';
import { TokenService } from '../token/token.service';

jest.mock('truecallerjs', () => ({
  search: jest.fn(),
}));

import * as truecallerjs from 'truecallerjs';

const mockTokenService = { getInstallationId: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('GH') };
const mockLogger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };

const RAW_RESPONSE = {
  name: 'Kwame Mensah',
  score: 0.92,
  phones: [{ carrier: 'MTN Ghana', numberType: 'mobile' }],
  addresses: [{ countryCode: 'GH' }],
  spamInfo: { score: 0, spamStatus: 'NOT_SPAM' },
};

describe('TruecallerService', () => {
  let service: TruecallerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TruecallerService,
        { provide: TokenService, useValue: mockTokenService },
        { provide: ConfigService, useValue: mockConfig },
        {
          provide: 'PinoLogger:TruecallerService',
          useValue: mockLogger,
        },
      ],
    })
      .overrideProvider('PinoLogger:TruecallerService')
      .useValue(mockLogger)
      .compile();

    service = module.get(TruecallerService);
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('throws 503 when no installationId', async () => {
      mockTokenService.getInstallationId.mockResolvedValue(null);
      await expect(service.search('+233200000000')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('returns mapped DTO on success', async () => {
      mockTokenService.getInstallationId.mockResolvedValue('inst-id-123');
      (truecallerjs.search as jest.Mock).mockResolvedValue(RAW_RESPONSE);

      const result = await service.search('+233200000000');

      expect(result.phone).toBe('+233200000000');
      expect(result.name).toBe('Kwame Mensah');
      expect(result.carrier).toBe('MTN Ghana');
      expect(result.isSpam).toBe(false);
      expect(result.cached).toBe(false);
    });

    it('throws 502 when truecallerjs throws', async () => {
      mockTokenService.getInstallationId.mockResolvedValue('inst-id-123');
      (truecallerjs.search as jest.Mock).mockRejectedValue(
        new Error('network'),
      );

      await expect(service.search('+233200000000')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('marks isSpam true when spamStatus is SPAM', async () => {
      mockTokenService.getInstallationId.mockResolvedValue('inst-id-123');
      (truecallerjs.search as jest.Mock).mockResolvedValue({
        ...RAW_RESPONSE,
        spamInfo: { score: 0, spamStatus: 'SPAM' },
      });

      const result = await service.search('+233200000000');
      expect(result.isSpam).toBe(true);
    });

    it('uses defaults when phones/addresses/spamInfo absent', async () => {
      mockTokenService.getInstallationId.mockResolvedValue('inst-id-123');
      (truecallerjs.search as jest.Mock).mockResolvedValue({});

      const result = await service.search('+233200000000');
      expect(result.name).toBe('Unknown');
      expect(result.carrier).toBe('');
      expect(result.lineType).toBe('');
      expect(result.country).toBe('GH');
      expect(result.spamScore).toBe(0);
      expect(result.isSpam).toBe(false);
    });

    it('marks isSpam true when spamScore > 0', async () => {
      mockTokenService.getInstallationId.mockResolvedValue('inst-id-123');
      (truecallerjs.search as jest.Mock).mockResolvedValue({
        ...RAW_RESPONSE,
        spamInfo: { score: 5, spamStatus: 'NOT_SPAM' },
      });

      const result = await service.search('+233200000000');
      expect(result.isSpam).toBe(true);
    });
  });
});
