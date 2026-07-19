# TrueCall API [![CI](https://github.com/alvinmarshall/truecall-api/actions/workflows/pr.yml/badge.svg)](https://github.com/alvinmarshall/truecall-api/actions/workflows/pr.yml) [![codecov](https://codecov.io/gh/alvinmarshall/truecall-api/branch/main/graph/badge.svg)](https://codecov.io/gh/alvinmarshall/truecall-api)

NestJS proxy for Truecaller phone lookups. Secured via Keycloak JWT. Built for iOS Shortcuts.

## Requirements

- Node 22
- PostgreSQL 16
- Keycloak (realm: `truecall`)

## Setup

```bash
cp .env.example .env
# fill in .env values

yarn install
yarn migration:run
yarn start:dev
```

## Environment

See [.env.example](.env.example) for all required variables.

Generate encryption key:
```bash
openssl rand -hex 32
```

## Migrations

```bash
# generate after entity changes
yarn migration:generate src/migrations/<Name>

# apply
yarn migration:run

# rollback
yarn migration:revert
```

## API

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/lookup?phone=+233xx` | `lookup` role | Phone number lookup |
| `POST` | `/admin/token/request-otp` | `admin` role | Trigger TC auth OTP |
| `POST` | `/admin/token/verify-otp` | `admin` role | Complete TC auth |
| `GET` | `/admin/token/status` | `admin` role | TC token expiry info |
| `GET` | `/health` | public | Liveness / readiness |

All routes except `/health` require a Keycloak JWT (`Authorization: Bearer <token>`).
Tokens issued via client credentials grant from your Keycloak `truecall` realm.
