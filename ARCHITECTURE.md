# Kiến trúc & Hướng dẫn bảo trì — Roy Badminton

Tài liệu này giúp bạn tự hiểu, sửa và mở rộng web mà không cần hỏi ai. Đọc một lần để nắm bức tranh tổng thể, sau đó dùng như sổ tay tra cứu.

---

## 1. Tổng quan

App quản lý câu lạc bộ cầu lông: công nợ thành viên, buổi đánh, đấu trường PK, thanh toán PayOS, và hệ thống nhiều nhóm (workspace).

```
backend/    Node.js 22 + Express  → REST API, deploy lên Vercel Functions
frontend/   React 19 + Vite       → giao diện SPA, deploy lên Vercel
supabase/   File SQL              → chạy thủ công trong Supabase SQL Editor
```

3 phần **độc lập**, deploy riêng. Không có công cụ monorepo — chạy lệnh trong từng thư mục con.

---

## 2. Luồng tổng thể (rất quan trọng)

```
Người dùng (trình duyệt)
      │
      ▼
Frontend React  ──(axios + JWT)──►  Backend Express  ──►  Supabase (PostgreSQL)
      │                                   │
   App.jsx                          requireAuth
 (định tuyến)                     (kiểm tra JWT, gán quyền)
```

1. Người dùng đăng nhập qua **Supabase Auth** (email/mật khẩu hoặc Google).
2. Supabase trả về **JWT**, lưu trong localStorage.
3. Mọi lời gọi API đính kèm JWT ở header `Authorization: Bearer <jwt>` (xem `frontend/src/api/client.js`).
4. Backend dùng middleware `requireAuth` để xác thực JWT và gán `req.authUser` + `req.authRole`.
5. Backend dùng `SUPABASE_SERVICE_ROLE_KEY` để truy vấn DB (bỏ qua RLS). **Không bao giờ để key này lộ ra frontend.**

Phân quyền: `owner` > `admin` > `user`. Quyền đọc từ `app_metadata.role` trong Supabase.

---

## 3. Cấu trúc thư mục

### 3.1 Backend — `backend/src/`

Mỗi tính năng theo **mô hình 4 file** (đây là quy ước cốt lõi, làm theo cho mọi module mới):

```
modules/<tên-tính-năng>/
  *.routes.js       → Khai báo endpoint + middleware (requireAuth, requireAdmin...)
  *.controller.js   → Nhận req, gọi service, trả JSON. KHÔNG chứa logic nghiệp vụ.
  *.service.js      → Logic nghiệp vụ + kiểm tra dữ liệu. Gọi repository.
  *.repository.js   → CHỈ truy vấn Supabase. Không có logic.
```

Luồng 1 request: `routes → controller → service → repository → Supabase` rồi trả ngược lại.

Các module hiện có: `people`, `periods`, `period-members`, `debts`, `payments`, `pk-matches`, `tournaments`, `groups`, `shuttle-expenses`, `shuttle-settlements`, `guest-attendances`, `funds`, `admin-users`...

File hạ tầng:
```
app.js              → Đăng ký tất cả router (app.use('/api/...', router))
server.js           → Khởi động server (chỉ dùng khi chạy local :5000)
middleware/auth.js  → requireAuth, requireAdmin, requireOwner
config/supabase.js  → Khởi tạo Supabase client (service role)
utils/              → validators.js, peopleGuard.js... dùng chung
```

### 3.2 Frontend — `frontend/src/`

```
App.jsx                      → Điểm vào duy nhất, định tuyến thủ công (không dùng react-router)
api/client.js                → Axios + TẤT CẢ hàm gọi API (api.people.*, api.pk.*, api.groups.*...)
lib/supabase.js              → Supabase client (anon key)

pages/                       → Màn hình toàn trang (Login, Onboarding, PendingApproval, ResetPassword...)

features/admin/              → Cổng admin (owner/admin)
  AdminPortal.jsx, AdminSidebar.jsx, AdminContent.jsx
  useAdminPortalData.js      → 1 hook quản lý toàn bộ data/state/mutation của admin
  panels/                    → Từng tab: PeoplePanel, PeriodsPanel, PkPanel, FundPanel...
  panels/pk/                 → Phần con của PkPanel (xem mục 4)
  panels/tournaments/        → Tạo giải, xếp đội/chia bảng, nhập tỷ số

features/user/               → Cổng người dùng thường
  UserPortal.jsx, UserSidebar.jsx, UserContent.jsx, MemberHero.jsx
  useUserPortalData.js       → 1 hook quản lý toàn bộ data/state của user
  RandomMatchmaker.jsx       → Modal ghép ngẫu nhiên
  pk/                        → Phần con của PK (xem mục 4)

features/tournaments/        → Giao diện giải đấu dùng chung cho admin và user

components/                  → Dùng chung: common.jsx (Panel, Modal, Table), shell.jsx, finance.jsx
utils/                       → appUtils.js, leaderboardUtils.js, printReport.js
styles/                      → CSS (xem mục 5)
```

