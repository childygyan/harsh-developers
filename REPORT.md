# Harsh Developers — Build Report

**Client project for Firoz's client · Built 2026-10-01**
**Live URL:** https://harsh-developers.pages.dev
**Repo:** https://github.com/childygyan/harsh-developers (`main`)

## What was built

Property listing + application + loan management web app ("Harsh Developers"):

- **Public:** property listing with type filter (gala / plot / flat), detail pages with
  image gallery and price breakdown (area × ₹/sq ft = total, admin-overridable).
- **Auth:** email+password signup/login/logout; Google OAuth (authorization-code flow,
  env-gated — button appears only when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/
  `GOOGLE_REDIRECT_URI` are set). Sessions in D1, HttpOnly+Secure+SameSite cookies,
  PBKDF2 password hashing (Workers-safe).
- **Applications:** logged-in users apply for properties; admin inbox approves/rejects
  with optional note.
- **Loans:** users apply for a loan on an approved application (amount + tenure);
  admin approves with a free-choice interest % AND interest type (reducing / flat),
  or rejects with a reason. Full amortization schedule generated on approval.
- **EMI schedules:** shown on BOTH user and admin dashboards, with the interest
  label prominent (e.g. "12% p.a. reducing", "10% p.a. flat").
- **Admin extras:** manual loan creation (existing user or free-text name/phone,
  optional property link), add/delete users, property CRUD + R2 image uploads,
  settings (default interest % + type prefilling the approval form).
- **Security:** first admin seeded from `ADMIN_EMAIL`/`ADMIN_PASSWORD` env vars on
  first deploy, forced password change on first login; role middleware on every
  protected route and API; last-admin and self-delete protection.

## Interest methods (worked examples, P=₹100,000, 12% p.a., 12 months)

**Reducing balance** — r = 0.12/12 = 0.01;
EMI = P·r·(1+r)ⁿ / ((1+r)ⁿ − 1) = ₹8,884.88.
Interest is charged on the outstanding principal each month; total interest ≈ ₹6,618.53.

**Flat rate** — total interest = P × (0.12) × (12/12) = ₹12,000;
total payable = ₹112,000; EMI = 112000/12 = ₹9,333.33
(final installment absorbs the 4-paise rounding residue).
Interest slice is equal every month (₹1,000); balance starts at ₹112,000.

## Verification

- Unit tests: **15/15 passing** (`tests/emi.test.ts`, `tests/crypto.test.ts`) —
  both formulas verified against hand-computed values, schedule invariants
  (balances close to 0, principal sums to P, interest sums to total).
- Typecheck: `astro check` — 0 errors.
- Build: `astro build` — green.
- Live HTTP checks: PLACEHOLDER (fill after deploy).

## Deploy details

- Wrangler deployment id: PLACEHOLDER
- D1 database: `harsh-developers-db` (id `5b8d5ae8-c55e-432f-b6bb-10e6b9ca3372`)
- R2 bucket: `harsh-developers-images` — ⚠️ NOT created: the Cloudflare API token
  lacks R2 scope (D1 + Pages work). Image upload endpoints degrade honestly
  ("Image storage is not configured") until the bucket exists.
- GitHub commit: PLACEHOLDER
- Drive zip: PLACEHOLDER

## Admin seed instructions (for Firoz)

1. In the Cloudflare Pages dashboard → project `harsh-developers` → Settings →
   Environment variables, set:
   - `ADMIN_EMAIL` = client's admin email
   - `ADMIN_PASSWORD` = a strong temporary password
2. Redeploy (or just visit the site — seeding runs lazily on the first request).
3. Log in with those credentials → you will be forced to set a new password.
4. Optional: delete the two env vars afterwards (the admin account persists in D1).

## Pending manual items (Firoz / client)

(a) **Google OAuth** — client creates OAuth client ID + secret in Google Cloud
    Console (authorized redirect URI:
    `https://harsh-developers.pages.dev/api/auth/google/callback`), then Firoz
    sets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` as
    Pages env vars and redeploys. Until then, email signup/login works fully.
(b) **Custom domain** — attach whenever the client picks one (Pages → Custom domains).
(c) **Inventory + policy** — client adds real gala/plot/flat listings, uploads
    images, and sets his default interest % / type in Admin → Settings.
(d) **R2 bucket** — needs a Cloudflare token with R2 scope (or manual creation
    in the dashboard) for property image uploads to work.

## Not built

Nothing — the full spec (listing, auth incl. Google flow, applications, loans with
both interest methods, EMI schedules on both dashboards, manual loans, user
management, property CRUD + images, settings) is implemented.
