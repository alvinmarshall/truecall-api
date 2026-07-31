import { HealthCheckError } from '@nestjs/terminus';
import { TruecallerTokenHealthIndicator } from './truecaller-token.health';

const makeIndicator = (getStatus: jest.Mock) => {
  const tokenService = { getStatus } as never;
  return new TruecallerTokenHealthIndicator(tokenService);
};

describe('TruecallerTokenHealthIndicator', () => {
  it('returns healthy when token is valid', async () => {
    const indicator = makeIndicator(
      jest.fn().mockResolvedValue({
        valid: true,
        hoursRemaining: 47,
        expiresAt: new Date(),
      }),
    );

    const result = await indicator.isHealthy('truecallerToken');
    expect(result.truecallerToken.status).toBe('up');
  });

  it('throws HealthCheckError when token is expired', async () => {
    const indicator = makeIndicator(
      jest.fn().mockResolvedValue({
        valid: false,
        hoursRemaining: 0,
        expiresAt: null,
      }),
    );

    await expect(indicator.isHealthy('truecallerToken')).rejects.toThrow(
      HealthCheckError,
    );
  });
});
