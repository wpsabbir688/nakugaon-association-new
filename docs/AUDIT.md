# PHASE 1 AUDIT — Old Nakugaon Association Project (READ-ONLY)

**Scope:** Phase 1 audit only. No code in the old project was edited, committed,
pushed, deployed, or deleted. No `git checkout` / `stash` / `clean` and no
`npm install` were run inside the old project. No live login was attempted and
no live database was accessed.

**Old project audited:** `~/workspace/nakugaon-association/`
**Live references only (not visited, not logged in, nothing changed):**
frontend on Netlify, API on Render, Neon PostgreSQL. Live behaviour is
**not** claimed anywhere in this report unless it is also visible in code.

**Audit date:** 2026-10-25 (Asia/Dhaka).
**Method:** read source files only — `package.json` files, `client/src`
(pages / routes / components / i18n), `server/src` (routes / controllers /
services / middleware / validators), Prisma schema and migrations, the single
test file, docs, and `netlify.toml`. No test suite was executed and no server
was started as part of this audit, so test pass/fail claims below are
**reported from the project's own docs, not re-verified**.

**No secrets are reproduced in this report.** No password, token, or database
connection string appears here, including values that exist only as local
development fallbacks or placeholders in the old repo.

---

## 1. Working-tree state at audit time (important — do not lose this)

