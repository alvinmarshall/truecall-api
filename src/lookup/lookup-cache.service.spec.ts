import { ConfigService } from '@nestjs/config';
import { LookupCacheService } from './lookup-cache.service';

const mockRepo = () => ({
  findOne: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
});

const mockConfig = (ttl = 86_400) => ({
  get: jest.fn().mockReturnValue(ttl),
});

const makeService = (repoOverrides = {}, ttl = 86_400) => {
  const repo = { ...mockRepo(), ...repoOverrides };
  return {
    service: new LookupCacheService(
      repo as never,
      mockConfig(ttl) as unknown as ConfigService,
    ),
    repo,
  };
};

const futureDate = (offsetMs = 3_600_000) => new Date(Date.now() + offsetMs);
const pastDate = () => new Date(Date.now() - 1_000);

const mockResult = { name: 'Kwame Mensah', phone: '+233201234567' };

describe('LookupCacheService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('get', () => {
    it('returns null when no entry exists', async () => {
      const { service } = makeService({ findOne: jest.fn().mockResolvedValue(null) });
      expect(await service.get('+233201234567')).toBeNull();
    });

    it('returns null when entry is expired', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ result: mockResult, expiresAt: pastDate() }),
      });
      expect(await service.get('+233201234567')).toBeNull();
    });

    it('returns cached result when entry is valid', async () => {
      const { service } = makeService({
        findOne: jest.fn().mockResolvedValue({ result: mockResult, expiresAt: futureDate() }),
      });
      expect(await service.get('+233201234567')).toEqual(mockResult);
    });

    it('looks up by exact E.164 key', async () => {
      const { service, repo } = makeService({ findOne: jest.fn().mockResolvedValue(null) });
      await service.get('+233201234567');
      expect(repo.findOne).toHaveBeenCalledWith({ where: { phoneE164: '+233201234567' } });
    });
  });

  describe('set', () => {
    it('upserts with correct phoneE164 and result', async () => {
      const { service, repo } = makeService();
      await service.set('+233201234567', mockResult);
      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ phoneE164: '+233201234567', result: mockResult }),
        ['phoneE164'],
      );
    });

    it('calculates expiresAt from CACHE_TTL_SECONDS', async () => {
      const { service, repo } = makeService({}, 3_600);
      const before = Date.now();
      await service.set('+233201234567', mockResult);
      const after = Date.now();
      const { expiresAt } = (repo.upsert.mock.calls[0] as [{ expiresAt: Date }, string[]])[0];
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3_600_000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + 3_600_000);
    });

    it('uses default TTL of 86400s when config returns undefined', async () => {
      const repo = mockRepo();
      const service = new LookupCacheService(
        repo as never,
        { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService,
      );
      const before = Date.now();
      await service.set('+233201234567', mockResult);
      const { expiresAt } = (repo.upsert.mock.calls[0] as [{ expiresAt: Date }, string[]])[0];
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + 86_400_000);
    });
  });

  describe('invalidate', () => {
    it('deletes entry by phoneE164', async () => {
      const { service, repo } = makeService();
      await service.invalidate('+233201234567');
      expect(repo.delete).toHaveBeenCalledWith({ phoneE164: '+233201234567' });
    });
  });
});
