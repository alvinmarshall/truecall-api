import { JwtPayload } from './jwt-payload.interface';
import { JwtStrategy } from './jwt.strategy';

const mockConfig = {
  getOrThrow: (key: string) => {
    const values: Record<string, string> = {
      KEYCLOAK_REALM_URL: 'https://keycloak.example.com/realms/truecall',
      KEYCLOAK_CLIENT_ID: 'truecall-api',
    };
    return values[key];
  },
};

jest.mock('jwks-rsa', () => ({
  passportJwtSecret:
    () => (_: unknown, __: unknown, done: (e: null, s: string) => void) =>
      done(null, 'secret'),
}));

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfig as never);
  });

  it('validate returns payload as-is', () => {
    const payload: JwtPayload = {
      sub: 'client-uuid',
      iss: 'https://keycloak.example.com/realms/truecall',
      aud: ['truecall-api'],
      azp: 'truecall-shortcut',
      resource_access: { 'truecall-api': { roles: ['lookup'] } },
      exp: 9999999999,
      iat: 1000000000,
    };

    expect(strategy.validate(payload)).toEqual(payload);
  });
});
