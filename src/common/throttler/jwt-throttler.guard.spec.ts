import { JwtThrottlerGuard } from './jwt-throttler.guard';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { Request } from 'express';

describe('JwtThrottlerGuard.getTracker', () => {
  const guard = new JwtThrottlerGuard({} as never, {} as never, {} as never);

  const req = (user?: Partial<JwtPayload>, ip?: string) =>
    ({ user, ip }) as Request & { user?: JwtPayload };

  it('uses JWT sub when user present', async () => {
    const result = await guard['getTracker'](req({ sub: 'user-uuid' }));
    expect(result).toBe('user-uuid');
  });

  it('falls back to IP when no user', async () => {
    const result = await guard['getTracker'](req(undefined, '1.2.3.4'));
    expect(result).toBe('1.2.3.4');
  });

  it('falls back to anonymous when no user and no IP', async () => {
    const result = await guard['getTracker'](req(undefined, undefined));
    expect(result).toBe('anonymous');
  });
});
