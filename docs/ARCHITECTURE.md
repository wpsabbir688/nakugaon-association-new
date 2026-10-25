# Nakugaon Association — Backend Architecture (fresh rebuild)

Project: Nakugaon Import & Export Owners Association (নাকুগাঁও আমদানি ও রপ্তানিকারক মালিক সমিতি), Nakugaon, Bangladesh.
Currency: BDT / ৳, **integer whole taka only — no float money math anywhere**.
Language: Bengali default + English (API messages in English; UI strings are the client's job).

> Scope note: this document and `server/` are owned by the backend agent. `client/` is owned
> by another agent and is not touched here. The old project `~/workspace/nakugaon-association/`
> is a read-only backup: never edited, pushed, deployed, or deleted by this backend work,
> and its live database is never touched.

## 1. Stack

- Node 24, Express 4, ES modules (`"type": "module"`).
- Mongoose 8 / MongoDB. bcryptjs, jsonwebtoken (HttpOnly cookie), helmet, express-rate-limit,
  cors (env allowlist), zod validation, multer uploads, winston-style structured logs
  (small built-in JSON logger — no extra dependency weight).
- Tests: Vitest + Supertest. Pure accounting rules live in `src/services/accounting.js`
  with **zero DB dependency** so they are testable even without MongoDB.
- Lint/format: ESLint flat config + Prettier (best-effort; see §8).

## 2. Folder structure

```
server/
  package.json  .env.example  eslint.config.js  .prettierrc
  src/
    index.js            # entry: connect DB, seed chart-of-accounts + default fee rules, listen :5000
    app.js              # express app factory (no listen — testable)
    config/env.js       # env parsing + validation (fails fast on missing JWT_SECRET in prod)
    config/db.js        # mongoose connect/disconnect
    config/logger.js    # JSON structured logger
    errors.js           # ApiError + central error handler, envelope {success,data} / {success:false,error}
    middleware/auth.js  # requireAuth (JWT cookie), requireRole, requireMemberSelf
    middleware/validate.js  # zod body/query validator
    middleware/idempotency.js
    middleware/audit.js # writeAudit() helper (redacts sensitive fields)
    middleware/rateLimit.js
    utils/pagination.js # ?page&limit&search parsing, safe defaults (limit ≤ 100)
    utils/money.js      # int-only helpers (assertIntBDT)
    services/accounting.js  # PURE: outstanding, journal balance, allocation, overpayment
    services/ledger.js      # DB posting: ledger + journal + allocations inside a transaction
    services/ids.js         # atomic Counter (NAK-0001, REC-YYYYMMDD-####)
    services/fees.js        # effective fee lookup (never recalculates history)
    services/audit.js       # (re-exported helper used by routes)
    models/  User, Member, Counter, FeeRule, VehicleEntry, WeighbridgeEntry,
             Payment, PaymentAllocation, LedgerEntry, Account, JournalEntry,
             JournalLine, Expense, Notice, SiteSetting, AuditLog,
             IdempotencyRecord, FileMetadata, ContactMessage
    routes/  auth, members, public, vehicleEntries, weighbridge, payments,
             feeRules, expenses, accounting, dashboard, notices, settings, uploads
  scripts/seed-admin.js # ONLY admin creation path: env vars ADMIN_EMAIL/ADMIN_PASSWORD
  uploads/              # dev local disk only (gitignored); production should use object storage
tests/
  unit/accounting.test.js   # pure rules, no DB
  unit/money.test.js
  integration/*.test.js     # Supertest + mongodb-memory-server (see §7)
```

## 3. API contract

- Versioned base `/api/v1`. Envelope: success → `{success:true, data}`; failure →
  `{success:false, error:{code, message}}`. HTTP status carries the real outcome.
- Pagination on list endpoints: `?page&limit&search`, response
  `{items, page, limit, total, totalPages}`.
- All money is integer BDT. Any non-integer money input is rejected (400), never rounded silently.
- Auth: `POST /auth/login {email,password}` → sets HttpOnly cookie `nakugaon_token`
  (SameSite=Lax, Secure in production). `GET /auth/me`, `POST /auth/logout`.
  Forgot/reset: `POST /auth/forgot-password`, `POST /auth/reset-password`.
  **If no SMTP is configured, reset is log-only and the API says so honestly — it never
  claims an email was sent.** There is NO default password in code. The only admin
  creation path is `node scripts/seed-admin.js` with env vars (fails if the admin exists
  or if env vars are missing).
- Roles on EVERY endpoint (frontend hiding is not security):
  `SUPER_ADMIN, MANAGER, ACCOUNTANT, OPERATOR, MEMBER, PUBLIC`.
  - MEMBER users are linked to one Member record and can access ONLY their own records;
    changing an ID in the URL must return 403, not another member's data.
  - OPERATOR: create vehicle/weighbridge entries and payments; cannot change fees,
    cannot reverse posted records, cannot approve expenses, cannot change settings.
  - ACCOUNTANT: entries, payments, reversals, expenses, reports.
  - MANAGER: everything except settings disclosure changes reserved to SUPER_ADMIN?
    (Settings PATCH is admin-only: SUPER_ADMIN + MANAGER; disclosure flag change is
    audited and requires SUPER_ADMIN — see §5.)
  - PUBLIC: only the `/public/*` endpoints, approved fields only.

## 4. Accounting engine (single source of truth — formulas must not diverge)

```
Outstanding(member) = Opening + Posted Charges − Posted Payments − Approved Credits
```

- Recomputed from the authoritative `LedgerEntry` collection (append-only sum over ALL rows:
  originals + their negating reversal rows cancel exactly — never sum only `status:'posted'`
  rows, which would double-count a reversal), never from a cached
  `Member.balance` field. (Member carries no balance field at all, by design.)
- Every posted business event writes BOTH:
  - `LedgerEntry` rows (member-scoped, debit/credit, sourceType/sourceId), and
  - a balanced `JournalEntry` + `JournalLine` rows (Debits = Credits, enforced in code;
    an unbalanced journal is never saved — `assertBalanced` throws before any write).
- Standard mappings:
  - Vehicle/weighbridge charge: Dr Member Receivables / Cr Vehicle (or Weighbridge) Fee Income
  - Payment: Dr Cash / Cr Member Receivables
  - Approved expense: Dr Operating Expense / Cr Cash
  - Approved credit (advance/unapplied handling): Cr Member Receivables via a credit ledger entry
- Posting is atomic where the DB supports it: all writes for one business event run in
  one Mongoose session transaction. On failure nothing partial remains (no orphan payment,
  ledger, or journal row).
- **Transactions require a MongoDB replica set (or sharded cluster).** A standalone
  `mongod` rejects transactions. Production therefore needs MongoDB Atlas (replica set
  by default) or a self-hosted replica set. See §7 for the local consequence.
- Reversals NEVER hard-delete and NEVER mutate the original: a reversal creates linked
  negating ledger + journal entries (`reversalOf`, `reversedBy`, `reason` required) and
  marks the original `status: 'reversed'`. Historical amounts are never rewritten.
- Fee snapshots: each vehicle/weighbridge entry stores the fee amount and the FeeRule id
  that produced it. Later fee-rule changes NEVER recalculate past entries.
- Overpayment: DEFAULT reject a payment above current outstanding (400 `OVERPAYMENT`).
  Only if `settings.allowAdvancePayments === true` is the excess accepted, recorded as
  a separate unapplied-credit ledger/journal entry (Cr Member Receivables is NOT used
  for the excess; it goes to the Unapplied Member Credits liability account) and shown
  transparently in the member statement as `unappliedCredit`.
- Opening balances: only via an authorized, auditable setup process
  (`POST /members/:id/opening-balance`, SUPER_ADMIN/ACCOUNTANT, with `reason` + audit
  entry, and only while the member has no posted charges yet — otherwise rejected).
  Unknown balances are never silently converted to zero, and balances are never invented.
- Idempotency: `Idempotency-Key` header on POST vehicle/weighbridge/payment.
  Same key + same endpoint + same authenticated user returns the original response
  without re-executing. Keys are scoped per user and retained (no reuse across users).
- Receipts: server-generated `REC-YYYYMMDD-####` (daily sequence, atomic Counter).
  Member IDs: server-generated `NAK-0001` (atomic Counter, monotonic, never reused,
  retired/archived IDs are never recycled). Members with financial history are never
  hard-deleted — `POST /members/:id/archive` only.

## 5. Audit + privacy

- AuditLog records actor, action, recordType/recordId, timestamp, reason, and
  before/after snapshots for: member create/change/archive, opening-balance changes,
  fee-rule create/change, entry create/reversal, payment create/reversal,
  expense approve/reverse, role changes, disclosure-setting changes, settings changes.
- Sensitive fields (passwordHash, reset tokens, bank details, private notes, tokens)
  are REDACTED from audit before/after snapshots and are never returned by any endpoint.
- Audit logs have no public delete/update endpoint; only SUPER_ADMIN may read them
  (`GET /accounting/audit-logs`, staff-only in practice — see routes). Ordinary
  modification/deletion is not exposed.
- Public member projection contains ONLY: memberId, display name, business name,
  membership type/status, joined date. NO phone, email, address, bank, notes, balance —
  unless `settings.publicBalanceDisclosure` is explicitly enabled by a SUPER_ADMIN,
  in which case outstanding (recomputed) may be shown and the enabling change is audited.
- Uploads: multer, 5 MB cap, allowlist (jpeg/png/webp/pdf only — no executables,
  no svg/html), uuid safe filenames, metadata in FileMetadata. Private documents are
  served only to staff or the owning member; nothing under uploads is publicly listed.

## 6. Chart of accounts (seeded on first boot if empty — config, not fake data)

| Code | Name | Type |
|---|---|---|
| 1000 | Cash | Asset |
| 1100 | Member Receivables | Asset |
| 2100 | Unapplied Member Credits | Liability |
| 4000 | Vehicle Fee Income | Income |
| 4100 | Weighbridge Fee Income | Income |
| 5000 | Operating Expense | Expense |

Default weighbridge fee rules seeded on first boot (contract rates, configurable after):
bhutan 100, bangladeshi 200, lorry-crab 100, trolley 300 (BDT).

Vehicle entries are QUANTITY-based, not per-vehicle: one entry = N vehicles, total =
quantity × effective vehicle fee, with NO individual vehicle registration number
required. The default vehicle fee rule is seeded on first boot (idempotently, only
if no vehicle rule exists): scope `vehicle`, category `standard`, ৳50 per vehicle,
effectiveFrom 2026-01-01, reason 'Initial contract rate'. Each entry snapshots
`feePerVehicle`, `totalCharge` (= `feeAmount`, kept so payment allocation, reporting
and dashboard sums are unchanged) and the `feeRule` id; the server calculates the
total and shows it in the created-entry response before any payment. Posting with
no effective vehicle rule is rejected (400 `NO_FEE_RULE`), honestly. The client
vehicle page sends only `{memberId, quantity, entryDate?, notes?}` and displays
the fee-per-vehicle from `GET /api/v1/fee-rules` plus the server-calculated total.

## 7. Technical risks / BLOCKERS (honest status)

1. **No local MongoDB — worked around for dev/tests (2026-10-25).** No `mongod`
   binary was installed and Docker is unavailable. `mongodb-memory-server`'s own
   downloader stalls on this VM (its first download also collided with /tmp being a
   512 MB tmpfs at 91% full). Workaround that WORKS: the official mongod 7.0.24
   binary was downloaded with curl and extracted under `.local-mongo/` (gitignored,
   dev-only), started as a single-node replica set on 127.0.0.1:27019
   (`mongod --replSet rs0 --dbpath .local-mongo/data --fork`), initiated, and left
   running. Integration tests pass against it via
   `TEST_MONGODB_URI='mongodb://127.0.0.1:27019/nakugaon-test?replicaSet=rs0'`
   (see `tests/integration/setup.js`; it drops the test DB first). If that mongod
   is stopped, restart it with the command above from `.local-mongo/`, wait for
   PRIMARY, then rerun. Production still needs a replica set / Atlas deployment
   for transactions (§4) — this local node is dev/test only.
2. **No SMTP configured.** Forgot/reset is log-only until SMTP env vars exist.
   Nothing in code pretends otherwise.
3. **No payment gateway.** Payments here are recorded cash/manual payments with
   receipts, not gateway charges. bKash/Nagad/SSLCommerz are out of scope for this
   backend slice unless a future task supplies credentials — nothing is faked.
4. **Uploads are local disk in dev.** Production needs object storage + private
   signed URLs; the FileMetadata model already separates metadata from storage path
   so the backend can swap without changing the API.
5. **Transactions + idempotency + counters are only as atomic as the deployment.**
   On a standalone mongod, `withTransaction` falls back to non-transactional
   sequential writes and logs a warning — this fallback must never be used in
   production, and startup logs it loudly.
6. **Seeding rule (hard).** Seed scripts NEVER create fake production members,
   payments, or balances. Test fixtures live only in tests. Site settings (contact,
   registration, committee, statistics) stay EMPTY until the association confirms
   them. No AI Studio / demo committee, member, or dues data is imported as real data
   (that data looked demo-seeded: masked sequential phones, inconsistent vehicle totals).

## 8. Checklist

- [x] docs/ARCHITECTURE.md (this file)
- [x] config/env/logging/errors/auth/roles/validation/pagination
- [x] Models (all 18 collections, indexes, timestamps)
- [x] Members + atomic NAK-0001 IDs + archive (no hard delete with history)
- [x] Fee rules + effective-date lookup + snapshots on entries
- [x] Ledger/accounting engine (pure + transactional posting, balanced journals)
- [x] Vehicle entries + reversal + idempotency
- [x] Weighbridge entries + reversal + idempotency (4 contract categories/rates)
- [x] Payments + allocations + REC receipts + reversal + overpayment rule
- [x] Expenses + approve + reverse
- [x] Accounting: ledger view, reconciliation, reports, audit-log read
- [x] Dashboard summary + charts (real aggregates only)
- [x] Notices (publish/unpublish/pin/archive; only published are public)
- [x] Settings (admin-only PATCH, disclosure flag audited, SUPER_ADMIN-gated)
- [x] Public endpoints (approved fields only, balance hidden by default)
- [x] Contact (rate-limited, validated, stored privately)
- [x] Uploads (type/size validation, safe names, private access)
- [x] Seed-admin CLI only (env vars, no default password)
- [x] Unit tests (accounting/money, no DB) — always runnable
- [x] Integration tests (Supertest, 5 tests) — PASS against the local replica set above (TEST_MONGODB_URI); mongodb-memory-server auto-download itself stalls on this VM, so the suite also supports that path but it is not the verified path
- [ ] Production deployment — explicitly OUT of scope for this task (no push, no deploy)
