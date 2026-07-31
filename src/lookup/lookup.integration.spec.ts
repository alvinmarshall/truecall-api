import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LookupCache } from './entities/lookup-cache.entity';
import { AuditLog } from './entities/audit-log.entity';
import { LookupCacheService } from './lookup-cache.service';
import { AuditService } from './audit.service';
import { TruecallerService } from './truecaller.service';
import { LookupService } from './lookup.service';
import { LookupController } from './lookup.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';

const VALID_PAYLOAD: JwtPayload = {
  sub: 'user-sub-1',
  iss: 'https://keycloak.test/realms/truecall',
  aud: 'truecall-api',
  azp: 'truecall-shortcut',
  resource_access: { 'truecall-api': { roles: ['lookup'] } },
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
};

const TRUECALLER_RESULT = {
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

describe('LookupController (integration)', () => {
  let app: INestApplication;
  let truecallerService: { search: jest.Mock };

  const cacheRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
  };
  const auditRepo = { insert: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    truecallerService = {
      search: jest.fn().mockResolvedValue(TRUECALLER_RESULT),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LookupController],
      providers: [
        LookupService,
        LookupCacheService,
        AuditService,
        { provide: TruecallerService, useValue: truecallerService },
        { provide: getRepositoryToken(LookupCache), useValue: cacheRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('GH') },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<{ user: JwtPayload }>().user =
            VALID_PAYLOAD;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  beforeEach(() => jest.clearAllMocks());

  describe('GET /lookup', () => {
    it('returns 400 when phone query param is missing', async () => {
      await request(app.getHttpServer() as Server)
        .get('/lookup')
        .expect(400);
    });

    it('cache MISS → calls TruecallerService and returns result', async () => {
      cacheRepo.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer() as Server)
        .get('/lookup?phone=%2B233200000000')
        .expect(200);

      const body = res.body as { name: string; cached: boolean };
      expect(body.name).toBe('Kwame Mensah');
      expect(body.cached).toBe(false);
      expect(truecallerService.search).toHaveBeenCalledWith('+233200000000');
      expect(cacheRepo.upsert).toHaveBeenCalled();
    });

    it('cache HIT → returns cached result, skips TruecallerService', async () => {
      cacheRepo.findOne.mockResolvedValue({
        result: { ...TRUECALLER_RESULT },
        expiresAt: new Date(Date.now() + 3_600_000),
      });

      const res = await request(app.getHttpServer() as Server)
        .get('/lookup?phone=%2B233200000000')
        .expect(200);

      const body = res.body as { cached: boolean };
      expect(body.cached).toBe(true);
      expect(truecallerService.search).not.toHaveBeenCalled();
    });
  });
});