- Current branch: `nakugaon-ai-studio-parity` (HEAD commit `dd81ee6`,
  "Fix admin dashboard: stop refresh retry loop, Dhaka day range, faster
  queries, split chart bundle").
- Other local branches seen: `main`, `mongodb-legacy` (the pre-Prisma
  MongoDB/Mongoose version). Remote branches: `origin/main`,
  `origin/mongodb-legacy`.
- **The tree is DIRTY — uncommitted parity work from a cancelled task.**
  Modified (9 files):
  - `client/src/components/ui.jsx`
  - `client/src/i18n/dictionaries.js`
  - `client/src/pages/public/directory.jsx`
  - `client/src/pages/public/static.jsx`
  - `server/prisma/schema.prisma`
  - `server/src/app.js`
  - `server/src/constants.js`
  - `server/src/routes/public.js`
  - `server/tests/api.test.js`
- Untracked (2 items):
  - `server/prisma/migrations/20261025160000_committee_and_inquiries/`
  - `server/src/routes/committee.js`
- The dirty changes add, in substance: a `CommitteeMember` model and a
  public `Inquiry` model, staff committee/inquiry routes, public
  `/committee`, `/fee-rules`, and `/inquiries` endpoints, committee/tariff
  public pages, extra i18n keys, and two new API tests for those pages.
  They also change the header/footer navigation (see §7 — the new links
  point at routes that do not exist in `App.jsx`).
- **Do not clean or commit this state on the basis of this audit.** The
  rebuild must decide explicitly whether to adopt, redo, or discard the
  parity changes; the committed history alone does not contain them.
- One consequence for reading this report: findings marked **(dirty)**
  exist only in the uncommitted tree, not on any committed branch.

---

## 2. Stack and layout (verified from package files)

| Layer | Verified |
|---|---|
| Frontend | React 19, React Router 7, Vite 6, Tailwind CSS v4 (`@tailwindcss/vite`), Axios, React Hook Form + `@hookform/resolvers` + Zod, Lucide icons, Recharts 2 (lazy-loaded on the dashboard only). JavaScript/JSX only, no TypeScript. `client/package.json` has only `build` / `dev` / `preview` scripts — no test or lint script. |
| Backend | Node + Express 4 (ES modules), Prisma 6 (`@prisma/client` 6.5.0), PostgreSQL. `bcrypt`, `jsonwebtoken`, `cookie-parser`, `cors`, `helmet` 8, `express-rate-limit` 7, `multer`, `zod`. Dev deps: `prisma`, `vitest` 3, `supertest` 7. |
| Root | `package.json` only wires `dev` (concurrently server + client) and `install:all`. No root test/lint/CI script. |
| Data history | Originally MongoDB/Mongoose (branch `mongodb-legacy`, first backend commit `54409f3`), ported to Prisma/PostgreSQL in commit `95ef1e3`. The Prisma schema deliberately serializes internal `id` as `_id` as well, so the old Mongo-era `/api/v1` response contract and the React client did not have to change. |
| Docs in repo | `README.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md`, `docs/INSTALL.md`, `docs/TESTING.md`. Docs are unusually honest (see §9). |
| CI / workflows | **None found.** No `.github/` directory, no `render.yaml`, no Dockerfile in the old project. Deployment is manual (see §10). |
| Scripts (server) | `start`, `dev`, `test` (vitest), `prisma:generate/migrate/deploy`, `create-admin` (real admin, password via environment), `seed` (fictional demo data, gated behind an explicit environment flag; see §8). |

---

## 3. Frontend: pages and routes

### 3.1 Route structure (`client/src/App.jsx`)

All routes live under `/:lang/*`; unknown languages redirect to `/bn`.
`LanguageProvider` wraps every language subtree; `AuthProvider` wraps all.

Public (under `PublicLayout`):

| Route | Page |
|---|---|
| `/:lang/` | Home |
| `/:lang/about` | About |
| `/:lang/members` | Public member directory (search + pagination) |
| `/:lang/members/:memberId` | Public member profile + balance summary |
| `/:lang/outstanding` | Public outstanding list |
| `/:lang/notices` | Published notices |
| `/:lang/contact` | Contact + public inquiry form |
| `/:lang/privacy` | Privacy |
| `/:lang/login` | Login |

Staff admin (under `AdminLayout`, client-side staff-role gate only — see §5):

`/:lang/admin`, `/members`, `/members/:memberId`, `/vehicles`,
`/weighbridge`, `/payments`, `/ledger`, `/reports`, `/fees`, `/notices`,
`/expenses`, `/audit`, `/users`, `/settings`.

Member portal (under `MemberLayout`, client-side MEMBER-role gate only):

`/:lang/portal`, `/portal/ledger`, `/portal/profile`.

Language: Bengali + English via `client/src/i18n/dictionaries.js`
(one dictionary object per language; the committed code was checked for
key parity in docs — see §9). Currency is formatted as `৳` with
`en-US` grouping (`client/src/utils/format.js`).

### 3.2 What the frontend actually does

- **Home:** live member count (`GET /public/members?limit=1` meta total),
  latest 2 published notices, live fee rules.
- **Public directory/profile/outstanding:** search, pagination, and a
  per-member balance summary (see the summary bug in §6.5).
- **Admin dashboard** (`pages/admin/Dashboard.jsx` + lazy
  `DashboardCharts.jsx`): stat cards (active members, today's vehicles /
  vehicle charges / weighbridge charges / payments, total outstanding) +
  14-day vehicle trend, weighbridge-by-category, payment trend,
  top-outstanding charts (Recharts) + recent transactions table.
  "Today" and trend dates are computed in Asia/Dhaka (UTC+06:00, no DST),
  not server time — a real fix recorded in commit `dd81ee6`.
- **Admin ops** (`pages/admin/ops.jsx`): create member, archive member,
  member detail (ledger + cached/computed balance badge), vehicle entry
  form, weighbridge entry form, vehicle/weighbridge lists, payment form
  (with print-receipt button via `window.print()`), payment list with
  reverse button, ledger lookup by member ID, fee-rule editing.
- **Admin misc** (`pages/admin/misc.jsx`): reports (JSON view + CSV
  downloads), notices (publish/unpublish), expenses, audit log viewer,
  user creation + activate/deactivate, site settings form.
- **Member portal** (`pages/member/portal.jsx`): own outstanding balance,
  recent ledger rows, full statement with client-side CSV download, own
  profile (read-only; text states edits are handled by staff).
- **Auth client** (`services/api.js`, `contexts/AuthContext.jsx`):
  Axios with `withCredentials`, access token kept in memory only (never
  localStorage), one automatic refresh retry on 401 with an explicit guard
  so a refresh call never triggers another refresh (the unbounded retry
  loop fixed in `dd81ee6`). Login redirects MEMBER → portal, staff → admin.

---

## 4. Backend: endpoints and auth

Base path `/api/v1`, plus `GET /health` (returns `db: up/down` via
`SELECT 1`). JSON body limit 1 MB. All mutating financial writes run
inside Prisma interactive transactions (see §6).

### 4.1 Endpoint inventory (verified from `server/src/app.js` + routers)

| Router | Endpoints |
|---|---|
| `auth` | `POST /login` (rate-limited), `POST /refresh`, `POST /logout` (auth), `GET /me` (auth), `POST /request-reset` (rate-limited), `POST /reset-password` |
| `public` (no auth) | `GET /members`, `GET /members/:memberId`, `GET /outstanding`, `GET /notices` (published only), `GET /settings` (allow-listed keys only), **(dirty)** `GET /committee`, `GET /fee-rules`, `POST /inquiries` |
| `members` (auth) | `GET /` (list; MEMBER role force-scoped to own record), `GET /:memberId`, `POST /`, `PATCH /:memberId` (opening balance explicitly omitted — cannot be changed after creation), `POST /:memberId/archive`, `POST /:memberId/photo` (upload), `GET /:memberId/ledger`, `GET /:memberId/balance` |
| `vehicles` | `GET /` (filters: memberId, from, to), `POST /` |
| `weighbridge` | `GET /categories` (auth, no permission check beyond login), `GET /` (filters: memberId, category, from, to), `POST /` |
| `payments` | `GET /` (filters: memberId, method, from, to), `GET /:id`, `POST /`, `POST /:id/reverse` |
| `fee-rules` | `GET /`, `PATCH /:id` (SUPER_ADMIN only) |
| `reports` | `GET /vehicles`, `/weighbridge`, `/outstanding`, `/payments`, `/income-expense` — JSON or `format=csv` |
| `notices` | `GET /` (staff), `POST /`, `PATCH /:id` |
| `settings` | `GET /`, `PUT /` (SUPER_ADMIN only) |
| `audit` | `GET /` (SUPER_ADMIN only) |
| `admin` | `GET /dashboard`, `GET /users`, `POST /users`, `PATCH /users/:id/status`, `POST /reconcile` (all user management + reconcile SUPER_ADMIN only; dashboard needs `reports:read`) |
| `expenses` | `GET /`, `POST /` |
| `committee` **(dirty, untracked file)** | `GET /`, `POST /`, `PATCH /:id` (staff, `committee:write`) |
| `inquiries` **(dirty, untracked file)** | `GET /`, `PATCH /:id` (mark read; staff, `committee:write`) |

### 4.2 Auth mechanism (verified)

- **Access token:** JWT, 15 minutes, sent as `Authorization: Bearer`.
- **Refresh token:** JWT, 7 days, HttpOnly cookie (`nakugaon_refresh`,
  path-scoped to `/api/v1/auth`), stored server-side only as a SHA-256
  hash, rotated on every refresh. Production cookies are
  `SameSite=None; Secure`; local dev uses `Lax` without Secure.
- **Passwords:** bcrypt, cost factor 12. User creation requires ≥ 8
  characters; reset requires 8–128.
- **Password reset:** token is random 32 bytes, stored hashed, 1-hour
  expiry, and the reset invalidates the refresh token. **But there is no
  email delivery:** without SMTP configured the token is only written to
  the server log and is never returned by the API — so in production the
  reset flow is effectively unusable until SMTP is configured, and there
  is **no forgot-password UI at all** (the login page has no reset link).
- **Single-session side effect:** each login overwrites the stored
  refresh-token hash, so a second login invalidates the first session.
  Not documented as a feature; the rebuild should decide explicitly
  whether multi-device sessions are allowed.
- **No self-service password change:** there is no change-password
  endpoint or UI for a logged-in user. Only SUPER_ADMIN user creation
  and the (undeliverable without SMTP) reset flow exist.

### 4.3 Roles and permissions (`server/src/constants.js`)

Roles: `SUPER_ADMIN` (`*`), `MANAGER`, `ACCOUNTANT`, `OPERATOR`, `MEMBER`.
Enforcement is server-side via `requireAuth` + `requirePermission` /
`requireRole`, plus an own-record guard for MEMBER users
(`requireOwnMemberOrStaff` helper exists, and member routes additionally
apply an inline `ownMemberGuard`).

| Role | Permissions (summary) |
|---|---|
| SUPER_ADMIN | everything, incl. fee-rule changes, user management, settings, audit log, reconcile |
| MANAGER | members read/write/archive, vehicles + weighbridge read/write, payments read, ledger read, reports read, notices write, fees read, **(dirty)** committee write |
| ACCOUNTANT | members/vehicles/weighbridge read, payments read/write/reverse, ledger read, reports read, expenses read/write |
| OPERATOR | members read, vehicles + weighbridge read/write only |
| MEMBER | `portal:read`, `members:read`, `ledger:read` — always scoped to the linked member record; list endpoint returns only their own record, ledger/balance endpoints reject other members |

Notable permission gaps (by design or omission — rebuild should confirm):
MANAGER cannot write payments or expenses; ACCOUNTANT cannot write
members/vehicles/weighbridge; OPERATOR cannot read payments, reports, or
fees (but the weighbridge categories endpoint requires only login, so an
OPERATOR can still see live category fees); MEMBER cannot read payments,
reports, or expenses endpoints at all.

---

## 5. Security controls — verified present, and gaps

**Present and worth preserving:**

- `helmet` (CSP and COEP explicitly disabled), `x-powered-by` disabled,
  `trust proxy: 1`.
- CORS restricted to a single configured frontend origin with
  credentials; not a wildcard.
- Zod validation on essentially every body/query that takes input
  (pagination capped at 100/page; search strings capped; amounts are
  integers). Prisma queries are parameterized; search uses Prisma
  `contains + insensitive` (no operator injection path in code).
- Rate limits: auth endpoints 50 / 15 min; all `/api` 1000 / 15 min
  (`express-rate-limit`, standard headers).
- Error handler returns structured `{ error: { code, message } }`,
  maps Prisma `P2002` → 409 and `P2025` → 404, and never leaks stack
  traces to clients.
- Public-field filtering is explicit and good: `publicMember()` exposes
  only memberId, businessName, ownerName, profile image, status, joining
  date, outstanding balance, updatedAt — never phone, address, father's
  name, notes, or auth/audit data. `safeUser()` similarly strips password
  and token hashes. Committee model deliberately stores no phone/email.
  Public settings are allow-listed to six display keys even though staff
  settings can store any key.
- Member photo upload: 2 MB cap, JPG/PNG/WebP mimetype filter, random
  filename (timestamp + random hex) — never the user-supplied name.
- CSV export escapes formula-injection leading characters (`=`, `+`,
  `-`, `@`, tab, CR) by prefixing a quote.
- Audit log rows for login, member create/update/archive, vehicle /
  weighbridge / payment create, payment reverse, fee update, expense
  create, notice create, committee create (dirty), settings update, user
  create, and reconcile — with actor, action, entity, and IP.

**Gaps / risks for the rebuild (all verified in code):**

1. **Fail-open environment defaults.** `server/src/config/env.js`
   supplies fallback values for JWT secrets and for the local database
   connection when the corresponding environment variables are absent.
   The server will start in that state instead of refusing to boot.
   Production must fail closed when secrets are unset. (Values are
   deliberately not reproduced here.)
2. **No audit rows for some privileged actions.** User activate/
   deactivate, notice publish/unpublish (PATCH), committee PATCH, and
   inquiry mark-read write no audit row, unlike the creates listed above.
3. **Uploads are publicly served without authentication.**
   `/uploads` is `express.static` for anyone who knows/guesses a
   filename. The mimetype filter is client-claimed mimetype only (not
   content sniffing), and the file extension is taken from the
   user-supplied original name, so a staff account could store an
   unexpected extension. Filenames are random, which mitigates guessing
   but is not access control. No malware scanning.
4. **No per-endpoint rate limit on refresh or on the public inquiry
   form.** Refresh relies only on the global 1000/15 min limiter, and
   the public inquiry endpoint has no CAPTCHA or stricter limit, so it
   can be spammed up to the global limit.
5. **Client-side gates are not authorization.** `AdminLayout` and
   `MemberLayout` show "Access denied" screens, but real enforcement is
   server-side (good) — the rebuild must keep it that way and not rely
   on hiding nav items (the admin nav shows Users / Audit / Settings
   links to every staff role even though those endpoints are
   SUPER_ADMIN-only; clicking them just fails).
6. **Refresh-cookie cross-site posture is intentional but must be
   re-checked** for the new deployment's origins (production uses
   `SameSite=None; Secure`, which requires HTTPS on both ends).
