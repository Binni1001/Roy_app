# ROY Web

ROY is a full web stack for managing Roy Badminton club finance and operations.

```text
backend/   Node.js + Express + Supabase + PayOS
frontend/  React + Vite
supabase/  Postgres RPC migrations
```

## Backend

```powershell
cd E:\roy_bad\backend
npm install
npm run dev
```

Default local API:

```text
http://localhost:5000
```

Health check:

```text
GET /api/health
```

## Backend API

People:

```text
GET    /api/people
POST   /api/people
GET    /api/people/:id
PUT    /api/people/:id
DELETE /api/people/:id
```

Periods and members:

```text
GET    /api/periods
POST   /api/periods
GET    /api/periods/:id
PUT    /api/periods/:id

GET    /api/period-members/period/:periodId
GET    /api/period-members/:id
POST   /api/period-members
PUT    /api/period-members/:id
DELETE /api/period-members/:id
```

Sessions and guest attendances:

```text
GET    /api/badminton-sessions
GET    /api/badminton-sessions/period/:periodId
GET    /api/badminton-sessions/:id
POST   /api/badminton-sessions
PUT    /api/badminton-sessions/:id
DELETE /api/badminton-sessions/:id

GET    /api/guest-attendances
GET    /api/guest-attendances/session/:sessionId
GET    /api/guest-attendances/person/:personId
GET    /api/guest-attendances/:id
POST   /api/guest-attendances
PUT    /api/guest-attendances/:id
DELETE /api/guest-attendances/:id
```

Debts, balances, and payments:

```text
GET    /api/debts
GET    /api/debts/period/:periodId
GET    /api/debts/person/:personId
POST   /api/debts
PUT    /api/debts/:id/status

GET    /api/person-balances
GET    /api/person-balances/person/:personId
GET    /api/person-balances/person/:personId/transactions

POST   /api/balance-offsets/person/:personId/period/:periodId

POST   /api/payments/create-for-person-period
POST   /api/payments/payos-webhook
PUT    /api/payments/:id/cancel
```

Shuttles, fund, and dashboard:

```text
GET    /api/shuttle-expenses
GET    /api/shuttle-expenses/period/:periodId
POST   /api/shuttle-expenses
PUT    /api/shuttle-expenses/:id
DELETE /api/shuttle-expenses/:id

GET    /api/shuttle-settlements/period/:periodId/preview
POST   /api/shuttle-settlements/period/:periodId/settle

GET    /api/club-fund-transactions
GET    /api/club-fund-transactions/period/:periodId
POST   /api/club-fund-transactions

GET    /api/dashboard/period/:periodId
```

## Supabase Setup

Create a Supabase project, then apply the schema you use for the project.

After the tables exist, run the finance RPC migration:

```text
supabase/20260613_atomic_finance_rpc.sql
```

The backend will use these RPC functions when available:

```text
process_paid_payment
mark_payment_failed
settle_shuttle_period
offset_person_period
```

Backend environment:

```env
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
PAYOS_CLIENT_ID=YOUR_PAYOS_CLIENT_ID
PAYOS_API_KEY=YOUR_PAYOS_API_KEY
PAYOS_CHECKSUM_KEY=YOUR_PAYOS_CHECKSUM_KEY
PAYOS_RETURN_URL=http://localhost:5173/payments/return
PAYOS_CANCEL_URL=http://localhost:5173/payments/cancel
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## Frontend

```powershell
cd E:\roy_bad\frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Frontend API URL:

```env
VITE_API_BASE_URL=http://localhost:5000
```

## Vercel Deploy

Deploy as two Vercel projects:

1. `frontend/`
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Env: `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

2. `backend/`
   - Uses `backend/vercel.json`
   - Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, PayOS variables

## Public source privacy

This repository uses synthetic fixtures and excludes production recovery exports. Existing deployments must not rerun historical migration files. See [public source notes](docs/PUBLIC_SOURCE.md) and [security policy](SECURITY.md).
