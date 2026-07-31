import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;
  const mockRepo = { insert: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(AuditLog), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(AuditService);
    jest.clearAllMocks();
  });

  it('calls repo.insert with the entry asynchronously', async () => {
    service.write({
      phoneE164: '+233200000000',
      resultName: 'Kwame',
      cached: false,
      durationMs: 120,
      kcSub: 'sub-1',
      kcClientId: 'client-1',
    });

    await new Promise((r) => setImmediate(r));

    expect(mockRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ phoneE164: '+233200000000', cached: false }),
    );
  });

  it('swallows insert errors silently', async () => {
    mockRepo.insert.mockRejectedValueOnce(new Error('db down'));

    expect(() =>
      service.write({
        phoneE164: '+233200000001',
        resultName: null,
        cached: true,
        durationMs: 5,
        kcSub: 'sub-2',
        kcClientId: 'client-2',
      }),
    ).not.toThrow();

    await new Promise((r) => setImmediate(r));
  });
});
