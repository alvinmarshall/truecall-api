import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from './jwt-payload.interface';
import { RolesGuard } from './roles.guard';

const CLIENT_ID = 'truecall-api';

const mockConfig = {
  getOrThrow: () => CLIENT_ID,
};

const mockReflector = (roles: string[] | undefined) => ({
  getAllAndOverride: jest.fn().mockReturnValue(roles),
});

const mockContext = (user?: Partial<JwtPayload>): ExecutionContext =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const guard = new RolesGuard(
      mockReflector(undefined) as unknown as Reflector,
      mockConfig as never,
    );
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('denies when user is missing', () => {
    const guard = new RolesGuard(
      mockReflector(['lookup']) as unknown as Reflector,
      mockConfig as never,
    );
    expect(guard.canActivate(mockContext(undefined))).toBe(false);
  });

  it('allows when user has required role', () => {
    const guard = new RolesGuard(
      mockReflector(['lookup']) as unknown as Reflector,
      mockConfig as never,
    );
    const user: Partial<JwtPayload> = {
      resource_access: { [CLIENT_ID]: { roles: ['lookup'] } },
    };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies when user missing required role', () => {
    const guard = new RolesGuard(
      mockReflector(['admin']) as unknown as Reflector,
      mockConfig as never,
    );
    const user: Partial<JwtPayload> = {
      resource_access: { [CLIENT_ID]: { roles: ['lookup'] } },
    };
    expect(guard.canActivate(mockContext(user))).toBe(false);
  });

  it('allows when user has at least one required role', () => {
    const guard = new RolesGuard(
      mockReflector(['admin', 'lookup']) as unknown as Reflector,
      mockConfig as never,
    );
    const user: Partial<JwtPayload> = {
      resource_access: { [CLIENT_ID]: { roles: ['lookup'] } },
    };
    expect(guard.canActivate(mockContext(user))).toBe(true);
  });

  it('denies when resource_access missing client entry', () => {
    const guard = new RolesGuard(
      mockReflector(['lookup']) as unknown as Reflector,
      mockConfig as never,
    );
    const user: Partial<JwtPayload> = { resource_access: {} };
    expect(guard.canActivate(mockContext(user))).toBe(false);
  });
});
