# TrueCall API — Implementation Plan

> Production-grade NestJS proxy for Truecaller lookups.
> Client: iOS Shortcuts. Region focus: Ghana / West Africa.
> Server: Hetzner EX44. Deploy: Docker → internal registry.

---

## Phases

Each phase = one branch. Tests (unit + integration) ship in the same branch, not after.
Commit messages: short summary only.

| Phase | Branch | Scope | Status |
|-------|--------|-------|--------|
| 1 | `phase/1-scaffold` | Config module, env Joi schema, main.ts (helmet, pino, ValidationPipe), remove boilerplate | ✅ |
| 2 | `phase/2-auth` | JwtStrategy (jwks-rsa), JwtAuthGuard, RolesGuard, @Roles decorator, AuthModule | ✅ |
| 3 | `phase/3-throttling` | JWT sub-keyed ThrottlerGuard, common filter + logging interceptor + phone util | ✅ |
| 4 | `phase/4-token-mgmt` | TokenService (OTP flow, AES-256-GCM), TokenController /admin/token/*, TokenScheduler (Telegram) | ⬜ |
| 5 | `phase/5-cache` | Postgres-backed cache (LookupCache entity), cache-aside pattern wired | ⬜ |
| 6 | `phase/6-lookup` | LookupController, LookupService, TruecallerService (circuit breaker), AuditService + Postgres | ⬜ |
| 7 | `phase/7-health` | HealthController (/health, no auth), Redis + DB + TC token indicators | ⬜ |
| 8 | `phase/8-docker` | Dockerfile (multi-stage, --require instrumentation), docker-compose.yml (dev + Keycloak + Postgres), docker-compose.prod.yml (joins monitoring network), nginx.conf, Keycloak realm fixture | ⬜ |

### Tests per phase

| Phase | Unit tests | Integration tests |
|-------|-----------|-------------------|
| 1 | Joi schema rejects bad env | — |
| 2 | Guard returns 401 on missing JWT, 403 on wrong role | Full request cycle: valid JWT → 200, no JWT → 401, wrong role → 403 |
| 3 | Throttle key = JWT sub | 429 after limit exceeded |
| 4 | Encrypt/decrypt round-trip, OTP state machine, Telegram payload shape | /admin/token/request-otp → 200, /admin/token/verify-otp bad OTP → 400 |
| 5 | Cache key normalisation | Cache HIT skips TruecallerService call |
| 6 | Phone E.164 normalisation, response DTO mapping, circuit breaker opens | Full lookup: cache miss → Truecaller call → cached response; 503 on no TC token |
| 7 | — | /health → 200 all up; /health → 503 when Redis down |
| 8 | — | docker-compose up → /health 200 |

---

## Observability

Existing VPS stack: **Prometheus + Mimir + Loki + Tempo + Pyroscope + OTel Collector + Grafana Alloy**.
Services push via OTLP gRPC to `collector:4317`. No manual Grafana setup needed.

### How this API integrates

| Signal | How | Destination |
|--------|-----|-------------|
| Traces | OTel SDK auto-instruments HTTP + TypeORM | Tempo via collector:4317 |
| Logs | nestjs-pino JSON to stdout → Alloy ships | Loki |
| Metrics | OTel SDK (HTTP durations, custom counters) | Prometheus/Mimir via collector |

### Implementation
- `src/instrumentation.ts` — OTel SDK init, loaded before app bootstrap via `--require`
- Dockerfile CMD: `node --require ./dist/instrumentation ./dist/main`
- OTEL env vars in docker-compose (see Docker section)

### Packages (added to Phase 1 deps)
```
@opentelemetry/sdk-node
@opentelemetry/auto-instrumentations-node
@opentelemetry/exporter-trace-otlp-grpc
@opentelemetry/exporter-metrics-otlp-grpc
@opentelemetry/exporter-logs-otlp-grpc
```

### OTEL env vars (docker-compose)
```yaml
OTEL_SERVICE_NAME: truecall-api
OTEL_RESOURCE_ATTRIBUTES: service=truecall-api,service.name=truecall-api,env=production
OTEL_TRACES_EXPORTER: otlp
OTEL_LOGS_EXPORTER: otlp
OTEL_METRICS_EXPORTER: otlp
OTEL_EXPORTER_OTLP_ENDPOINT: http://collector:4317
OTEL_EXPORTER_OTLP_PROTOCOL: grpc
```

---

## Database & ORM

**ORM:** TypeORM (`@nestjs/typeorm` + `typeorm` + `pg`)
**Migrations:** TypeORM CLI via `src/data-source.ts`

```bash
# generate
typeorm migration:generate src/migrations/<Name> -d src/data-source.ts
# run (dev)
typeorm migration:run -d src/data-source.ts
# run (prod / Docker entrypoint)
node dist/data-source.js migration:run
```

**Entities / tables:**
| Entity | Table | Purpose |
|--------|-------|---------|
| `LookupCache` | `lookup_cache` | Postgres-backed cache (phone → result + expires_at) |
| `AuditLog` | `audit_log` | Every lookup event |
| `TcToken` | `tc_tokens` | Encrypted installationId + expiry |
| `TokenEvent` | `token_events` | OTP/verify lifecycle log |

**No Redis** — Postgres handles cache, token storage, throttle state not persisted (in-memory, single instance).

---

## Key Research Findings (truecallerjs)

- Auth flow: **phone OTP → installationId** (two-step)
- Session TTL: **259 200 s = 3 days** — not months
- **No programmatic refresh** — must redo OTP when token expires
- installationId stored in local JSON file by default; we override to Redis
- Bulk search: up to 30 numbers per request
- Headers sent: `Authorization: Bearer <installationId>`, UA spoofs Android app

Token strategy: store installationId + expiry in Redis (encrypted at rest).
Admin endpoints drive OTP flow. Background cron alerts before expiry via Telegram.

---

## Architecture

```
iOS Shortcut
  │  1. POST /realms/{realm}/protocol/openid-connect/token
  │     grant_type=client_credentials → access_token (JWT)
  │  2. GET /lookup?phone=+233xxxxxxxx
  │     Authorization: Bearer <access_token>
  ▼
┌─────────────────────────────────────────────────────┐
│  Nginx (TLS termination, IP rate limit)             │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│  NestJS App (Resource Server)                       │
│  ├── Helmet + CORS (locked)                         │
│  ├── JwtAuthGuard  ◄── validates JWT via Keycloak   │
│  │     passport-jwt + jwks-rsa (JWKS endpoint)      │
│  ├── RolesGuard  ◄── checks JWT role claims         │
│  ├── ThrottlerGuard  ◄── keyed by JWT sub claim     │
│  ├── ValidationPipe (class-validator, whitelist)    │
│  │                                                  │
│  ├── LookupModule                    role: lookup   │
│  │     ├── LookupController  GET /lookup            │
│  │     ├── LookupService                            │
│  │     ├── TruecallerService (truecallerjs wrapper) │
│  │     └── AuditService (writes lookup log)         │
│  │                                                  │
│  ├── TokenModule  /admin/token/*     role: admin    │
│  │     ├── POST /admin/token/request-otp            │
│  │     ├── POST /admin/token/verify-otp             │
│  │     ├── GET  /admin/token/status                 │
│  │     └── TokenScheduler (cron expiry watcher)     │
│  │                                                  │
│  └── HealthModule  GET /health  (public)            │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    PostgreSQL
    ├── lookup_cache  (TTL-based cache)
    ├── audit_log
    ├── tc_tokens     (encrypted installationId)
    └── token_events

          ▲
    Keycloak (existing)
    ├── Realm: your-realm
    ├── Client: truecall-api      ← this API (resource server)
    ├── Client: truecall-shortcut ← iOS Shortcut service account
    └── Roles: lookup, admin
```

---

## Keycloak Setup (one-time, in your existing Keycloak)

### 1. Create client `truecall-api`
- Client type: `bearer-only` (resource server — never issues tokens itself)
- Client authentication: OFF
- This is the audience NestJS validates `aud` claim against

### 2. Create client roles on `truecall-api`
- `lookup` — can call `GET /lookup`
- `admin` — can call `/admin/token/*`

### 3. Create client `truecall-shortcut` (iOS Shortcuts service account)
- Client type: confidential
- Grant type: **client credentials**
- Assign role `lookup` from `truecall-api`
- iOS Shortcut uses `client_id` + `client_secret` to get JWT — no user login needed

### 4. Your personal Keycloak user
- Assign role `admin` from `truecall-api` to your user
- Use **password grant** (or Keycloak UI) to get admin token when managing TC token

### iOS Shortcut token acquisition (step added before lookup call)
```
POST https://keycloak.yourdomain.com/realms/{realm}/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=truecall-shortcut
client_secret=<secret>

→ { "access_token": "eyJ...", "expires_in": 300 }
```
Shortcut caches this token and reuses until expiry. On 401 → re-fetch.

---

## Modules & Responsibilities

### ConfigModule (`@nestjs/config` + Joi)
Validates all env vars at startup — app refuses to start if invalid.

```
PORT=3000
NODE_ENV=production

# Keycloak (Resource Server)
KEYCLOAK_REALM_URL=https://keycloak.yourdomain.com/realms/your-realm
KEYCLOAK_CLIENT_ID=truecall-api          # for aud claim validation
# JWKS fetched automatically from:
# ${KEYCLOAK_REALM_URL}/protocol/openid-connect/certs

# Truecaller
TC_PHONE_NUMBER=+233xxxxxxxxx            # your personal number for OTP

# Cache
REDIS_URL=redis://redis:6379
CACHE_TTL_SECONDS=86400                  # 24h lookup cache
TOKEN_TTL_BUFFER_SECONDS=43200           # alert 12h before TC token expiry

# Database
DATABASE_URL=postgresql://...

# Alerts (Telegram)
TELEGRAM_BOT_TOKEN=                      # from @BotFather
TELEGRAM_CHAT_ID=                        # your personal chat ID

# Encryption (for installationId at rest)
ENCRYPTION_KEY=<32-byte-hex>             # AES-256-GCM key

# Region
DEFAULT_COUNTRY_CODE=GH
```

---

### Auth Layer

#### JwtStrategy (`passport-jwt` + `jwks-rsa`)
```typescript
// Fetches Keycloak public keys dynamically — handles key rotation automatically
jwks-rsa.passportJwtSecret({
  jwksUri: `${KEYCLOAK_REALM_URL}/protocol/openid-connect/certs`,
  cache: true,
  rateLimit: true,
})

// Validates:
//   - signature (via JWKS)
//   - exp (not expired)
//   - iss = KEYCLOAK_REALM_URL
//   - aud includes KEYCLOAK_CLIENT_ID
```

#### RolesGuard + `@Roles()` decorator
Reads `resource_access['truecall-api'].roles` from JWT payload.
```typescript
@Get('lookup')
@Roles('lookup')   // → 403 if role missing
async lookup() {}

@Post('admin/token/request-otp')
@Roles('admin')    // → 403 if not admin
async requestOtp() {}
```

#### ThrottlerGuard (custom subclass)
Keys throttle store by JWT `sub` claim (Keycloak user/client UUID).
- iOS Shortcut service account: throttled as single principal regardless of IP
- `30 req/min` default
- Returns `429` with `Retry-After`

---

### TokenModule (Truecaller OTP — Critical Path)

Token lifecycle:

```
TC token expired / first run
      │
      ▼
POST /admin/token/request-otp             [role: admin]
      │  truecallerjs.login(TC_PHONE_NUMBER)
      │  → requestId stored in Redis (TTL 5 min)
      │  → SMS OTP sent to TC_PHONE_NUMBER
      ▼
POST /admin/token/verify-otp { otp }      [role: admin]
      │  truecallerjs.verifyOtp(requestId, otp)
      │  → installationId encrypted (AES-256-GCM) → Redis
      │  → expiresAt = now + 259200s → Redis
      │  → token_events row written to Postgres
      ▼
TokenScheduler (cron: every 6h)           [internal]
      │  checks Redis expiry
      │  if hoursRemaining < 12:
      │    → Telegram: "⚠️ TC token expires in Xh — run /admin/token/request-otp"
      ▼
GET /admin/token/status                   [role: admin]
      → { valid: true, expiresAt: "...", hoursRemaining: 47 }
```

**Encryption:**
- `ENCRYPTION_KEY` → AES-256-GCM key
- installationId encrypted before Redis write, decrypted only in `TruecallerService`
- IV stored alongside ciphertext in Redis (`iv:ciphertext` base64)

---

### LookupModule

**Endpoint:**
```
GET /lookup?phone=<number>    [role: lookup]
```

**Flow:**
1. Validate + normalize `phone` to E.164 via `libphonenumber-js` (default country: `GH`)
2. Cache key: `lookup:<e164>`
3. Redis HIT → return with `"cached": true`
4. Redis MISS → `TruecallerService.search(e164)`
5. Write to Redis (TTL: `CACHE_TTL_SECONDS`)
6. Write audit log row (async, non-blocking — `setImmediate`)
7. Return result

**Response (200):**
```json
{
  "phone": "+233xxxxxxxxxx",
  "name": "Kwame Mensah",
  "score": 0.92,
  "carrier": "MTN Ghana",
  "lineType": "mobile",
  "country": "GH",
  "spamScore": 0,
  "isSpam": false,
  "cached": false,
  "lookedUpAt": "2026-07-19T10:00:00.000Z"
}
```

**Error responses:**
```
400 – invalid / unrecognized phone number
401 – missing or invalid JWT
403 – valid JWT but missing required role
404 – number not found in Truecaller
429 – rate limit exceeded
502 – Truecaller upstream error
503 – TC installationId expired, re-auth needed
```

**TruecallerService internals:**
- 503 when no valid installationId in Redis
- Retry: 2 retries, 500ms → 1000ms backoff (transient upstream only)
- Circuit breaker (`cockatiel`): open after 5 consecutive failures, half-open after 30s
- Raw truecallerjs response mapped to clean DTO (no internal fields leaked)

---

### AuditModule

Postgres table `audit_log`:
```sql
id           uuid primary key default gen_random_uuid()
phone_e164   text not null
result_name  text
cached       boolean
duration_ms  integer
kc_sub       text            -- JWT sub claim (Keycloak user/client UUID)
kc_client_id text            -- JWT azp claim (which client called)
created_at   timestamptz default now()
```
Non-blocking write. Enables: usage analytics, abuse detection per principal.

---

### HealthModule (`@nestjs/terminus`)

`GET /health` — **public, no auth:**
```json
{
  "status": "ok",
  "info": {
    "redis":           { "status": "up" },
    "database":        { "status": "up" },
    "truecallerToken": { "status": "up", "hoursRemaining": 47 }
  }
}
```
Returns `503` if any critical check fails. Used for Docker `HEALTHCHECK`.

---

### Logging

- `nestjs-pino` — structured JSON logs to stdout (Docker picks up)
- Correlation ID (`x-request-id`) on every request
- Log shape: `{ requestId, method, path, statusCode, durationMs, kcSub, kcClientId, phone }`
- Phone masked in logs: `+233xxx****`
- JWT validation failures logged at `warn` with reason

---

## Security Checklist

- [x] TLS termination at Nginx
- [x] `helmet` — HSTS, no-sniff, frame deny, CSP
- [x] CORS: `origin: false` (iOS Shortcuts is not a browser)
- [x] JWT auth via Keycloak — signature + exp + iss + aud validated
- [x] JWKS auto-fetched (handles Keycloak key rotation transparently)
- [x] Role-based access (`lookup` vs `admin`) enforced via JWT claims
- [x] Rate limiting per JWT `sub` (principal identity, not IP)
- [x] Nginx IP-based rate limit as outer layer
- [x] installationId AES-256-GCM encrypted at rest in Redis
- [x] Input validation + `whitelist: true` strips unknown fields
- [x] E.164 normalization prevents injection + cache key collisions
- [x] Audit log stores `kc_sub` + `kc_client_id` (no secrets in DB)
- [x] Fail-fast env validation (Joi at startup)
- [x] Circuit breaker on Truecaller upstream
- [x] Docker: non-root user, read-only FS where possible
- [x] Secrets via env file (never baked into image)
- [x] No API secrets shared with iOS Shortcut (only Keycloak client credentials)
- [x] Token revocation: disable Keycloak client → all tokens invalid immediately

---

## Docker Setup (Hetzner EX44)

### Services (docker-compose.prod.yml)
```
truecall-api   — NestJS (multi-stage, non-root user)
redis          — Redis 7 Alpine, AOF persistence
postgres       — Postgres 16 Alpine
nginx          — TLS, proxy, IP rate limit
```
Keycloak runs separately on same server (existing — not managed here).

### Multi-stage Dockerfile
```
Stage 1 (build):  node:22-alpine → yarn install → nest build
Stage 2 (run):    node:22-alpine → prod deps only + dist
                  USER node (UID 1000)
                  HEALTHCHECK: wget -qO- localhost:3000/health
```

### Registry Flow
```
Local: docker build → docker push registry.internal/truecall:<git-sha>
Hetzner: docker pull → docker-compose up -d --no-deps truecall-api
```

---

## File Structure (target)

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   └── env.schema.ts                   # Joi validation
├── auth/
│   ├── jwt.strategy.ts                 # passport-jwt + jwks-rsa
│   ├── jwt-auth.guard.ts               # global guard
│   ├── roles.guard.ts
│   ├── roles.decorator.ts              # @Roles('lookup')
│   └── auth.module.ts
├── token/
│   ├── token.module.ts
│   ├── token.controller.ts             # /admin/token/*
│   ├── token.service.ts                # OTP flow + encrypt/decrypt
│   ├── token.scheduler.ts              # cron + Telegram alert
│   └── dto/
│       ├── request-otp.dto.ts
│       └── verify-otp.dto.ts
├── lookup/
│   ├── lookup.module.ts
│   ├── lookup.controller.ts
│   ├── lookup.service.ts               # cache-aside
│   ├── truecaller.service.ts           # truecallerjs + circuit breaker
│   ├── audit.service.ts
│   └── dto/
│       ├── lookup-query.dto.ts
│       └── lookup-response.dto.ts
├── health/
│   ├── health.module.ts
│   └── health.controller.ts
└── common/
    ├── filters/
    │   └── http-exception.filter.ts    # uniform error envelope
    ├── interceptors/
    │   └── logging.interceptor.ts
    ├── throttler/
    │   └── jwt-throttler.guard.ts      # keys throttle by JWT sub
    └── utils/
        └── phone.util.ts               # E.164 normalize + mask
docker/
├── Dockerfile
├── docker-compose.yml                  # local dev
├── docker-compose.prod.yml
└── nginx/
    ├── nginx.conf
    └── ssl/                            # certs (gitignored)
```

---

## Dependencies

```bash
# Runtime
yarn add truecallerjs \
  @nestjs/config @nestjs/throttler \
  @nestjs/terminus @nestjs/schedule \
  @nestjs/passport passport passport-jwt jwks-rsa \
  @nestjs/typeorm typeorm pg \
  helmet nestjs-pino pino-http \
  class-validator class-transformer \
  libphonenumber-js \
  cockatiel \
  joi \
  axios

# Dev
yarn add -D @types/passport-jwt @types/pg
```

---

## iOS Shortcut Spec

```
Step 1 — Get token from Keycloak
  URL:    https://keycloak.yourdomain.com/realms/{realm}/protocol/openid-connect/token
  Method: POST
  Body:   grant_type=client_credentials
          client_id=truecall-shortcut
          client_secret=<secret>
  → Store access_token

Step 2 — Lookup
  URL:    https://truecall.yourdomain.com/lookup?phone=[URL-encoded phone]
  Method: GET
  Header: Authorization: Bearer [access_token]
          Accept: application/json
  → Parse JSON

Step 3 — Display
  name = result["name"] ?? "Unknown"
  Show notification: "[name] — [phone]"
```

---

## Open Questions / Decisions

- [x] **Truecaller token TTL**: 3 days — admin OTP flow in API
- [x] **Hosting**: Hetzner EX44 + Docker + internal registry
- [x] **Region**: Ghana primary, West Africa supported (E.164 default: `GH`)
- [x] **Auth**: Keycloak resource server (JWT) — replaces API keys
- [x] **Alert channel**: Telegram bot → personal chat
- [x] **TC account**: personal number
- [ ] **Cache purge**: Add `DELETE /admin/cache/:phone` endpoint? (useful when name changes)
- [x] **Keycloak realm name**: `truecall`
- [ ] **Postgres on same host?**: EX44 has headroom; local Postgres fine at this scale

---

## Discussion Log

### 2026-07-19 — Initial plan + research
- TC token TTL confirmed: **3 days** (259200s)
- No programmatic refresh — OTP re-auth via admin endpoints
- Decided: Redis (cache + encrypted TC token) + Postgres (audit)
- Decided: Hetzner EX44, Docker, internal registry
- Region: Ghana / West Africa, E.164 default `GH`
- Production-grade: circuit breaker, structured logs, non-root Docker, encrypted secrets

### 2026-07-19 — Dev docker-compose + realm finalized
- Realm: `truecall`
- Auth: client credentials only (no password/implicit grants)
- Two service-account clients: `truecall-shortcut` (lookup) + `truecall-admin` (admin)
- Dev docker-compose: Keycloak + Redis + Postgres (app runs locally via `yarn start:dev`)
- Keycloak realm auto-imported via JSON fixture on first `docker-compose up`

### 2026-07-19 — Auth upgrade to Keycloak
- Replaced API key guard with Keycloak JWT resource server pattern
- `passport-jwt` + `jwks-rsa` — validates JWT, handles Keycloak key rotation automatically
- Two roles: `lookup` (iOS Shortcut) and `admin` (you, for TC token management)
- iOS Shortcut uses `client_credentials` grant — no user login, just client_id + secret
- Throttler now keys by JWT `sub` claim instead of API key
- Audit log stores `kc_sub` + `kc_client_id` instead of key hash
- Revocation: disable Keycloak client → instant lockout, no redeploy
- Decided: Telegram bot for TC token-expiry alerts
- Decided: personal number for Truecaller account login
