# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roy Badminton Club management web app. Tracks member debts, badminton sessions, PK match arena, and PayOS payments.

```
backend/   Node.js 22 + Express — REST API, deployed to Vercel Functions
frontend/  React 19 + Vite — SPA, deployed to Vercel
supabase/  Plain SQL migration files — run manually via Supabase SQL Editor
v2/        The rebuild in progress (see below) — same Supabase database, not deployed yet
```

## v2 rebuild

A full rebuild runs in parallel against the **same live Supabase database**. Plan: `docs/OVERHAUL_PLAN.md`. Ordered checklist: `docs/V2_TODO.md` — read it first and tick items as they land.

```
v2/apps/api        Hono + TypeScript (Vercel, sin1). Local JWT check via JWKS, GET /bootstrap, /me/*, /onboarding/*
v2/apps/web        React 19 + Vite + TanStack Router/Query. PWA. Layout switches app (dock) / web (top nav) at 900px
v2/packages/shared Types shared by api and web
```

```bash
cd v2 && npm install
npm run dev:api        # :5050  (needs apps/api/.env)
npm run dev:web        # :5174  (needs apps/web/.env)
npm run typecheck && npm test && npm run build
```

Rules for v2:
- Queries live only in `apps/api/src/store*.ts`; logic in `routes/` and `domain/` with tests (`testkit.ts` builds an app over in-memory stores).
- Every `/me/*` route goes through `resolveMember` (who is calling, which group they are viewing).
- Money and ranking writes call the existing database RPCs; never re-implement them as several separate statements.
- Schema changes must be additive. Read real column names from `$SUPABASE_URL/rest/v1/` with the service key instead of guessing.
- Never exercise write actions against the live database during development; the club owner tests them by hand.

## Commands

### Backend
```bash
cd backend
npm install
npm run dev        # nodemon src/server.js — listens on :5000
npm run check      # syntax-check test (no jest, uses node --test)
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Vite dev server — http://localhost:5173
npm run build      # Production build → dist/
npm run lint       # ESLint
```

No monorepo tooling — run commands inside each subdirectory.

## Architecture

### Auth flow
- Supabase Auth handles login/register/OAuth (Google).
- Frontend: `supabase.auth.getSession()` → Supabase JWT stored in localStorage.
- All API calls: axios interceptor in `frontend/src/api/client.js` attaches `Authorization: Bearer <jwt>`.
- Backend middleware `requireAuth` (`backend/src/middleware/auth.js`) validates the JWT against Supabase and sets `req.authUser` + `req.authRole`.
- Role hierarchy: `owner` > `admin` > `user`. Role is read from `app_metadata.role` (set via Supabase Dashboard or `admin-users` module).
- Backend uses `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS. Never expose this in frontend.
- Frontend uses `VITE_SUPABASE_ANON_KEY` — subject to RLS.

### Frontend routing (no react-router)
`App.jsx` is the single entry point. Routing is manual:
```
session === undefined  → loading screen (cat-loading.png)
/reset-password path   → <ResetPassword />
!session               → <Login />
canOpenAdmin(role)     → <AdminPortal />   (owner or admin)
else                   → <UserPortal />    (role = user)
```
Tab navigation inside each portal is state-based (`activeTab` string), not URL-based.

### Backend module pattern
Every feature follows the same 4-file pattern:
```
*.routes.js      → Express Router, declares endpoints and middleware guards
*.controller.js  → req/res handling, calls service, returns JSON
*.service.js     → business logic, validation, calls repository
*.repository.js  → Supabase queries only, no logic
```
Adding a new module: create these 4 files and register the router in `src/app.js`.

### Key data model concepts
- **Period** (`periods`): a billing cycle. Members and sessions belong to a period.
- **Person** (`people`): a club member with `email` matching their Supabase Auth email.
- **Debt** (`debts`): auto-generated per person per period; status `unpaid` → `paid`/`cancelled`.
- **PersonBalance**: computed from transactions; not a stored table — fetched from backend aggregation.
- **PkMatch**: challenger vs opponent (singles or doubles). Status: `pending → active → completed/cancelled`. Results locked after 24h. Wilson Score used for leaderboard ranking.

### Frontend feature structure
```
features/admin/          → AdminPortal + tab panels (admin/owner only)
features/user/           → UserPortal, MemberHero, PkArena, ProfileEdit, etc.
  useUserPortalData.js   → single hook owns all user data/state/mutations
  useAdminPortalData.js  → same pattern for admin
components/
  common.jsx             → Panel, Modal, SimpleTable, Input
  finance.jsx            → DebtTable, CheckoutBox, fund forms
  shell.jsx              → BrandBlock, AccountBox (header/sidebar chrome)
api/client.js            → axios instance + all api.* methods (single source of truth)
```

### CSS
Single file: `frontend/src/App.css` (~4600 lines). Dark-gold theme:
- Background: `#10141b`, text: `#efe7d2`, accent: `#d8ae52`
- Tab scenes use `--tab-img` CSS variable for per-tab blurred background images
- Images live in `frontend/public/images/` — reference as `/images/filename.jpg`
- Button hierarchy: gold gradient (CTA/submit) > image-textured (toolbar/create) > dark glass (secondary) > green (start) > red (danger)
- Breakpoints: 860px (sidebar becomes drawer, single-column layout), 480px (extra mobile compaction)

### Supabase Storage
- Bucket `avatars`: public, 2MB limit, image types only. See `supabase/20260624_avatars_storage.sql`.
- Frontend uploads directly to Supabase Storage (not through backend). Avatar URL stored in `people.avatar_url`.

### Payments (PayOS)
- `POST /api/payments/create-for-person-period` creates a PayOS checkout link.
- `POST /api/payments/payos-webhook` is the PayOS callback — calls `process_paid_payment` RPC.
- RPC functions in `supabase/20260613_atomic_finance_rpc.sql` are atomic: `process_paid_payment`, `mark_payment_failed`, `settle_shuttle_period`, `offset_person_period`.

## Deployment

Two separate Vercel projects:

| Project | Root | Framework | Env vars |
|---|---|---|---|
| Frontend | `frontend/` | Vite | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` |
| Backend | `backend/` | Node.js (vercel.json) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYOS_*` |

Supabase migrations (`supabase/*.sql`) are applied manually via the Supabase SQL Editor — there is no CLI migration runner configured.