7. **Demo seed account risk (process, not code defect).** The gated
   demo seed creates a demo SUPER_ADMIN with a hard-coded password and
   six fictional members. Docs repeatedly warn never to run it against
   production, but nothing technically prevents it — the rebuild must
   keep demo seeding out of production paths and rotate/remove any
   demo credential if it ever touched a live database. (The password
   value is not reproduced here.)

---

## 6. Financial logic — the core of this audit

Money is integer Bangladeshi Taka everywhere in the schema and in
validation (`weightKg` is the only float, and it is not money).
Fee snapshots are stored on each entry, so fee-rule changes never rewrite
history — verified in code and covered by a test (see §9).

### 6.1 Ledger service (`server/src/services/ledgerService.js`)

- `computeBalance(memberId)` = `member.openingBalance` +
  `SUM(ledgerEntry.amount)` for that member.
- `appendLedger()` recomputes that balance, adds the new row's amount,
  stores it as the row's `runningBalance`, and updates the member's
  cached `outstandingBalance` to the same value. Callers run inside a
  Prisma transaction.
- `postCharge()` = ledger row + balanced journal
  (Dr RECEIVABLE / Cr fee-income account).
- `postPayment()` = negative ledger row + journal
  (Dr CASH/BANK / Cr RECEIVABLE) + FIFO allocation rows against the
  oldest positive charge rows (vehicle, weighbridge, other, **and
  OPENING**). Allocations are explicitly informational; the ledger is
  authoritative. If a posting has no Payment record id (e.g. demo seed
  direct postings), allocations are skipped.
