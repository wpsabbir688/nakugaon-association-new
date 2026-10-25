# Nakugaon Association — Client (frontend owner scope only)

React 19 + Vite + React Router + Tailwind v4 + Framer Motion + Lucide + Axios + React Hook Form + Zod + Recharts. JSX only.

- Routes are `/bn/...` and `/en/...` (BN default, `/` redirects to `/bn`). Language switcher in public + staff headers.
- API: relative `/api` in dev (Vite proxy → http://localhost:5000), `VITE_API_URL` override for production builds. HttpOnly cookie session; frontend never stores tokens. All money is integer BDT, formatted `৳1,250.00`.
- No demo data: every list/stat/chart reads its contract endpoint and renders loading / error / empty states when the API is unreachable or returns nothing. Public balances are hidden; settings/API flags govern disclosure.
- Honest gaps (no endpoint in the contract, so nothing is faked): password reset by email (Forgot/Reset screens explain it is not configured), audit log (Admin Audit page states the endpoint is not in the contract), profile-correction submission (form present, submission is not claimed as successful).
- CSV export escapes formula-injection values (`= + - @` prefixed with `'`, fields quoted). Receipts/statements use browser print.
- Run: `npm install && npm run build && npm run preview` (preview on :4173).

NOT touched: `server/`, `docs/`, or the old project `~/workspace/nakugaon-association/`. No remote push, no deploy, no secrets in code.
