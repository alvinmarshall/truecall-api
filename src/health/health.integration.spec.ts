import { Test, TestingModule } from '@nestjs/testing';
import type { Server } from 'http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  TypeOrmHealthIndicator,
  TerminusModule,
  HealthCheckError,
} from '@nestjs/terminus';
import { Reflector } from '@nestjs/core';
import { HealthController } from './health.controller';
import { TruecallerTokenHealthIndicator } from './truecaller-token.health';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

const makeApp = async (
  dbUp: boolean,
  tokenValid: boolean,
): Promise<INestApplication> => {
  const mockDb: Partial<TypeOrmHealthIndicator> = {
    pingCheck: jest.fn().mockImplementation((key: string) => {
      if (!dbUp) {
        throw new HealthCheckError(
          'DB down',
          { [key]: { status: 'down' } },
        );
      }
      return Promise.resolve({ [key]: { status: 'up' } });
    }),
  };

  const mockTcToken: Partial<TruecallerTokenHealthIndicator> = {
    isHealthy: jest.fn().mockImplementation((key: string) => {
      if (!tokenValid) {
        throw new HealthCheckError(
          'Token expired',
          { [key]: { status: 'down', hoursRemaining: 0 } },
        );
      }
      return Promise.resolve({ [key]: { status: 'up', hoursRemaining: 47 } });
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [
      { provide: TypeOrmHealthIndicator, useValue: mockDb },
      { provide: TruecallerTokenHealthIndicator, useValue: mockTcToken },
      Reflector,
    ],
  })
    .overrideGuard(JwtAuthGuard)
    .useValue({ canActivate: () => true })
    .compile();

  const app = module.createNestApplication();
  await app.init();
  return app;
};

describe('HealthController (integration)', () => {
  let app: INestApplication;

  afterEach(() => app?.close());

  it('GET /health → 200 when all checks pass', async () => {
    app = await makeApp(true, true);
    const res = await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
    const body = res.body as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /health → 503 when DB check fails', async () => {
    app = await makeApp(false, true);
    await request(app.getHttpServer() as Server).get('/health').expect(503);
  });

  it('GET /health → 503 when TC token check fails', async () => {
    app = await makeApp(true, false);
    await request(app.getHttpServer() as Server).get('/health').expect(503);
  });
});