- `postJournal()` enforces in code that debits equal credits and the
  total is positive. Journal lines are JSON (`[{ accountCode, debit,
  credit }]`), **not** foreign keys to the `Account` table, and the
  income-account code is not validated against the seeded chart of
  accounts — a typo'd account code would still be written.
- `reverseLedger()` never deletes: it appends a negating `REVERSAL` row,
  links it via `reversalOfId`, refuses to reverse a reversal, refuses a
  second reversal of the same row, and mirrors the original journal
  entry by swapping debit/credit. Opening rows have no journal entry, so
  nothing is mirrored for them (see the lookup caveat in §6.4).
- `reconcileAll()` (SUPER_ADMIN `POST /admin/reconcile`) recomputes every
  member's cached balance from `computeBalance()` and overwrites the
  cache where it differs. The member-detail page shows an
  "In sync / OUT OF SYNC — run reconcile" badge from
  `GET /members/:memberId/balance`.

### 6.2 ⚠️ CRITICAL — Opening-balance double-count: CONFIRMED present

The flagged pattern is **still in the code**, in
`server/src/routes/members.js` (member creation) combined with
`computeBalance()` in `ledgerService.js`. Walked through exactly:

1. Creation sets **both**:
   - `member.openingBalance = X`, **and**
   - `member.outstandingBalance = X`.
2. If `X > 0`, creation **also** inserts a ledger row:
   `kind = 'OPENING', amount = X, runningBalance = X`.
3. `computeBalance()` returns `openingBalance + SUM(all ledger rows)`.
   Immediately after creation, that is `X + X = 2X` — before any charge
   or payment exists.

Consequences, all following from the code (no live data was inspected):

- **Every member created with an opening balance > 0 is double-counted
  by the computed balance.** The cached balance starts at `X` (correct
  at creation) but the computed balance is `2X`, so
  `GET /members/:memberId/balance` reports `inSync: false` for such a
  member from day one, and the admin detail page shows the red
  "OUT OF SYNC" badge.
- **Reconcile does not fix it — it propagates it.** `reconcileAll()`
  overwrites the cached balance with the computed (double-counted)
  value, so after a reconcile the member's displayed outstanding
  balance becomes `2X` plus later activity, and the badge flips to
  "In sync" while the number is wrong.
- **The first later posting bakes the error in.** `appendLedger()`
  starts from `computeBalance()` (already `2X`), so the first charge or
  payment after creation sets the cached balance to `2X ± amount`,
  even without any reconcile.
- **The OPENING row's own `runningBalance` is inconsistent** with the
  formula: it is stored as `X`, while `computeBalance()` at that moment
  says `2X`.
- **The public summary disagrees a third way.** `balanceSummary()` in
  `public.js` sums only VEHICLE / WEIGHBRIDGE / OTHER charges,
  payments, and credits — it **excludes OPENING entirely**, so the
  public profile's charges/payments/credits do not reconcile to the
  public outstanding balance for any member with an opening balance.
- **There is no correction path.** Member PATCH explicitly omits
  `openingBalance`, so staff cannot fix a wrong opening balance through
  the API, and there is no UI for editing a member at all (see §7).
  The only remedies in the old code are direct database edits or a
  compensating reversal/credit — neither is a supported flow.

