# Tahfidz Quran — Backend

Node.js/TypeScript REST API for the Tahfidz Quran system. Implements clean
architecture boundaries (`domain -> application -> infrastructure -> presentation`)
as required by the [product specification](../software-requirment.md) in the
main project repository.

## Stack

- **Runtime:** Node.js 20+, TypeScript (strict mode)
- **HTTP framework:** Fastify 4
- **Database:** MySQL 8+ via `mysql2`, hand-written SQL migrations (no ORM)
- **Auth:** JWT access tokens (15 min default) + rotating opaque refresh tokens, bcrypt password hashing
- **Object storage:** any S3-compatible endpoint (AWS S3, MinIO, etc.)
- **Validation:** Zod at the presentation boundary
- **Tests:** Vitest (unit, application, authorization, API contract, migration tests)

## Getting started

```bash
npm install
cp .env.example .env   # adjust DB/S3/secret values
npm run migrate        # applies migrations/*.sql in order, seeds 114 Quran surahs
npm run seed:admin -- admin@example.com "StrongPassw0rd!"
npm run dev
```

The server listens on `PORT` (default `3000`). Health check: `GET /healthz`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the API with hot reload |
| `npm run build` / `npm start` | Production build and run |
| `npm run migrate` | Apply pending SQL migrations (idempotent, tracked in `schema_migrations`) |
| `npm run seed:admin -- <email> <password>` | Bootstrap the first ADMIN user |
| `npm run typecheck` / `npm run lint` / `npm run format` | Static checks |
| `npm test` | Run the Vitest suite (requires a reachable MySQL instance for API/migration tests) |

## Architecture

```
src/
  domain/          entities, value objects (assessment range validation), repository interfaces, typed errors
  application/      use cases, DTOs, authorization checks (authz/authContext.ts)
  infrastructure/    MySQL repositories, JWT/bcrypt/AES adapters, S3 storage, logging, DI container
  presentation/      Fastify routes, Zod validation, auth middleware, error mapping
```

Nothing in `domain/` imports HTTP, MySQL, or Fastify types. `application/`
depends only on domain types and small port interfaces (`PasswordHasher`,
`TokenService`, `ObjectStorage`, ...) implemented under `infrastructure/`.

## Authorization model

- `ADMIN`: full access to all resources.
- `LOCATION_OPERATOR`: read-only context on assigned locations/students, and
  full CRUD **only** on memorization assessments for students within assigned
  locations. All other writes return `403 FORBIDDEN`. See
  `src/application/authz/authContext.ts` and the per-feature use cases, which
  enforce scope independently of route wiring.

## Quran reference data

`migrations/008_create_quran_surahs.sql` creates the table;
`migrations/009_seed_quran_surahs.sql` is generated directly from
[`docs/quran-surah-reference.md`](../docs/quran-surah-reference.md) to avoid
transcription errors, and is covered by `tests/migrations/quranSeed.test.ts`
(114 rows, contiguous numbering, boundary rows 1 and 114).

## Known scope limitations in this scaffold

This is the initial full-spec pass and intentionally leaves some production
concerns as documented follow-ups rather than false completeness:

- Thumbnail generation for activity photos is modeled (`processingStatus`)
  but no worker is wired up yet — photos stay `PENDING` until one is added.
- Virus scanning of uploads is not integrated; `FileUseCases` validates MIME
  type and size only.
- The file-completion idempotency cache is in-memory per process; move to a
  shared store (Redis) before running multiple instances.
- `bcryptjs` is used instead of Argon2id to avoid a native build step; swap
  in `argon2` if the deployment target can compile native modules.
