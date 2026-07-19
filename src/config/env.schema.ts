import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  KEYCLOAK_REALM_URL: Joi.string().uri().required(),
  KEYCLOAK_CLIENT_ID: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),

  TC_PHONE_NUMBER: Joi.string().required(),
  TOKEN_TTL_BUFFER_SECONDS: Joi.number().default(43200),

  TELEGRAM_BOT_TOKEN: Joi.string().optional(),
  TELEGRAM_CHAT_ID: Joi.string().optional(),

  ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

  DEFAULT_COUNTRY_CODE: Joi.string().length(2).uppercase().default('GH'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(30),

  CACHE_TTL_SECONDS: Joi.number().default(86400),
});