**Required fix in the rebuild (decision, not just a patch):** pick
exactly one source of truth and enforce it — either (a) the OPENING
ledger row is the sole source and `openingBalance` becomes display-only
/ zero in the formula, or (b) there is no OPENING row and
`computeBalance()` = `openingBalance + SUM(non-opening rows)`.
Whichever is chosen, the migration of the one real live member's
history must be verified row-by-row against the association's paper
records before cutover, because a naive data copy preserves the
double-count. This report does **not** state what the live member's
opening balance is — that was not inspected and must not be assumed.

### 6.3 Fee rules and snapshots

- Default fees (seeded on server start by `referenceData.js`, idempotent
  upserts): vehicle per unit ৳50; weighbridge Bhutan ৳100, Bangladeshi
  ৳200, Lorry/crab ৳100, Trolley ৳300.
- Vehicle posting reads the live `VEHICLE_PER_UNIT` rule and stores
  `feePerVehicle` + `total = quantity × feePerVehicle` on the entry;
  weighbridge posting reads the live category rule and stores `fee`.
  If the rule is missing/inactive the request fails cleanly with
  "not configured" and nothing is posted.
- Fee changes are SUPER_ADMIN-only and change only the rule amount
  (label/category/active cannot be changed through the endpoint).
  Historical entries keep their snapshot.
- Public tariffs (dirty) read live active rules, so the public Rules
  page cannot drift from posted charges.

### 6.4 Idempotency, reversals, and concurrency

- **Idempotency (present, with a race):** vehicle, weighbridge, and
  payment creates accept an optional client-supplied `idempotencyKey`.
  The handler first looks up an existing record by that key and returns
  it with `duplicate: true`; the key is also unique in the schema for
  those three tables. **But the lookup happens outside the transaction,**
  so two concurrent submissions with the same key can both pass the
  lookup and then collide on the unique constraint — the second gets a
  generic 409 `DUPLICATE`, not the original record. The ledger row's own
  `idempotencyKey` is **not** unique in the schema, so ledger-level
  de-duplication relies entirely on the parent record's key.
- **Client-generated keys weaken the protection in practice:** the
  admin vehicle/weighbridge/payment forms generate a fresh random key
  on every submit (`<kind>-<timestamp>-<random>`), so an accidental
  double-click or a retry after a successful save creates a *new* key
  and a second posting. Idempotency only helps API callers who reuse a
  key deliberately. The rebuild should use a stable key per form
  submission (e.g. generated once when the form opens, or a
  submit-button disable + request deduplication).
- **Payment receipts:** `REC-YYYYMMDD-####` from an atomic
  `Counter` upsert-increment inside the transaction; member IDs
  `NAK-0001…` use the same counter mechanism. Receipt and member-ID
  uniqueness under concurrency is sound in code.
- **Balance-cache race:** `appendLedger()` reads the balance, then
  writes a row and overwrites the cached balance, without a row lock
  (`SELECT … FOR UPDATE`) or a serializable guard. Two concurrent
  postings for the same member can read the same starting balance,
  produce identical `runningBalance` values, and leave the cached
  balance equal to only one of the two postings (the ledger rows
  themselves still sum correctly, so a later reconcile restores the
  cache — subject to the §6.2 double-count). The rebuild should lock
  the member row inside the posting transaction.
- **Reversal coverage is payment-only from the API.** `reverseLedger()`
  itself is generic, but the only exposed reversal endpoint is
  `POST /payments/:id/reverse` (ACCOUNTANT `payments:reverse`
  permission, reason required, payment marked `REVERSED`, second
  reversal rejected both by payment status and by `reversalOfId`).
  There is **no endpoint or UI to reverse a vehicle or weighbridge
  charge**, and no generic ledger-reversal endpoint. A wrong charge can
  only be corrected by a payment/reversal workaround or direct DB work.
- **Reversal journal lookup is loose.** `reverseLedger()` finds the
  original journal with `findFirst({ referenceType, referenceId })`
  with no ordering and no uniqueness guarantee on that pair. It works
  today because each charge/payment creates exactly one journal row
  with that pair — but a reversal journal is created with the *same*
  pair, so the lookup's correctness depends on `findFirst` returning
  the original rather than a prior reversal. Combined with the
  reversal-of-reversal guard this is low-risk today, but the rebuild
  should link journals explicitly (e.g. store the journal id on the
  ledger row) instead of matching on a non-unique pair.
- **Overpayment** becomes a negative outstanding (credit) balance and
  is never silently discarded or refunded — documented and implemented
  in the payment route comment and code. There is no refund flow.
- **Expenses are journaled correctly:** expense creation writes a
  balanced journal (Dr EXPENSE / Cr CASH-or-BANK) in the same
  transaction as the expense row. Good — preserve this.
- **Weighbridge void is dead code in practice:** the schema has
  `EntryStatus` (`POSTED` / `VOIDED`) and the dashboard aggregates only
  `POSTED` weighbridge rows, but no endpoint ever sets `VOIDED`, and
  the weighbridge *report* does not filter by status at all. If a void
  path is ever added, the report must filter consistently.

### 6.5 Other financial gaps

