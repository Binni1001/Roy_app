# Roy Badminton v2

Bản mới, dựng song song với `backend/` và `frontend/`, dùng chung database Supabase.
Kế hoạch và phạm vi: [`docs/OVERHAUL_PLAN.md`](../docs/OVERHAUL_PLAN.md).

```
apps/api         Hono + TypeScript. Xác thực JWT tại chỗ, một lần gọi /bootstrap khi mở app.
apps/web         React 19 + Vite + TypeScript. Hai bố cục: app (điện thoại) và web (máy tính).
packages/shared  Kiểu dữ liệu dùng chung giữa API và web.
```

## Chạy trên máy

```bash
cd v2
npm install
cp apps/api/.env.example apps/api/.env   # điền khóa Supabase
cp apps/web/.env.example apps/web/.env
npm run dev:api    # http://localhost:5050
npm run dev:web    # http://localhost:5174
```

## Kiểm tra

```bash
npm run typecheck
npm run test
npm run build
```
