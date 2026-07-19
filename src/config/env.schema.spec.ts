/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import * as Joi from 'joi';
import { envSchema } from './env.schema';

interface ValidatedEnv {
  PORT: number;
  NODE_ENV: string;
  DEFAULT_COUNTRY_CODE: string;
  CACHE_TTL_SECONDS: number;
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  TOKEN_TTL_BUFFER_SECONDS: number;
}

const validEnv = {
  KEYCLOAK_REALM_URL: 'https://keycloak.example.com/realms/truecall',
  KEYCLOAK_CLIENT_ID: 'truecall-api',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/truecall',
  TC_PHONE_NUMBER: '+233201234567',
  TELEGRAM_BOT_TOKEN: 'bot123:ABC-DEF',
  TELEGRAM_CHAT_ID: '123456789',
  ENCRYPTION_KEY: 'a'.repeat(64),
};

const validate = (env: object) =>
  envSchema.validate(env, {
    allowUnknown: true,
  }) as Joi.ValidationResult<ValidatedEnv>;

describe('envSchema', () => {
  it('accepts valid env', () => {
    const { error } = validate(validEnv);
    expect(error).toBeUndefined();
  });

  it('applies defaults', () => {
    const { value } = validate(validEnv);
    expect(value.PORT).toBe(3000);
    expect(value.NODE_ENV).toBe('development');
    expect(value.DEFAULT_COUNTRY_CODE).toBe('GH');
    expect(value.CACHE_TTL_SECONDS).toBe(86400);
    expect(value.THROTTLE_TTL).toBe(60);
    expect(value.THROTTLE_LIMIT).toBe(30);
    expect(value.TOKEN_TTL_BUFFER_SECONDS).toBe(43200);
  });

  it('rejects missing KEYCLOAK_REALM_URL', () => {
    const { error } = validate({ ...validEnv, KEYCLOAK_REALM_URL: undefined });
    expect(error).toBeDefined();
  });

  it('rejects non-uri KEYCLOAK_REALM_URL', () => {
    const { error } = validate({
      ...validEnv,
      KEYCLOAK_REALM_URL: 'not-a-url',
    });
    expect(error).toBeDefined();
  });

  it('rejects missing DATABASE_URL', () => {
    const { error } = validate({ ...validEnv, DATABASE_URL: undefined });
    expect(error).toBeDefined();
  });

  it('rejects ENCRYPTION_KEY shorter than 64 chars', () => {
    const { error } = validate({ ...validEnv, ENCRYPTION_KEY: 'a'.repeat(32) });
    expect(error).toBeDefined();
  });

  it('rejects non-hex ENCRYPTION_KEY', () => {
    const { error } = validate({ ...validEnv, ENCRYPTION_KEY: 'z'.repeat(64) });
    expect(error).toBeDefined();
  });

  it('rejects invalid NODE_ENV', () => {
    const { error } = validate({ ...validEnv, NODE_ENV: 'staging' });
    expect(error).toBeDefined();
  });

  it('uppercases DEFAULT_COUNTRY_CODE', () => {
    const { value } = validate({ ...validEnv, DEFAULT_COUNTRY_CODE: 'gh' });
    expect(value.DEFAULT_COUNTRY_CODE).toBe('GH');
  });
});