- **No OTHER_CHARGE / CREDIT endpoint exists**, even though the
  `LedgerKind` enum, FIFO allocation, reports, and the public summary
  all reference those kinds, and the README formula mentions
  "Approved Credits". Staff cannot record a miscellaneous charge or an
  approved credit through any API or UI — only through direct database
  work or the demo seed's direct ledger calls.
- **Income/expense report semantics are mixed:** `income` = sum of
  charge ledger rows in the range (accrual), `paymentsCollected` = sum
  of POSTED payments (cash), `expenses` = sum of expense rows. All
  three are returned side by side with no label in the JSON explaining
  that income is not cash collected; the admin reports page shows the
  raw numbers. The rebuild should label accrual vs. cash explicitly.
- **Outstanding report ignores its date range:** `GET /reports/outstanding`
  accepts `from`/`to` but returns the current cached outstanding for
  all ACTIVE members regardless of range. The vehicle/weighbridge/
  payment reports do honour their ranges (and member filter).
- **Archived members disappear from finance views:** charges/payments
  require an ACTIVE member, and dashboard/outstanding aggregates filter
  to ACTIVE. That is reasonable for operations, but there is no
  "archived member history" view and no unarchive endpoint — archiving
  is one-way through the API.

---

## 7. Incomplete / broken UI and endpoints (verified in code)

1. **Public Committee and Rules pages are unreachable (dirty-tree
   breakage).** The dirty header/footer link to `/committee` and
   `/rules`, and the dirty `static.jsx` defines `CommitteePage` and
   `RulesPage` — but `App.jsx` was **not** modified, so it has no
   routes for either path. An unmatched language-subtree route falls
   through to the catch-all redirect, so those nav links do not land
   on the intended pages. (In the committed tree the header did not
   link to them at all; the dirty tree added the links without the
   routes.) The dirty header also drops the `/outstanding` nav link
   even though the route still exists.
2. **No admin UI for committee or inquiries.** The dirty staff
   committee/inquiry APIs exist, but there is no admin page, nav item,
   or form for them anywhere in `client/src`. Staff management of
   those records is API-only in the dirty tree.
3. **No member-edit UI and no photo-upload UI.** The server supports
   `PATCH /members/:memberId` and `POST /members/:memberId/photo`, but
   the admin UI only creates and archives members; the member-detail
   page is read-only. Member profile edits therefore require API calls
   or DB access.
4. **No password flows in the UI.** No change-password screen, no
   forgot-password screen, no reset-password screen — despite the
   server reset endpoints existing. Combined with the missing SMTP
   delivery (§4.2), password recovery is effectively unavailable to
   end users.
5. **No unarchive, no member delete** (delete is arguably correct —
   financial history must never be hard-deleted — but unarchive is a
   genuine missing operation).
6. **No charge-reversal UI or endpoint** (see §6.4); only payment
   reversal exists.
7. **No OTHER_CHARGE / CREDIT creation** (see §6.5).
8. **Exports are CSV only, stated honestly in code and docs.**
   `AdminReports` notes in the UI itself that binary Excel and PDF
   exports are not implemented. Member statement CSV is generated
   client-side from already-fetched rows (limit 100) — a member with
   more than 100 ledger rows gets a truncated "full" statement.
   Admin ledger lookup is likewise capped at 100 rows with no
   pagination control in that view (the API itself paginates).
9. **Uploads are local-only; S3 is documented as future work, not
   implemented.** The environment template even warns not to set the
   S3 driver. Uploads also have no guarantee the upload directory
   exists at runtime (multer is given the directory without a
   create-if-missing step in the route) — a deployment detail the
   rebuild should verify rather than assume.
10. **No SMS, no payment gateway, no email** — cash/bank recording
    only. Nothing in code claims otherwise; the rebuild must not
    present gateway support as existing.
11. **Frontend has no automated tests and no lint configuration.**
    All quality gates are the single server test file (see §9).

---

## 8. Data model (Prisma schema — verified)

Models: `User`, `Member`, `Counter`, `FeeRule`, `VehicleEntry`,
`WeighbridgeEntry`, `LedgerEntry`, `Payment`, `PaymentAllocation`,
`Account`, `JournalEntry`, `Expense`, `Notice`, `CommitteeMember`
**(dirty)**, `Inquiry` **(dirty)**, `SiteSetting`, `AuditLog`.

- Member public key is `memberId` (`NAK-0001…`, unique); internal `id`
  is an opaque cuid. `Member.notes` is staff-only by convention (never
  serialized publicly) — the rebuild should keep that field out of
  every public serializer by construction, not by remembering.
- `Member.isDemo` flags demo-seeded rows; `Member.status` is
  ACTIVE/ARCHIVED. `openingBalance` and `outstandingBalance` are both
  integers with default 0 (see §6.2 for why both existing is the bug).
- `LedgerEntry`: signed `amount`, `runningBalance`, `kind` enum,
  `reference`/`referenceType`/`referenceId`, self-referential
  `reversalOfId` (unique), `reversalReason`, nullable
  `idempotencyKey` (**not unique** — see §6.4), optional links to one
  vehicle / weighbridge / payment row each.
- `Payment`: unique `receiptNumber`, unique nullable `idempotencyKey`,
  unique nullable `ledgerEntryId`, status POSTED/REVERSED.
- `JournalEntry`: JSON `lines`, self-referential `reversalOfId`
  (unique). `Account` rows are seeded (RECEIVABLE, VEHICLE_INCOME,
  WEIGHBRIDGE_INCOME, OTHER_INCOME, CASH, BANK, EXPENSE) but, as noted
  in §6.1, journal lines do not reference them by foreign key.
