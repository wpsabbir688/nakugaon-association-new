# Postgres migration (2026-10-25) — MongoDB/Mongoose → Prisma + PostgreSQL

Per the user's explicit instruction ("database change koro, amra age jei
database use kortam seta koro" + "backend code jao ki ki update korte hobe
koro"): the backend data layer was rebuilt from MongoDB/Mongoose to
Prisma 6 + PostgreSQL so the project can use the previous database
platform (Neon Postgres) instead of MongoDB Atlas.

## Hard boundaries honoured

- Work was done ONLY in `nakugaon-association-new/`. The old project
  (`~/workspace/nakugaon-association/`) and its live Netlify/Render/Neon
  deployment were NOT edited, pushed, deployed, deleted, or migrated.
- The new backend is **NOT** pointed at the old live `nakugaon` Neon
  database — pointing at it would break the live site and mix data. The
  new backend reads its database ONLY from the `DATABASE_URL` env var, and
  deployment still needs a **separate** Neon database created for this
  project (see "Still needed" below).
- No `.github/workflows` files, no secrets or connection strings committed,
  no fake members/payments/balances, no AI Studio demo data imported.
- Seed admin ONLY via env vars (`npm run seed:admin`), refusing if
  missing/existing. `npm run replace:admin` is the env-only equivalent
  that deletes other SUPER_ADMINs.

## What changed (file by file)

- `server/prisma/schema.prisma` (new) + `server/prisma/migrations/20261025135558_init_postgres/`
  (new): all 20 models — User, Member, Counter, Account, FeeRule,
  VehicleEntry, WeighbridgeEntry, Payment, PaymentAllocation, LedgerEntry,
  JournalEntry, JournalLine, Expense, Notice, SiteSetting, Leader, AuditLog,
  ContactMessage, FileMetadata, IdempotencyRecord. Status/role/kind/method
  values are plain strings matching the Mongo values exactly (e.g. member
  status `active`/`suspended`/`archived`, ledger kind
  `opening`/`charge`/`payment`/`credit`/`unapplied`).
- `server/src/db/prisma.js` (new): single PrismaClient singleton.
- `server/src/db/serialize.js` (new): wire serializer — every row gets
  `_id` (the Prisma `id`), populated `member` objects serialize
  recursively, User rows never carry `passwordHash`/`resetTokenHash`,
  AuditLog actor columns collapse into an `actor` object, and relation
  fields are aliased to their old names (`feeRuleId` → `feeRule`,
  `createdById` → `createdBy`, etc.).
- `server/src/config/env.js`: `MONGODB_URI` replaced by `DATABASE_URL`
  (required; direct non-pooled URL only — pooled URLs reject Prisma
  interactive transactions, and the server refuses to boot without it).
- `server/src/config/db.js`: mongoose connect/disconnect replaced by
  Prisma `$connect`/`$disconnect` + a `dbConnected()` probe for
  `/settings/status`.
- `server/src/errors.js`: Prisma `P2002` → 409 DUPLICATE, `P2025` → 404.
- `server/src/middleware/auth.js`: user lookup via Prisma; JWT payload
  unchanged (`sub` = row id, `role`); role lists unchanged.
- `server/src/middleware/audit.js`: audit writes via Prisma; accepts a
  transaction client so audit rows join the business transaction.
- `server/src/middleware/idempotency.js`: idempotency records via Prisma
  upsert (unique on user+endpoint+key); stored responses are JSON
  round-tripped (Dates become the same ISO strings Express sends anyway).
- `server/src/utils/pagination.js`: search filter now Prisma
  `contains + mode: insensitive` (was Mongo regex).
- `server/src/services/bootstrap.js`: chart accounts + contract fee rules
  seeded via Prisma upserts/creates (same 6 accounts, same rates).
- `server/src/services/fees.js`: effective-rule query via Prisma
  (latest `effectiveFrom <= at`, not ended, active).
- `server/src/services/ids.js`: atomic counter via Prisma upsert-increment
  (serializes on the row inside a transaction) — same `NAK-0001` and
  `REC-YYYYMMDD-####` formats.
- `server/src/services/ledger.js`: `withTransaction` is now a real Prisma
  interactive transaction (`prisma.$transaction`) — there is NO
  sequential-write fallback any more (the Mongo version fell back loudly
  on non-replica-set deployments; Postgres transactions always apply, so
  the fallback is gone by design). `postJournal`/`postLedger`/
  `reverseLedgerAndJournal`/`memberOutstanding`/`outstandingCharges`
  keep the same append-only reversal semantics.
- `server/src/services/settings.js`: single `site` settings row via Prisma.
- `server/src/services/accounting.js`: UNCHANGED (pure functions, no DB).
- `server/src/routes/*.js` (all 15): same paths, same validation, same
  role checks, same response shapes — Mongoose queries replaced by
  Prisma queries, every response passed through the serializer. Helpers:
  `resolveMember` accepts a NAK id or a row id; `dateRange` returns
  Prisma `{gte, lte}` bounds; dashboard daily charts group in JS by UTC
  date (same as Mongo `$dateToString`).
- `server/src/scripts/seed-admin.js` / `replace-admin.js`: same env-only
  behaviour via Prisma (replace-admin deletes other SUPER_ADMINs, then
  creates/promotes the env account).
