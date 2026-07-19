import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { LoggingInterceptor } from './logging.interceptor';
import { JwtPayload } from '../../auth/jwt-payload.interface';

const infoMock = jest.fn();
const mockLogger = { info: infoMock } as unknown as PinoLogger;

const makeContext = (user?: Partial<JwtPayload>) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', url: '/test', user }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  }) as unknown as ExecutionContext;

const makeHandler = (value: unknown = {}): CallHandler => ({
  handle: () => of(value),
});

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new LoggingInterceptor(mockLogger);
  });

  it('logs request info with user sub when user present', async () => {
    const user = { sub: 'user-uuid', azp: 'client-id' } as JwtPayload;
    const obs = interceptor.intercept(makeContext(user), makeHandler());
    await lastValueFrom(obs);
    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        kcSub: 'user-uuid',
        kcClientId: 'client-id',
      }),
    );
  });

  it('logs request info with undefined sub when no user', async () => {
    const obs = interceptor.intercept(makeContext(undefined), makeHandler());
    await lastValueFrom(obs);
    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        kcSub: undefined,
      }),
    );
  });

  it('returns observable that emits handler value', async () => {
    const obs = interceptor.intercept(makeContext(), makeHandler({ data: 42 }));
    const result = await lastValueFrom(obs);
    expect(result).toEqual({ data: 42 });
  });
});