- Migrations present: `20261024095510_init_postgres` (committed) and
  `20261025160000_committee_and_inquiries` (**untracked, dirty**).
  The dirty migration creates the two new tables; it has not been
  applied to any database by this audit and its applied/pending state
  on the live database is **not verified**.
- Seed behaviour on every server start: fee rules + chart of accounts
  upserted idempotently (`referenceData.js`). Demo seed is a separate
  gated script (6 fictional members + demo charges/payments + a demo
  admin); it must never run against real data.

---

## 9. Tests and documentation — what is claimed vs. what was checked

- **One test file only:** `server/tests/api.test.js` (252 lines).
  Counting its `it()` blocks in the current (dirty) tree gives **16
  tests**, covering: sequential member IDs, auth/role rejection,
  vehicle charge math + idempotent duplicate rejection, weighbridge fee
  preservation after a rule change, payment math / partial payment /
  overpayment-as-credit / single reversal / operator forbidden,
  public-field filtering, member cross-access forbidden, public
  directory without auth, dashboard-vs-ledger consistency, **(dirty)**
  committee empty-then-publish + tariffs/inquiry storage, and
  transaction rollback on a failed vehicle entry.
- **Discrepancy to note:** `docs/TESTING.md` claims the suite is
  "18/18 green" (and describes the same suite), but the file as read
  contains 16 `it()` blocks. Whether the docs count includes setup
  checks or are simply stale was not determined — the rebuild should
  recount after restoring the suite rather than quoting "18/18".
- **Test setup (from the file header, not executed):** tests need a
  local PostgreSQL database (default via a local Unix-socket URL,
  overridable by environment) and truncate tables per run. No test
  covers: the opening-balance path (§6.2 — the most consequential gap;
  no test creates a member with a non-zero opening balance and then
  checks `computeBalance`), concurrent postings, reversal of a charge,
  OTHER_CHARGE/CREDIT, expense journaling, photo upload, settings,
  audit-log contents, or any frontend behaviour.
- **Docs quality is high and unusually candid** — worth carrying over
  as a practice: README states plainly what is *not* verified
  (Playwright E2E not run), what is *not* implemented (Excel/PDF
  exports, S3 uploads, email delivery, payment gateways), that official
  contact/registration data is intentionally empty until the
  association supplies it, and that demo data is fictional. The
  deployment doc is explicitly "documentation only; nothing
  provisioned" — which is now stale in one respect: a live deployment
  does exist (see §10), but this audit did not verify it.
- `docs/API.md` documents endpoints, roles, idempotency, and receipts
  but predates the dirty committee/inquiry endpoints.

---

## 10. Deployment configuration (verified from files, not from live)

- **Frontend:** `netlify.toml` — base `client`, build
  `npm run build`, publish `dist`, SPA fallback `/* → /index.html`
  (200). No environment-specific config in the repo; the client reads
  the API base from `VITE_API_URL` with a `/api/v1` fallback, and the
  Vite dev server proxies `/api` to `localhost:4001`.
- **Backend:** no Render/Railway/Fly config file in the repo. Docs
  describe the required production setup: Node host, `prisma migrate
  deploy`, direct (non-pooled) Postgres URL because PgBouncer
  transaction-mode pooling breaks Prisma interactive transactions,
  `CLIENT_URL` set to the exact frontend origin, JWT secrets from
  environment, uploads on local disk. Whether the live Render service
  actually matches that description was **not verified**.
- **Live references (from the task brief, not observed):** Netlify
  frontend, Render API, Neon Postgres. No claim is made here about
  their current health, version, data, or configuration.
- **Branding assets:** none found. There is no `public/` directory and
  no logo, favicon, or image file anywhere under `client/` (outside
  `node_modules`/`dist`). Branding in the old project is entirely
  text + typography (Hind Siliguri + Inter via Google Fonts) + a
  Tailwind theme (navy `#0b2545` family + teal accents) + the
  organisation name strings in the i18n dictionaries. Any logo or
  official artwork for the rebuild must be supplied by the association;
  nothing should be copied from the old build because there is nothing
  to copy.

---

## 11. What works (preserve in the rebuild)

1. **Double-entry ledger + journal discipline** — charges, payments,
   expenses, and payment reversals all post a ledger row and a
   balanced journal inside one transaction, with an audit row. The
   *shape* is right; only the opening-balance formula and the
   journal-linking looseness (§6) need fixing.
2. **Fee snapshots** — historical charges survive fee-rule changes.
3. **Receipt and member-ID sequencing** — atomic counters, unique
   constraints, human-readable `NAK-…` / `REC-…` formats.
4. **Idempotency design** (parent-record unique keys + duplicate
   returns) — needs the race and client-key fixes in §6.4, not a
   redesign.
5. **Role model + own-record scoping** — least-privilege permissions
   and server-enforced member scoping, with explicit public-field
   filtering. The permission table in §4.3 is a good starting point.
6. **Dhaka-day dashboard** — fixed UTC+06:00 day windows and Dhaka
   trend grouping; do not regress to server-local dates.
7. **Refresh-token rotation + in-memory access tokens + the
   refresh-loop guard** in the client.
8. **Honest docs and honest empty states** — no invented official
   data, no fake gateways, CSV-only exports labelled as such, demo
   data clearly flagged. The rebuild should keep this standard.
