import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { TokenService } from './token.service';
import { decrypt } from './crypto.util';

const ENCRYPTION_KEY = 'a'.repeat(64);

jest.mock('truecallerjs', () => ({
  login: jest.fn(),
  verifyOtp: jest.fn(),
}));

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-require-imports */
const truecallerjs = require('truecallerjs') as {
  login: jest.Mock;
  verifyOtp: jest.Mock;
};

const mockRepo = () => ({
  save: jest.fn(),
  create: jest.fn((v: unknown) => v),
  findOne: jest.fn(),
});

const mockConfig = (overrides: Record<string, unknown> = {}) => ({
  getOrThrow: (key: string) => {
    const values: Record<string, unknown> = {
      TC_PHONE_NUMBER: '+233201234567',
      ENCRYPTION_KEY,
      ...overrides,
    };
    return values[key];
  },
  get: (key: string) => ({ ENCRYPTION_KEY })[key],
});

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as PinoLogger;

const makeService = (tokenRepoOverrides = {}, eventRepoOverrides = {}) => {
  const tcTokenRepo = { ...mockRepo(), ...tokenRepoOverrides };
  const tokenEventRepo = { ...mockRepo(), ...eventRepoOverrides };
  return {
    service: new TokenService(
      tcTokenRepo as never,
      tokenEventRepo as never,
      mockConfig() as unknown as ConfigService,
      mockLogger,
    ),
    tcTokenRepo,
    tokenEventRepo,
  };
};

describe('TokenService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('requestOtp', () => {
    it('returns requestId on success', async () => {
      truecallerjs.login.mockResolvedValue({ status: 1, requestId: 'req-123' });
      const { service } = makeService();
      const result = await service.requestOtp('sub-abc');
      expect(result).toEqual({ requestId: 'req-123' });
    });

    it('throws ServiceUnavailableException on bad status', async () => {
      truecallerjs.login.mockResolvedValue({ status: 7, requestId: '' });
      const { service } = makeService();
      await expect(service.requestOtp('sub-abc')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('stores encrypted token on success', async () => {
      truecallerjs.verifyOtp.mockResolvedValue({
        status: 2,
        suspended: false,
        installationId: 'install-abc',
        ttl: 259200,
      });
      const { service, tcTokenRepo } = makeService();
      await service.verifyOtp('req-123', '123456', 'sub-abc');

      expect(tcTokenRepo.save).toHaveBeenCalledTimes(1);

      const saved = tcTokenRepo.save.mock.calls[0][0] as {
        installationIdEnc: string;
      };
      expect(decrypt(saved.installationIdEnc, ENCRYPTION_KEY)).toBe(
        'install-abc',
      );
    });

    it('throws BadRequestException on invalid OTP', async () => {
      truecallerjs.verifyOtp.mockResolvedValue({ status: 11 });
      const { service } = makeService();
      await expect(service.verifyOtp('req', '000', 'sub')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException on suspended account', async () => {
      truecallerjs.verifyOtp.mockResolvedValue({
        status: 2,
        suspended: true,
        installationId: 'x',
      });
      const { service } = makeService();
      await expect(service.verifyOtp('req', '000', 'sub')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStatus', () => {
    it('returns valid=false when no token exists', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue(null),
      });
      const result = await service.getStatus();
      expect(result.valid).toBe(false);
    });

    it('returns valid=false when token expired', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({
          expiresAt: new Date(Date.now() - 1000),
        }),
      });
      const result = await service.getStatus();
      expect(result.valid).toBe(false);
    });

    it('returns valid=true with hoursRemaining when token active', async () => {
      const expiresAt = new Date(Date.now() + 48 * 3_600_000);
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ expiresAt }),
      });
      const result = await service.getStatus();
      expect(result.valid).toBe(true);
      expect(result.hoursRemaining).toBeGreaterThanOrEqual(47);
    });
  });
});
