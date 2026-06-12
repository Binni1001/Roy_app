# ROY Web

ROY is now a full web stack:

```text
backend/   Node.js + Express
frontend/  React + Vite
supabase/  Postgres schema and seed data
```

## Backend

```powershell
cd E:\appcuatoi\backend
npm run dev
```

Health check:

```text
http://localhost:3000/health
```

Members API:

```text
GET    /members
POST   /members
POST   /members/seed
GET    /members/:id
PATCH  /members/:id
DELETE /members/:id
```

## Frontend

```powershell
cd E:\appcuatoi\frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Copy `frontend/.env.example` to `frontend/.env` if you need to change API URL:

```env
VITE_API_BASE_URL=http://localhost:3000
```

## Supabase Setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Run `supabase/schema.sql`.
4. If the database already existed before groups were added, run `supabase/groups.sql`.
5. Run `supabase/auth.sql` before enabling `AUTH_REQUIRED=true`.
6. Optionally run `supabase/seed.sql`.
7. Copy project URL and keys into env files:

Backend:

```env
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

Frontend:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## Vercel Deploy

Deploy as two Vercel projects:

1. `frontend/`
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`
   - Env:
     - `VITE_API_BASE_URL`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`

2. `backend/`
   - Uses `backend/vercel.json`
   - Env:
     - `JWT_SECRET`
     - `DATABASE_PROVIDER=supabase`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `MONGODB_URI` while migration from MongoDB is still in progress
