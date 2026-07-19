import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

const makeReflector = (isPublic: boolean) =>
  ({
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  }) as unknown as Reflector;

const makeContext = () =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('returns true immediately for public routes', () => {
    const guard = new JwtAuthGuard(makeReflector(true));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('delegates to AuthGuard for protected routes', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    const superSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);
    const result = guard.canActivate(makeContext());
    expect(superSpy).toHaveBeenCalled();
    expect(result).toBe(true);
    superSpy.mockRestore();
  });
});