9. **Public transparency pages** — directory, outstanding list,
   notices, and (dirty) committee/tariffs — with phone/address/notes
   never exposed. The *intent* is right even though the dirty pages
   are currently unrouted (§7.1).
10. **Reconcile + balance-consistency badge** — a genuinely useful
    operations control; in the rebuild it should report the truth
    (after the §6.2 fix) rather than legitimise a wrong number.

## 12. Risk register (prioritised for the rebuild)

| # | Risk | Severity |
|---|---|---|
| R1 | Opening-balance double-count (§6.2): every member with opening > 0 is overstated; reconcile propagates it; no correction path | **Critical — fix before any data migration** |
| R2 | Live data unknown: the one real member's history, balances, and whether the dirty migration is applied live were not inspected and must be reconciled against paper records before cutover | Critical (process) |
| R3 | Balance-cache race under concurrent postings (§6.4) — wrong `runningBalance`/cache until reconcile | High |
| R4 | Fail-open env defaults for secrets/DB (§5.1) | High |
| R5 | Public committee/rules pages unrouted in the dirty tree (§7.1) — nav links dead | High (user-facing) |
| R6 | Password recovery unusable without SMTP and absent from UI (§4.2, §7.4); no self-service password change | High |
| R7 | Idempotency race + per-submit random client keys (§6.4) — duplicate postings possible on double-submit | Medium-High |
| R8 | No charge-reversal, OTHER_CHARGE, or CREDIT flow (§6.4–6.5) — corrections need DB access | Medium-High |
| R9 | Uploads publicly served, mimetype-only validation (§5.3) | Medium |
| R10 | Journal lines not FK-linked; reversal lookup by non-unique pair (§6.1, §6.4) | Medium |
| R11 | Test/docs count mismatch (16 tests vs "18/18" claim) and zero coverage of the opening-balance path (§9) | Medium |
| R12 | Public inquiry spam (no CAPTCHA/stricter limit); refresh not separately rate-limited (§5.4) | Low-Medium |
| R13 | Weighbridge VOIDED status dead; report/dashboard filter inconsistency (§6.4) | Low |
| R14 | Member statement CSV truncated at 100 rows; admin ledger view unpaginated (§7.8) | Low |
| R15 | Dirty parity state could be lost or double-applied if the rebuild branches from the wrong tree (§1) | Process — resolve explicitly |

---

## 13. What could NOT be verified (explicit — do not treat as verified)

- **Live behaviour of any kind.** The live frontend, API, and database
  were not visited, logged into, or queried. No statement is made here
  about live uptime, live data (including the one real member's
  balances, ledger rows, or opening balance), live fee values, live
  committee/inquiry content, or whether the dirty migration has been
  applied to the live database.
- **The live admin dashboard tour.** It was stopped by the user in a
  prior session and was not re-attempted here (it would require a
  browser login, which is out of scope for this read-only audit).
- **Atlas sign-in.** Previously stalled; not attempted here.
- **Test results.** The suite was not executed (read-only audit, no
  installs, no test database). The "18/18" claim is the project's own
  docs, and it already disagrees with the test file's 16 `it()` blocks.
- **Client build.** The committed `client/dist/` bundle exists but was
  not rebuilt or served here, so no claim is made that the current
  (dirty) tree builds cleanly.
- **Deployment parity.** Whether the live Render/Netlify/Neon setup
  matches `docs/DEPLOYMENT.md` (direct DB URL, exact CORS origin,
  secrets from environment, migration state) is unknown.
- **The association's real-world facts.** Official contact details,
  registration numbers, committee membership, tariffs beyond the
  seeded defaults, and the real member's paper records are not in this
  report and must come from the association — the old code correctly
  leaves those empty rather than inventing them.

---

## 14. Recommendations for the rebuild (Phase 1 output → next phases)

1. **Decide the opening-balance rule first (§6.2), write a test for
   it before migrating any data, and reconcile the one live member
   against paper records.** This is the single most important rebuild
   decision.
2. **Resolve the dirty tree explicitly:** either adopt the parity
   changes (including adding the missing `/committee` and `/rules`
   routes and admin committee/inquiry pages) or discard them — do not
   let them drift as uncommitted work into the new repo.
3. **Lock the member row in posting transactions; make idempotency
   keys stable per submission; link journals explicitly.**
4. **Fail closed on missing secrets; add SMTP (or another verified
   delivery channel) for password reset; add change-password.**
5. **Add the missing staff flows:** member edit + photo upload UI,
   unarchive, charge reversal, OTHER_CHARGE/CREDIT posting, and
   committee/inquiry admin pages — or explicitly defer each with a
   named decision.
6. **Keep what works (§11) and keep the docs' honesty standard:**
   label accrual vs. cash in reports, keep demo data gated and out of
   production, and keep public serializers allow-listed by
   construction.
7. **Expand tests to cover:** opening balance (creation → charge →
   payment → reconcile), concurrent postings, charge reversal,
   expense journaling, public-field filtering, and the new
   committee/inquiry flows. Reconcile the test-count discrepancy
   instead of carrying the "18/18" claim forward unverified.

---

*End of Phase 1 audit. All findings above were read from files in
`~/workspace/nakugaon-association/` on 2026-10-25. Nothing in the old
project was modified, and nothing outside
`~/workspace/nakugaon-association-new/docs/AUDIT.md` was written by
this audit.*
