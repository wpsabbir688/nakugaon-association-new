# Nakugaon Import & Export Owners Association — NEW BUILD

Fresh rebuild from scratch per the Ultimate A–Z Master Prompt (Phases 1–30).

🌐 **Live demo (frontend only):** https://nakugaon-association-new.netlify.app
— GitHub: https://github.com/wpsabbir688/nakugaon-association-new
— Backend API + MongoDB are **not live yet**, so login/member/payment features
show loading/error/empty states until a backend is deployed. Do not present
the frontend alone as the full working system.
The previous project (`~/workspace/nakugaon-association/`, live on Netlify/Render/Neon)
is kept untouched as backup until this build is verified and a cutover is
explicitly confirmed. Do not delete the old project, its repo, or its live DB.

- Organisation: Nakugaon Import & Export Owners Association
  (নাকুগাঁও আমদানি ও রপ্তানিকারক মালিক সমিতি), Nakugaon, Bangladesh
- Currency: BDT / ৳ (integer whole taka — no float money math)
- Language: Bengali default, English secondary (`/bn/...` and `/en/...`)

## Stack

- Frontend: React 19 (JSX only) + Vite 6 + React Router 7 + Tailwind v4 +
  Framer Motion + Lucide + Axios + React Hook Form + Zod + Recharts
- Backend: Node.js + Express (ES modules) + Mongoose/MongoDB + bcrypt +
  JWT in an HttpOnly cookie + Helmet + rate limiting + env CORS allowlist +
  Zod validation + central error handling
- Tests: Vitest + Supertest (server), production build (client)

## Accounting rules (server-authoritative, single owner: `server/src/services/`)

- Outstanding = Opening + Posted Charges − Posted Payments − Approved Credits,
  recomputed from the authoritative ledger.
- Double-entry journals must balance (Debits = Credits) before any write.
- Vehicle: quantity × effective fee. Initial rate ৳50/vehicle (`standard` rule,
  seeded idempotently). No vehicle numbers required.
- Weighbridge initial rates: Bhutan ৳100, Bangladeshi ৳200, Lorry-crab ৳100,
  Trolley ৳300. Every entry stores a fee snapshot; history is never recalculated.
- Server-generated `NAK-0001` member IDs (atomic counter, never reused) and
  `REC-YYYYMMDD-####` payment receipts.
- `Idempotency-Key` on vehicle/weighbridge/payment POSTs. Reversals create
  linked negating entries and preserve the original — posted records and
  members with history are never hard-deleted.
- Overpayment is rejected by default; advance payments only if
  `allowAdvancePayments` is explicitly enabled, tracked as unapplied credit.
- Public member balance is HIDDEN by default until an admin explicitly enables
  disclosure in settings. Public APIs return approved fields only.
- Roles enforced on every backend endpoint: SUPER_ADMIN, MANAGER, ACCOUNTANT,
  OPERATOR, MEMBER, PUBLIC. Members can access only their own records.

## What is intentionally empty / honest

- Site settings (contact, registration number, committee, statistics) stay EMPTY
  until the association confirms them. No AI Studio demo data was imported.
- No fake members, payments, or balances are seeded. Test fixtures are separate
  from production initialisation.
- Password reset is LOG-ONLY until SMTP is configured (the API says so honestly).
- Seed admin only via `npm run seed:admin` with `ADMIN_EMAIL`/`ADMIN_PASSWORD`
  env vars. There is no universal default password in code.

## Run locally (dev)

```bash
# 1. Local MongoDB replica set (dev-only binary, gitignored, already in .local-mongo/)
cd ~/workspace/nakugaon-association-new/.local-mongo
./mongodb-linux-x86_64-ubuntu2204-7.0.24/bin/mongod --replSet rs0 \
  --bind_ip 127.0.0.1 --port 27019 --dbpath ./data --fork --logpath ./mongod.log
# wait until it reports PRIMARY (transactions require a replica set)

# 2. Backend (port 5000) — copy server/.env.example to server/.env first
cd ../server && npm install && npm start

# 3. Frontend (port 5173, /api proxied to localhost:5000)
cd ../client && npm install && npm run dev
```

## Tests (verified 2026-10-25: 16/16 pass, client build passes)

```bash
cd ~/workspace/nakugaon-association-new
# The root node_modules symlink -> server/node_modules is dev-only glue so the
# tests in tests/ (outside server/) resolve supertest/vitest from server/.
# It is gitignored and must exist before running the suite:
ln -s server/node_modules node_modules   # only if the symlink is missing
TEST_MONGODB_URI='mongodb://127.0.0.1:27019/nakugaon-test?replicaSet=rs0' \
  ./server/node_modules/.bin/vitest run tests
cd client && npm run build
```

## Docs

- [docs/AUDIT.md](docs/AUDIT.md) — Phase 1 audit of the old project (read-only)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — architecture plan, API contract,
  accounting formulas, role matrix, risks, checklist

## Known limitations / remaining work

- Production needs a real MongoDB replica set (Atlas) for transactions, SMTP for
  password reset, and object storage for production uploads (local disk in dev).
- No audit-log read endpoint yet (frontend audit page shows no invented logs);
  no member profile-correction endpoint yet (form does not claim success).
- Client does not yet send `Idempotency-Key` on vehicle creates (server supports
  it; double-submit currently relies on button disabling). Member dropdowns cap
  at 100 rows (no search/pagination for larger lists yet).
- Client bundle is ~872 kB (code-splitting is a follow-up, not a failure).
- Live-browser click-through verification has not run (subagents cannot operate
  a live browser) — arrange a browser check of public routes, login gating, and
  staff pages against a running backend before any cutover decision.
- Field-name mapping between frontend forms and backend schemas was defined by
  a shared contract but not exhaustively spot-checked end-to-end for every form.

## Deployment — NOT DONE (needs Sabbir's explicit approvals)

No GitHub repo, Netlify/Render/Atlas account, domain, or cutover has been created
for this build. Exact next steps needing him are listed in the coordinator's
final report: new GitHub repo name approval before any push, production MongoDB
(Atlas) account, SMTP details, confirmed association data (committee, notices,
contact, registration), and an explicit cutover/deletion decision for the old
project only after this build is verified.