### 3.3 Định tuyến trong `App.jsx` (không dùng URL)

App hiển thị màn hình nào dựa trên trạng thái, theo thứ tự:

```
session === undefined        → màn hình loading (cat-loading.png)
đường dẫn /reset-password    → <ResetPassword />
chưa đăng nhập (!session)    → <Login />
person === undefined         → loading (đang lấy hồ sơ)
canOpenAdmin(role)           → <AdminPortal />   (owner hoặc admin — bỏ qua kiểm tra nhóm)
person === null              → <Onboarding /> (chưa có hồ sơ)
chưa có active_group_id      → <Onboarding /> (chưa vào nhóm nào)
status === 'pending'         → <PendingApproval />
status === 'inactive'        → <RejectedScreen />
ngược lại                    → <UserPortal />
```

Chuyển tab **bên trong** mỗi cổng là theo state (`activeTab`), không đổi URL.

---

## 4. Quy ước tách component (đã áp dụng khi refactor)

Khi một file component vượt quá ~300–400 dòng, tách theo nguyên tắc:

- **Hàm thuần (không JSX)** → file `*Utils.js`. VD: `features/user/pk/matchmakerUtils.js` (thuật toán ghép cặp), `scheduleUtils.js` (xếp lịch nhiều trận).
- **Component con tái dùng / độc lập** → file `.jsx` riêng. VD:
  - `features/user/pk/PlayerSlot.jsx`, `PersonPicker.jsx`, `BatchMatchCard.jsx`, `CreateMatchModal.jsx`
  - `features/admin/panels/pk/AdminLeaderboard.jsx`, `AdminMatchCard.jsx`, `AdminCreateMatchModal.jsx`, `PkEditModal.jsx`
- **Hằng số dùng chung** → file `*Constants.js`. VD: `features/admin/panels/pk/pkConstants.js`.
- File gốc chỉ giữ **component chính** (state + render khung) và import các phần con.

Lợi ích: mỗi file ngắn, dễ tìm lỗi, sửa 1 phần không sợ đụng phần khác.

---

## 5. Tổ chức CSS — `frontend/src/styles/`

Tất cả CSS được nạp qua `App.css` bằng `@import` (thứ tự import = thứ tự cascade, **không đổi thứ tự tuỳ tiện**).

| File | Nội dung |
|------|----------|
| `base.css` | Nền chung, màn loading, dropdown toàn cục |
| `layout.css` | Bố cục chính, workspace, tab scene, nút hành động, dashboard |
| `sidebar.css` | Thanh bên (admin + user) |
| `invite-group.css` | Màn mời/chờ duyệt/từ chối, onboarding chọn nhóm, group switcher |
| `login.css` | Trang đăng nhập |
| `pk-arena.css` | Đấu trường: bảng xếp hạng, thẻ kèo, bộ lọc |
| `matchmaker.css` | Modal ghép ngẫu nhiên (class `rm-*`) |
| `tournaments.css` | Giải đôi: tổng quan, bảng xếp hạng, lịch và nhánh loại trực tiếp |
| `navigation.css`, `calendar.css`, `analytics.css`, `profile.css`, `member-hero.css`, `onboarding.css`, `home-summary.css`, `buttons.css`, `notifications.css` | Theo tên |

**Theme tối-vàng:** nền `#10141b`, chữ `#efe7d2`, nhấn `#d8ae52`. Breakpoint: 860px (sidebar thành drawer), 480px (mobile).

Khi thêm CSS mới: ưu tiên bỏ vào file đúng chủ đề; nếu là cụm lớn mới thì tạo file riêng và thêm 1 dòng `@import` vào `App.css`.

---

## 6. Khái niệm dữ liệu chính