- `server/src/models/` (Mongoose): DELETED.
- `server/package.json`: `mongoose` + `mongodb-memory-server` removed;
  `@prisma/client@6.5.0` + `prisma@6.5.0` added; scripts
  `prisma:generate` / `prisma:migrate` / `prisma:deploy` added.
- `server/.env.example`: `DATABASE_URL` (direct, non-pooled) replaces
  `MONGODB_URI`, with the old-live-database warning.
- `server/scripts/local-postgres.sh` (new): starts a disposable local
  Postgres 16 cluster for dev/tests (initdb refuses root, so it runs as
  the `postgres` system user; data in `/tmp/nakpg`).
- `tests/integration/setup.js`: drops the `public` schema and runs
  `prisma migrate deploy` against `DATABASE_URL`, then bootstraps.
  The suite DROPS the database schema — never point it at a real DB.
- `tests/integration/flow.test.js`: model-direct calls switched to
  Prisma (`prisma.user.create`, `prisma.auditLog.findFirst`); all API
  assertions unchanged.
- Client: UNCHANGED (no file touched). BN/EN dictionaries still 170/170
  with zero diff.

## API contract changes (honest list)

- `_id` values are now Prisma cuid strings (e.g. `cmvnwe3nh...`) instead
  of 24-hex Mongo ObjectIds. The client already treats `_id`/`id` as
  opaque, and `resolveMember` accepts both NAK ids and row ids, so no
  client change was needed. Any external caller that validated `_id`
  as a 24-hex ObjectId must stop doing so.
- `settings/status` now reports `db: { connected, readyState }` where
  `readyState` is `1` when a `SELECT 1` probe succeeds, `0` otherwise
  (previously the Mongoose readyState number).
- Everything else — route paths, response envelopes
  `{success, data}`, pagination shapes, error codes, fee snapshots,
  receipt/member-id formats, idempotency, reversal and overpayment
  rules — is unchanged.

## Rules preserved (verified by the suite, not just claimed)

6 roles server-enforced; integer-BDT accounting
(Outstanding = Opening + Posted Charges − Posted Payments − Approved
Credits, recomputed from the ledger); balanced double-entry journals;
vehicle ৳50/entry; weighbridge Bhutan ৳100 / Bangladeshi ৳200 /
Lorry-crab ৳100 / Trolley ৳300 with per-entry fee snapshots and
future-only fee changes; atomic NAK-0001 ids (never reused);
REC-YYYYMMDD-#### receipts; Idempotency-Key on vehicle/weighbridge/
payment POSTs; reversals as linked negating entries (never hard-delete
records/members with history); overpayment rejected by default; public
balance hidden by default; audit log; leaders; chart of accounts;
settings/status; change-password endpoint; replace-admin script.

## VM quirk: Prisma engines (local only, not a repo problem)

On this VM, Node's fetch to `binaries.prisma.sh` is reset by the egress
proxy, so `npm install` of Prisma fails at the `@prisma/engines`
postinstall and `prisma generate` fails until the engines are present.
Workaround used here (gitignored `node_modules` only, never committed):
install with `npm install --ignore-scripts`, then copy/copy-download the
`debian-openssl-3.0.x` engines (`libquery_engine…so.node`,
`schema-engine…`, `query-engine…`) into `node_modules/@prisma/engines/`
and `node_modules/prisma/`. Render/Neon deploys download engines normally
— this quirk does not affect production.

## Run locally (Postgres)

```bash
bash server/scripts/local-postgres.sh   # local cluster on 127.0.0.1:5433
cd server && npm install
DATABASE_URL='postgresql://nakugaon@127.0.0.1:5433/nakugaon_dev' npm run prisma:deploy
DATABASE_URL='postgresql://nakugaon@127.0.0.1:5433/nakugaon_dev' npm start
```

## Tests (verified 2026-10-25)

```bash
cd ~/workspace/nakugaon-association-new
DATABASE_URL='postgresql://nakugaon@127.0.0.1:5433/nakugaon_test' \
  ./server/node_modules/.bin/vitest run tests
# 28/28 pass (20 integration + 8 unit); client build passes; BN/EN 170/170.
# The suite DROPS the test database schema — disposable DB only.
```

## Still needed (NOT done — needs the parent/user, no push/deploy made)

1. Create a SEPARATE Neon database for this project (new database, not
   the old live `nakugaon` one) and take its DIRECT (non-pooled) URL.
2. Deploy the backend to Render (free): root `server`, build
   `npm install && npx prisma migrate deploy`, start `npm start`, env
   `DATABASE_URL` (direct URL), `JWT_SECRET`, `CORS_ORIGIN` =
   the Netlify URL. Then run `replace:admin` once via a one-time build
   command with `ADMIN_EMAIL`/`ADMIN_PASSWORD` host env vars (same
   pattern as the old project), then revert the build command.
3. Set `VITE_API_URL` on the Netlify site to the new Render API URL and
   redeploy the frontend, then verify live login end-to-end in a browser.
4. Live-browser click-through (login → dashboard → leaders/ledger/
   accounts) against the deployed backend — not possible from a generic
   subagent; arrange via the parent.
