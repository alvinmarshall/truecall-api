import {
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import request from 'supertest';
import { JwtPayload } from './jwt-payload.interface';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

const CLIENT_ID = 'truecall-api';

const mockUser = (roles: string[]): JwtPayload => ({
  sub: 'test-sub',
  iss: 'https://keycloak.example.com/realms/truecall',
  aud: [CLIENT_ID],
  azp: 'truecall-shortcut',
  resource_access: { [CLIENT_ID]: { roles } },
  exp: 9999999999,
  iat: 1000000000,
});

class MockJwtAuthGuard extends JwtAuthGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }

  canActivate(context: import('@nestjs/common').ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string>;
      user?: JwtPayload;
    }>();

    const header = req.headers['x-test-roles'];
    if (!header) throw new UnauthorizedException();

    req.user = mockUser(header.split(','));
    return true;
  }
}

@Controller('test')
class TestController {
  @Get('public')
  @Public()
  publicRoute() {
    return { ok: true };
  }

  @Get('lookup')
  @Roles('lookup')
  lookupRoute() {
    return { ok: true };
  }

  @Get('admin')
  @Roles('admin')
  adminRoute() {
    return { ok: true };
  }
}

const mockConfig = { getOrThrow: () => CLIENT_ID };

describe('Auth integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        { provide: APP_GUARD, useClass: MockJwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /test/public → 200 (no token needed)', () =>
    request(app.getHttpServer()).get('/test/public').expect(HttpStatus.OK));

  it('GET /test/lookup → 401 (no token)', () =>
    request(app.getHttpServer())
      .get('/test/lookup')
      .expect(HttpStatus.UNAUTHORIZED));

  it('GET /test/lookup → 403 (wrong role)', () =>
    request(app.getHttpServer())
      .get('/test/lookup')
      .set('x-test-roles', 'admin')
      .expect(HttpStatus.FORBIDDEN));

  it('GET /test/lookup → 200 (correct role)', () =>
    request(app.getHttpServer())
      .get('/test/lookup')
      .set('x-test-roles', 'lookup')
      .expect(HttpStatus.OK));

  it('GET /test/admin → 403 (lookup role cannot access admin)', () =>
    request(app.getHttpServer())
      .get('/test/admin')
      .set('x-test-roles', 'lookup')
      .expect(HttpStatus.FORBIDDEN));

  it('GET /test/admin → 200 (admin role)', () =>
    request(app.getHttpServer())
      .get('/test/admin')
      .set('x-test-roles', 'admin')
      .expect(HttpStatus.OK));
});
