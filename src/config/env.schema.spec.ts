import { envSchema } from './env.schema';

const validEnv = {
  KEYCLOAK_REALM_URL: 'https://keycloak.example.com/realms/truecall',
  KEYCLOAK_CLIENT_ID: 'truecall-api',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/truecall',
  TC_PHONE_NUMBER: '+233201234567',
  TELEGRAM_BOT_TOKEN: 'bot123:ABC-DEF',
  TELEGRAM_CHAT_ID: '123456789',
  ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('envSchema', () => {
  it('accepts valid env', () => {
    const { error } = envSchema.validate(validEnv, { allowUnknown: true });
    expect(error).toBeUndefined();
  });

  it('applies defaults', () => {
    const { value } = envSchema.validate(validEnv, { allowUnknown: true });
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.DEFAULT_COUNTRY_CODE).toBe('GH');
    expect(value.CACHE_TTL_SECONDS).toBe(86400);
    expect(value.THROTTLE_TTL).toBe(60);
    expect(value.THROTTLE_LIMIT).toBe(30);
    expect(value.TOKEN_TTL_BUFFER_SECONDS).toBe(43200);
  });

  it('rejects missing KEYCLOAK_REALM_URL', () => {
    const { error } = envSchema.validate(
      { ...validEnv, KEYCLOAK_REALM_URL: undefined },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('rejects non-uri KEYCLOAK_REALM_URL', () => {
    const { error } = envSchema.validate(
      { ...validEnv, KEYCLOAK_REALM_URL: 'not-a-url' },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('rejects missing DATABASE_URL', () => {
    const { error } = envSchema.validate(
      { ...validEnv, DATABASE_URL: undefined },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('rejects ENCRYPTION_KEY shorter than 64 chars', () => {
    const { error } = envSchema.validate(
      { ...validEnv, ENCRYPTION_KEY: 'a'.repeat(32) },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('rejects non-hex ENCRYPTION_KEY', () => {
    const { error } = envSchema.validate(
      { ...validEnv, ENCRYPTION_KEY: 'z'.repeat(64) },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('rejects invalid NODE_ENV', () => {
    const { error } = envSchema.validate(
      { ...validEnv, NODE_ENV: 'staging' },
      { allowUnknown: true },
    );
    expect(error).toBeDefined();
  });

  it('uppercases DEFAULT_COUNTRY_CODE', () => {
    const { value } = envSchema.validate(
      { ...validEnv, DEFAULT_COUNTRY_CODE: 'gh' },
      { allowUnknown: true },
    );
    expect(value.DEFAULT_COUNTRY_CODE).toBe('GH');
  });
});