- **Group** (`groups`): một nhóm/CLB độc lập. Có `invite_code` để mời.
- **person_groups**: bảng nối người ↔ nhóm (nhiều-nhiều), mỗi dòng có `status` (pending/active/inactive) và `member_role` (owner/admin/member). Tối đa 3 nhóm/người.
- **people.active_group_id**: nhóm đang được chọn để xem. **people.group_id**: giữ lại cho tương thích cũ.
- **Period** (`periods`): kỳ thu quỹ, thuộc về 1 nhóm (`group_id`).
- **Person** (`people`): thành viên, `email` khớp email Supabase Auth.
- **Debt** (`debts`): công nợ tự sinh theo người + kỳ; `unpaid → paid/cancelled`.
- **PkMatch**: kèo đấu đơn/đôi. `pending → active → completed/cancelled`. Khoá kết quả sau 24h. Xếp hạng bằng Wilson Score.
- **Tournament**: giải đấu đôi độc lập với PK/Elo. Vòng bảng đấu vòng tròn, thắng 3 điểm; hai đội đầu bảng vào nhánh loại trực tiếp. Admin có thể sửa và hệ thống ghi lịch sử thay đổi.

Cách ly dữ liệu giữa các nhóm: `periods.group_id` + `people.group_id`; các bảng con (debts, sessions) liên kết qua period nên tự động cách ly theo nhóm.

---

## 7. Cách THÊM MỘT TÍNH NĂNG MỚI

### 7.1 Thêm API backend (ví dụ tính năng "abc")

1. Tạo thư mục `backend/src/modules/abc/` với 4 file:
   - `abc.repository.js` — viết truy vấn Supabase (select/insert/update...).
   - `abc.service.js` — kiểm tra dữ liệu + logic, gọi repository.
   - `abc.controller.js` — gọi service, trả `res.json(...)`.
   - `abc.routes.js` — khai báo endpoint + middleware:
     ```js
     router.get('/', requireAuth, abcController.list)
     router.post('/', requireAuth, requireAdmin, abcController.create)
     ```
2. Đăng ký router trong `backend/src/app.js`:
   ```js
   import abcRoutes from './modules/abc/abc.routes.js'
   app.use('/api/abc', abcRoutes)
   ```
3. Thêm hàm gọi vào `frontend/src/api/client.js`:
   ```js
   abc: {
     list:   () => request({ url: '/api/abc' }),
     create: (data) => request({ url: '/api/abc', method: 'POST', data }),
   }
   ```

### 7.2 Thêm giao diện frontend

- Tab mới trong cổng admin: tạo panel trong `features/admin/panels/`, thêm vào `AdminSidebar.jsx` (mảng `ADMIN_NAV`) và `AdminContent.jsx`.
- Lấy/đổi dữ liệu: thêm vào hook `useAdminPortalData.js` hoặc `useUserPortalData.js` (mỗi cổng có 1 hook gom toàn bộ data/mutation).
- Component lớn: tách theo mục 4.

### 7.3 Thêm bảng / đổi schema DB

- Viết file SQL mới trong `supabase/` (đặt tên theo ngày, vd `20260701_abc.sql`).
- **Chạy thủ công** trong Supabase SQL Editor (không có công cụ chạy migration tự động).

---

## 8. Lệnh thường dùng

```bash
# Backend
cd backend
npm install
npm run dev      # chạy local cổng :5000 (nodemon)
npm run check    # kiểm tra cú pháp

# Frontend
cd frontend
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # build production → dist/
npm run lint     # ESLint
```

---

## 9. Deploy

2 project Vercel riêng:

| Project | Root | Biến môi trường |
|---------|------|-----------------|
| Frontend | `frontend/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` |
| Backend | `backend/` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYOS_*` |

Push lên nhánh `main` → Vercel tự build & deploy cả 2. SQL phải tự chạy trong Supabase.

Mẹo: sau khi deploy, nếu thấy giao diện cũ, nhấn `Ctrl + Shift + R` (hard refresh) để xoá cache trình duyệt.

---

## 10. Lưu ý quan trọng khi sửa

- **Token & auth:** axios interceptor trong `api/client.js` luôn lấy token mới nhất qua `supabase.auth.getSession()`. App.jsx chỉ đổi `session` state khi user id thực sự thay đổi (tránh reload nhấp nháy khi quay lại tab).
- **Phân quyền:** kiểm tra cả ở frontend (ẩn nút) lẫn backend (middleware). Bảo mật thật nằm ở backend.
- **Không để lộ** `SUPABASE_SERVICE_ROLE_KEY` và `PAYOS_*` ở frontend.
- **Refactor an toàn:** khi tách file, di chuyển code y nguyên, không đổi hành vi; build + lint lại sau mỗi bước.
