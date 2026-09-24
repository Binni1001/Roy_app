# ROY Badminton — Project Completion Checklist

> Tài liệu này chuyển kết quả reverse-engineering thành backlog có thể thực thi.
>
> Trạng thái mặc định: chưa thực hiện. Chỉ đánh dấu `[x]` sau khi thay đổi đã được review, kiểm thử và xác nhận trên môi trường phù hợp.

## Kế hoạch thực thi đang áp dụng — 14/09/2026

Đây là checklist chính của dự án, được lưu cùng source trong Git. Các mục bên dưới là thứ tự thực hiện; các mã SEC/FIN/API ở phần chi tiết là tiêu chí nghiệm thu, không phải các công việc trùng lặp cần làm hai lần.

### Quy trình cho mỗi nghiệp vụ

1. Rà code và dữ liệu liên quan; ghi rõ phạm vi, phụ thuộc và tiêu chí nghiệm thu.
2. Thực hiện thay đổi nhỏ, giữ lịch sử tài chính và dữ liệu người dùng.
3. Thêm/chạy test hành vi, kiểm tra hồi quy, lint/build nếu có frontend.
4. Cập nhật checkbox con và nhật ký bằng chứng ngay trong file này.
5. Commit và push `origin/main` theo yêu cầu của chủ dự án khi bản sửa đủ điều kiện triển khai.
6. Nếu còn migration, cấu hình dịch vụ hoặc kiểm thử staging/production: để mục tổng ở `In review`/`Blocked`, nêu bước cần làm; không ghi `Done` chỉ vì đã push.

### Các đợt và đầu ra cụ thể

| Đợt | Công việc theo thứ tự | Điều kiện bắt đầu / đầu ra nghiệm thu | Trạng thái |
|---|---|---|---|
| 1 | SEC-001: nguồn role an toàn; đồng bộ frontend, backend, quản lý admin và bộ lọc người chơi | Code/test local và audit Auth đã đạt; còn smoke test sau deploy | In review |
| 2 | SEC-002 → SEC-003: ma trận quyền và cách ly nhóm | Đã chốt owner toàn hệ thống/admin được phân công; đợt 2.1 có phân công, People/Periods và test hai nhóm; còn các module khác | In progress |
| 3 | SEC-004 → SEC-005 → PK-001: avatar, dữ liệu công khai và quyền PK | Test không sửa avatar người khác; response tối thiểu; kiểm tra creator/participant/group | Not started |
| 4 | DB-001 → FIN-001: database tái tạo được và giao dịch tài chính nguyên khối | Có schema được xác minh; dựng DB thử; lỗi giữa luồng không ghi dở; retry không nhân đôi | Not started |
| 5 | FIN-002 + FE-002: PayOS và màn hình kết quả thanh toán | Có môi trường test; webhook, hủy, đối soát, redirect được kiểm thử; không tạo thanh toán thật để thử | Not started |
| 6 | API-001 → API-002 → FE-001 → API-003 | Lỗi/validation thống nhất, không che lỗi tải, phân trang có giới hạn và test tương thích | Not started |
| 7 | TEST-001 + OPS-001/002/003 | E2E/integration; CI; audit/monitoring; chống lặp trên nhiều instance; xác minh cấu hình remote | Not started |
| 8 | ARCH-001 + DOC-001 + CFG-001 + UX-001 + CLEAN-001 | Refactor có hồi quy; tài liệu/deploy/rollback đúng; mobile/accessibility; dọn code có bằng chứng | Not started |

CI chạy test/lint/build sẽ được bổ sung sớm sau đợt 1 nếu không cần quyết định nghiệp vụ; không đợi đến đợt 7 mới bảo vệ các bản sửa. Không bật multi-group hoặc thay đổi quyền tài khoản production khi chưa xác minh/chốt mô hình quyền.

### Các bản sửa đã có trước kế hoạch này

Các checkbox ở đây xác nhận **code và kiểm thử local**, không thay thế nghiệm thu production hay hoàn tất toàn bộ FIN/SEC.

- [x] Miễn tiền cầu 0/50/100%, chia lại phần giảm và kiểm thử số tiền — commit `c09e4da`.
- [x] Chặn tài khoản đã nghỉ và đối tượng hoạt động không hợp lệ — commit `51982d5`.
- [x] Bổ sung lọc người đã nghỉ ở Nộp quỹ, Thanh toán/Nhắc nợ — commit `7757381`.
- [x] Loại role quản trị khỏi lựa chọn và thao tác người chơi — commit `ad6da50`; nguồn role tiếp tục được siết tại SEC-001.
- [ ] Nghiệm thu các bản sửa trên môi trường triển khai, gồm migration miễn tiền cầu và dữ liệu lịch sử liên quan.

### Nhật ký thực hiện

Tiến độ con đợt 2 (cập nhật 15/09/2026):

- [x] Bổ sung scope API buổi cầu theo nhóm của kỳ, kiểm tra ID thực tế trước ghi/replay; test mock hai nhóm đạt.
- [x] Chặn sửa buổi ở kỳ không mở, chuyển kỳ qua payload và số cầu không hợp lệ; kiểm thử hồi quy local đạt.
- [ ] Hoàn thiện scope thành viên/khách, UI admin và nghiệm thu Supabase; chưa mở lại module buổi cầu cho admin.
- [ ] Tách bù trừ số dư/công nợ theo nhóm trước khi mở các thao tác phát sinh nợ cho admin (trigger hiện hoạt động theo người toàn hệ thống).

| Ngày | Hạng mục | Kết quả / bằng chứng | Còn lại |
|---|---|---|---|
| 15/09/2026 | SEC-003 — buổi cầu | 8 test mới; tổng 77 test backend và syntax check đạt local. Scope query/ID, validation kỳ/số cầu; chi tiết `docs/GROUP_AUTHORIZATION.md` | Chưa mở module admin; còn scope khách/thành viên, phụ thuộc bù trừ tài chính và nghiệm thu DB/deploy |
| 14/09/2026 | Kế hoạch | Giữ nguyên backlog chi tiết; bổ sung đợt thực hiện và quy tắc tick/commit | Bắt đầu SEC-001; không đánh dấu các mục chưa kiểm tra |
| 14/09/2026 | SEC-001 | 56 test backend, 23 test frontend; lint/build đạt. Audit Auth chỉ đọc: 19 tài khoản, 1 owner tin cậy, không có quản trị phụ thuộc role cũ. Chi tiết: `docs/AUTH_ROLE_SECURITY.md` | Smoke test sau deploy; không tự đổi quyền tài khoản |
| 14/09/2026 | SEC-001 / Git | Code, test và checklist đã push `origin/main`, commit `614ee63` | Chưa ghi nhận nghiệm thu đăng nhập sau deploy |
| 14/09/2026 | OPS-001 / CI | Commit `3f9e801`; [GitHub Actions #34831556102](https://github.com/Binni1001/Roy_app/actions/runs/34831556102) thành công. Đã kiểm tra từng bước của hai job: `npm ci`, backend syntax/tests, frontend lint/tests/build | Còn branch/deploy gate và kiểm tra migration; không đánh dấu toàn bộ OPS-001 Done |
| 14/09/2026 | SEC-002/003 — đợt 2.1 | Chủ dự án xác nhận mô hình quyền. Code phân công nhóm, scope People/Periods, bảo vệ replay; 69 test backend + 25 test frontend, lint/build đạt local. Chi tiết `docs/GROUP_AUTHORIZATION.md` | Chưa nghiệm thu deploy. Module chưa scope tạm khóa với admin; owner vẫn dùng. Không đánh dấu SEC-003 hoàn tất |
| 14/09/2026 | SEC-002/003 — CI | Đã push `c2d1961`; [CI #34834736485](https://github.com/Binni1001/Roy_app/actions/runs/34834736485) có cả `Backend tests` và `Frontend checks` thành công. Audit trước push: 1 owner, 0 admin; không thay quyền thật | Còn nghiệm thu giao diện/deploy và triển khai các module tiếp theo |

## Mục tiêu hoàn thiện

Dự án được xem là sẵn sàng vận hành production khi đáp ứng đồng thời:

- Không còn lỗ hổng phân quyền Critical/High đã biết.
- Mọi dữ liệu đều được cách ly đúng theo group.
- Có thể dựng một Supabase project mới hoàn toàn từ repository.
- Các luồng tài chính quan trọng chạy atomic và có thể đối soát.
- Auth, payment, PK và tournament có integration/E2E test cho luồng chính.
- CI tự động chặn deploy khi test, lint hoặc build thất bại.
- Có logging, backup, monitoring và runbook xử lý sự cố.

---

## P0 — Critical: phải xử lý trước khi mở rộng tính năng

### SEC-001 — Chặn privilege escalation qua `user_metadata.role`

- [x] Backend chỉ đọc quyền đặc biệt từ nguồn không thể do user tự sửa, dùng `app_metadata.role`.
- [x] Xóa fallback sang `user_metadata.role` trong `backend/src/middleware/auth.js` và các nơi đọc role khác.
- [x] Frontend dùng cùng một quy tắc hiển thị role với backend; có test đối chiếu.
- [x] Tài khoản thiếu/sai `app_metadata.role` mặc định là `user`.
- [x] Rà soát Auth của Supabase đang cấu hình: không có tài khoản quản trị chỉ dựa vào `user_metadata` (14/09/2026; chỉ đọc).
- [x] Thêm test middleware: user tự đặt metadata `owner/admin` vẫn nhận HTTP 403, không chạy handler quản trị.
- [x] Thêm test middleware/service: owner/admin hợp lệ vẫn truy cập đúng quyền; owner không bị thu hồi quyền.
- [ ] Smoke test owner/user và trạng thái nghỉ sau khi triển khai cả backend/frontend; đây là bước còn lại trước khi đóng SEC-001.

**Files liên quan:**

- `backend/src/middleware/auth.js`
- `frontend/src/utils/appUtils.js`
- `backend/src/modules/admin-users/adminUsers.service.js`

**Definition of Done:** Không có dữ liệu do user tự cập nhật nào có thể nâng quyền API.

### DB-001 — Tạo database baseline đầy đủ

- [ ] Thu thập schema production hiện tại bằng cách an toàn, không bao gồm dữ liệu hoặc secret.
- [ ] Bổ sung DDL nền cho các bảng đang thiếu `CREATE TABLE`: people, periods, period_members, badminton_sessions, guest_attendances, debts, payments, payment_debts, shuttle_expenses, club_fund_transactions, person_balances và balance_transactions.
- [ ] Ghi đầy đủ primary key, foreign key, unique constraint, check constraint, index, default và nullability.
- [ ] Hợp nhất hoặc ghi rõ migration nào là baseline, incremental, repair-only hoặc superseded.
- [ ] Kiểm tra thứ tự chạy toàn bộ migration.
- [ ] Viết tài liệu bootstrap Supabase mới.
- [ ] Dựng thử một database trống chỉ từ repository.
- [ ] Chạy smoke test API trên database vừa dựng.

**Definition of Done:** Một developer mới có thể dựng database sạch mà không sao chép thủ công schema từ production.

### SEC-002 — Thiết kế nguồn sự thật cho authorization theo group

- [x] Chốt global role từ `app_metadata`; `person_groups.member_role` là membership, không cấp quyền quản trị toàn cục.
- [x] Chốt mô hình: owner toàn hệ thống; admin chỉ `app_metadata.managed_group_ids` do owner phân công.
- [x] Thêm API owner-only và giao diện phân công/thu hồi nhóm cho admin; kiểm thử local.
- [x] CI kiểm thử bản phân công và scope đợt 2.1 thành công — commit `c2d1961`, run `34834736485`.
- [ ] Viết ma trận quyền owner/admin/member cho từng endpoint.
- [x] Ghi ma trận cho các endpoint đợt 2.1 tại `docs/GROUP_AUTHORIZATION.md`; các module còn lại chưa mở cho admin.
- [x] Owner xem People/Periods toàn hệ thống không cần membership; tạo dữ liệu cần nhóm đích rõ, chỉ fallback khi có một nhóm.
- [ ] Không bật lại multi-group trước khi ma trận quyền được triển khai và test.
- [ ] Nghiệm thu toàn bộ endpoint và trải nghiệm owner chọn nhóm; chưa đóng SEC-002 chỉ vì có nguồn phân công.

**Definition of Done:** Mọi request đều xác định được actor, active group, group membership và quyền thao tác từ một quy tắc duy nhất.

---

## P1 — High: bảo mật, toàn vẹn dữ liệu và luồng tiền

### SEC-003 — Chống cross-group IDOR

- [x] Tạo helper resolve quyền từ authenticated Auth user; nhóm đang chọn không tự cấp quyền.
- [x] Tạo guard xác minh `personId` trong phạm vi quản lý; hồ sơ dùng chung ngoài phạm vi chỉ owner được sửa.
- [x] Tạo guard xác minh nhóm của `periodId` được phép truy cập.
- [ ] Tạo guard xác minh entity con thuộc period/group hợp lệ.
- [x] Áp dụng guard cho People list/get/create/update/delete/password; kiểm thử local hai nhóm.
- [x] Áp dụng scope cho Periods list/get/create/update; kiểm thử local hai nhóm.
- [ ] Áp dụng scope cho Period Members (chưa mở cho admin trong đợt 2.1).
- [ ] Áp dụng guard cho Sessions và Guest Attendances.
- [ ] Áp dụng guard cho Debts, Balances và Balance Offsets.
- [ ] Áp dụng guard cho Payments và payment cancellation.
- [ ] Áp dụng guard cho Shuttle Expenses/Settlements, Fund và Dashboard.
- [ ] Áp dụng guard cho PK matches, leaderboard và people picker.
- [ ] Xác minh Tournament luôn scope theo managed group ở cả list và entity-by-ID.
- [ ] Thêm test với ít nhất hai group: admin nhóm A không đọc/sửa dữ liệu nhóm B.
- [x] Có test hai nhóm cho People/Periods và phân công; chưa thay thế test toàn bộ các module còn lại.

**Definition of Done:** Không endpoint nào có thể vượt group chỉ bằng cách thay UUID trên request.

### SEC-004 — Siết Supabase Storage avatar policies

- [ ] Quy định object path gắn với `auth.uid()` hoặc person thuộc tài khoản hiện tại.
- [ ] Chỉ owner của object được insert/update/delete avatar của mình.
- [ ] Xác định riêng quyền admin cập nhật avatar người khác nếu nghiệp vụ yêu cầu.
- [ ] Giữ public read chỉ khi avatar thực sự là dữ liệu công khai.
- [ ] Kiểm tra MIME type bằng nội dung thực tế hoặc cơ chế đáng tin cậy, không chỉ tên file/client header.
- [ ] Test user A không thể ghi đè hoặc xóa avatar user B.

**Files liên quan:**

- `supabase/20260624_avatars_storage.sql`
- `frontend/src/features/user/useUserPortalData.js`
- `frontend/src/features/admin/panels/PeoplePanel.jsx`

### SEC-005 — Giảm dữ liệu cá nhân bị lộ qua PK

- [ ] Xác nhận phone có cần xuất hiện trong API `/api/pk-matches/people` hay không.
- [ ] Nếu không cần, loại phone khỏi public projection.
- [ ] Chỉ trả fields thực sự cần cho picker/leaderboard.
- [ ] Scope danh sách người chơi theo active group và membership active.
- [ ] Thêm contract test cho response fields.

### PK-001 — Chuẩn hóa quyền tạo và sửa trận PK

- [ ] Quyết định user có được tạo trận không có chính mình tham gia hay không.
- [ ] Nếu không, bắt buộc creator là một participant.
- [ ] Kiểm tra tất cả participant thuộc cùng group và đúng period.
- [ ] Kiểm tra period cho phép tạo/hoàn tất trận ở trạng thái nào.
- [ ] Xác minh quyền cancel/activate match của participant.
- [ ] Test user không thể finalize/update match của người khác.
- [ ] Test admin correction và owner void vẫn tạo audit đầy đủ.

### FIN-001 — Loại bỏ mutation tài chính không atomic

- [ ] Liệt kê mọi fallback JavaScript khi RPC không tồn tại.
- [ ] Chọn chính sách production: fail-fast nếu thiếu migration thay vì chạy fallback partial-write.
- [ ] Đảm bảo settlement, refund, offset và payment luôn chạy trong transaction DB.
- [ ] Thêm unique/idempotency constraint cho mọi transaction có thể retry.
- [ ] Test lỗi giữa luồng không tạo trạng thái nửa chừng.
- [ ] Test retry cùng request không nhân đôi debt/balance/fund transaction.

**Files liên quan:**

- `backend/src/modules/shuttle-settlements/shuttleSettlements.service.js`
- `backend/src/modules/balance-offsets/balanceOffsets.service.js`
- `backend/src/modules/club-fund-transactions/clubFundTransactions.service.js`
- `supabase/20260814_automatic_balance_offset.sql`

### FIN-002 — Hoàn thiện kiểm thử PayOS

- [ ] Kiểm thử tạo checkout trên PayOS sandbox/test environment.
- [ ] Kiểm thử webhook hợp lệ, chữ ký sai, orderCode không tồn tại và webhook lặp.
- [ ] Kiểm thử amount/order mismatch.
- [ ] Kiểm thử payment cancel trước và sau webhook paid.
- [ ] Đảm bảo webhook acknowledgement đúng yêu cầu PayOS.
- [ ] Có job/quy trình đối soát payment pending quá lâu.
- [ ] Có runbook xử lý user đã chuyển tiền nhưng debt chưa cập nhật.

### OPS-001 — Thêm CI quality gate

**Trạng thái:** In review. Hai job của workflow đã thành công trên GitHub Actions, Node 22/Linux, commit `3f9e801`, run `34831556102`. Xem `docs/QUALITY_CHECKS.md`. Chưa nghiệm thu chặn merge/deploy và migration gate.

- [x] CI cài dependency bằng lockfile (`npm ci` cho cả hai package).
- [x] Chạy backend tests trên CI.
- [x] Chạy frontend tests trên CI.
- [x] Chạy frontend lint trên CI.
- [x] Chạy frontend production build trên CI.
- [x] Kiểm tra syntax backend và các import được thực thi trong test trên CI.
- [ ] Smoke-load toàn bộ backend với cấu hình test để kiểm tra các import chưa được test thực thi.
- [ ] Kiểm tra migration ordering/baseline.
- [ ] Chặn merge/deploy nếu bất kỳ bước nào thất bại.

---

## P2 — Medium: ổn định API và tăng khả năng bảo trì

### API-001 — Chuẩn hóa error handling

- [ ] Tạo error classes cho validation, not found, forbidden, conflict và internal error.
- [ ] Thêm global Express error middleware.
- [ ] Controller không tự lặp `try/catch` và map status tùy ý.
- [ ] Không trả raw Supabase/PostgreSQL error cho client.
- [ ] Chuẩn hóa response lỗi: `code`, `message`, `details` an toàn và request ID.
- [ ] Chuẩn hóa HTTP 400/401/403/404/409/422/429/500.
- [ ] Frontend phân biệt lỗi hệ thống với empty state.

### API-002 — Thêm schema validation/DTO

- [ ] Chọn một schema validator phù hợp.
- [ ] Validate params, query và body ở boundary API.
- [ ] Chuẩn hóa UUID validation.
- [ ] Chuẩn hóa money thành integer VND hoặc numeric rule rõ ràng.
- [ ] Chuẩn hóa date/time/timezone.
- [ ] Dùng cùng password policy cho mọi đường cập nhật mật khẩu.
- [ ] Hạn chế payload update bằng allowlist ở mọi module.

### API-003 — Pagination và filtering server-side

- [ ] Thêm pagination cho people, debts, payments, fund transactions, balance transactions, sessions và PK matches.
- [ ] Thêm giới hạn page size.
- [ ] Đưa search/filter/sort lớn từ frontend xuống backend.
- [ ] Giữ response contract tương thích hoặc version API.
- [ ] Thêm index theo query thực tế sau khi đo `EXPLAIN`.

### FE-001 — Không che lỗi API thành empty state

- [ ] Rà tất cả `.catch(() => [])` và `.catch(() => null)`.
- [ ] Phân biệt loading, empty, partial failure và fatal failure.
- [ ] Hiển thị retry action cho panel tải lỗi.
- [ ] Không hiển thị “không có dữ liệu” khi request thực tế bị 401/403/500.
- [ ] Khi token hết hạn, có UX đăng nhập lại rõ ràng.

### FE-002 — Hoàn thiện PayOS return/cancel UX

- [ ] Thêm route/state xử lý `/payments/return` và `/payments/cancel`.
- [ ] Hiển thị trạng thái đang đối soát thay vì kết luận paid ngay từ redirect.
- [ ] Poll/reload trạng thái backend trong khoảng thời gian giới hạn nếu cần.
- [ ] Có nút quay lại công nợ và thử lại.
- [ ] Xử lý refresh trực tiếp tại callback URL trên Vercel.

### ARCH-001 — Tách các module quá lớn theo use case

- [ ] Tách payment service theo checkout/webhook/cancellation.
- [ ] Tách period member service theo enrollment/debt synchronization.
- [ ] Tách PK service theo command/query/leaderboard.
- [ ] Tách tournament service theo lifecycle/standings/bracket.
- [ ] Tách admin/user hooks thành query hooks và mutation hooks hợp lý.
- [ ] Giữ module nhỏ gọn, không over-engineer hoặc thay đổi hành vi ngoài ý muốn.

### OPS-002 — Logging, monitoring và audit

- [ ] Structured logging cho request, error và external call.
- [ ] Gắn request/correlation ID.
- [ ] Redact JWT, service key và dữ liệu nhạy cảm.
- [ ] Theo dõi error rate, latency, 429, webhook failure và payment pending.
- [ ] Audit thao tác admin với person, debt, fund, payment và role.
- [ ] Alert khi finance RPC lỗi hoặc migration thiếu.

### OPS-003 — Rate limit và idempotency phù hợp serverless

- [ ] Đánh giá giới hạn của in-memory Map trên nhiều Vercel instance.
- [ ] Chuyển rate-limit state sang storage dùng chung nếu production cần đảm bảo toàn cục.
- [ ] Persist idempotency cho thao tác tài chính quan trọng.
- [ ] Đặt TTL và cleanup policy rõ ràng.
- [ ] Không scope idempotency bằng toàn bộ raw Authorization token nếu token refresh làm mất khả năng replay mong muốn.

### TEST-001 — Tăng test coverage theo hành vi

- [ ] Integration tests với PostgreSQL/Supabase test project hoặc local stack.
- [ ] E2E: login → profile → debt → payment state.
- [ ] E2E admin: tạo period → enroll → session/guest → settlement.
- [ ] E2E PK: create → finalize → leaderboard → correction/void.
- [ ] E2E tournament: configure → group results → knockout → champion.
- [ ] Test authorization bằng hai user ở hai group.
- [ ] Test migration từ database trống.
- [ ] Xuất coverage report và đặt ngưỡng thực tế.

---

## P3 — Low: tài liệu, UX và dọn technical debt

### DOC-001 — Đồng bộ tài liệu dự án

- [ ] Cập nhật README với toàn bộ module/API hiện có.
- [ ] Cập nhật architecture theo source hiện tại.
- [ ] Ghi rõ role model và group isolation.
- [ ] Ghi rõ quy trình migration/deploy/rollback.
- [ ] Ghi rõ PayOS setup và webhook troubleshooting.
- [ ] Ghi rõ migration superseded/repair-only, không chạy nhầm.

### CFG-001 — Chuẩn hóa configuration

- [ ] Không dùng dependency `latest` ở backend; pin version có kiểm soát.
- [ ] Validate env bắt buộc khi server khởi động.
- [ ] Chuyển `GROUPS_ENABLED` sang environment/release flag.
- [ ] Ghi tài liệu cho `CORS_ORIGINS`, rate limits và idempotency settings.
- [ ] Xác nhận production không log hoặc expose secret.

### UX-001 — Hoàn thiện trạng thái giao diện

- [ ] Review loading/empty/error/success cho từng tab.
- [ ] Thêm confirm rõ cho thao tác tài chính và destructive action.
- [ ] Bảo đảm mobile layout hoạt động ở 480 px và 860 px.
- [ ] Kiểm tra keyboard navigation, focus trap và accessible labels cho modal.
- [ ] Kiểm tra contrast, toast screen-reader behavior và form errors.

### CLEAN-001 — Rà dead/legacy code

- [ ] Xác minh `create-for-person-period` còn consumer thực tế hay không.
- [ ] Xác minh các balance-offset endpoint theo period có còn được dùng.
- [ ] Phân loại `people.group_id` là compatibility field và lập kế hoạch migration nếu bỏ.
- [ ] Đánh dấu rõ SQL repair scripts không dùng cho fresh install.
- [ ] Chỉ xóa code sau khi có usage evidence và regression tests.

---

## Checklist theo module

### Authentication và Admin Users

- [x] Sửa nguồn role an toàn (code + test local; nghiệm thu rollout theo SEC-001).
- [ ] Đồng nhất password policy tối thiểu 8 ký tự và độ phức tạp.
- [ ] Scope password update theo managed group.
- [ ] Test invite, revoke và không thể revoke owner.
- [ ] Audit mọi thay đổi quyền.

### People và Groups

- [ ] Scope CRUD theo active group.
- [ ] Đồng bộ `people.status`, membership status và active group.
- [ ] Test giới hạn tối đa ba group.
- [ ] Test owner không thể leave.
- [ ] Hoàn tất tenant security trước khi bật group UI.

### Periods, Members, Sessions và Guests

- [ ] Kiểm tra mọi entity thuộc cùng group/period.
- [ ] Xác định transition hợp lệ giữa draft/open/closed.
- [ ] Chặn mutation trên closed period theo quy tắc thống nhất.
- [ ] Test đồng bộ monthly fee debt khi đổi attendance status.
- [ ] Test guest attendance update/delete đồng bộ debt.

### Debts, Balances, Fund và Shuttle

- [ ] Đảm bảo mọi mutation atomic.
- [ ] Chuẩn hóa ledger/audit trail.
- [ ] Không cho sửa thủ công làm sai payment history.
- [ ] Test rounding khi chia tiền cầu.
- [ ] Xác định cách xử lý số dư do rounding.
- [ ] Test exempt shuttle và settlement retry.
- [ ] Test carry-over chỉ thực hiện một lần.

### Payments

- [ ] Tenant scope và ownership check.
- [ ] Webhook idempotency bền vững.
- [ ] Reconciliation cho pending payment.
- [ ] Callback UX.
- [ ] Không tin trạng thái từ frontend redirect.

### PK

- [ ] Scope người chơi và period theo group.
- [ ] Chốt quyền creator/participant.
- [ ] Test ordering và Elo rebuild.
- [ ] Test concurrent finalize.
- [ ] Bảo toàn audit sau correction/void.

### Tournaments

- [ ] Test toàn bộ lifecycle trạng thái.
- [ ] Test team member uniqueness và cùng group.
- [ ] Test tie-break standings.
- [ ] Test bye, semifinal loser và third-place propagation.
- [ ] Test sửa kết quả đã hoàn tất và bracket rebuild.
- [ ] Test user không xem draft tournament.

### Notifications

- [ ] Scope notification đúng người nhận và group liên quan.
- [ ] Chống spam debt reminders.
- [ ] Xác định retention policy ngoài giới hạn 100 bản ghi hiển thị.
- [ ] Test mark-read/delete ownership.

---

## Thứ tự triển khai đề xuất

### Milestone 1 — Security foundation

- [ ] SEC-001
- [ ] SEC-002
- [ ] SEC-003
- [ ] SEC-004
- [ ] SEC-005

### Milestone 2 — Reproducible database và finance safety

- [ ] DB-001
- [ ] FIN-001
- [ ] FIN-002
- [ ] OPS-001

### Milestone 3 — Stable API và testing

- [ ] API-001
- [ ] API-002
- [ ] TEST-001
- [ ] OPS-002
- [ ] OPS-003

### Milestone 4 — Product completeness

- [ ] PK-001
- [ ] FE-001
- [ ] FE-002
- [ ] API-003
- [ ] Hoàn tất multi-group và bật lại có kiểm soát

### Milestone 5 — Maintainability và release readiness

- [ ] ARCH-001
- [ ] DOC-001
- [ ] CFG-001
- [ ] UX-001
- [ ] CLEAN-001

---

## Release Gate cuối cùng

### Security

- [ ] Không còn Critical/High security finding chưa xử lý hoặc chưa được chấp nhận rủi ro bằng văn bản.
- [ ] Authorization matrix test pass.
- [ ] Cross-group isolation test pass.
- [ ] Storage policy test pass.

### Database và tài chính

- [ ] Fresh database bootstrap pass.
- [ ] Migration rehearsal pass trên bản sao staging.
- [ ] Payment/settlement/offset/refund idempotency test pass.
- [ ] Có backup và rollback/recovery plan đã diễn tập.

### Application

- [x] Backend tests pass — CI commit `3f9e801`, run `34831556102`; cần chạy lại cho release sau.
- [x] Frontend tests pass — cùng lần chạy CI trên.
- [x] Lint pass — cùng lần chạy CI trên.
- [x] Production build pass — cùng lần chạy CI trên (build kiểm thử, không phải xác nhận deployment).
- [ ] E2E critical flows pass trên staging.

### Operations

- [ ] Production environment variables được kiểm tra, không ghi secret vào repository.
- [ ] CORS chỉ cho phép origin dự kiến.
- [ ] Logging/monitoring/alerts hoạt động.
- [ ] PayOS webhook production được xác minh.
- [ ] Có người chịu trách nhiệm và runbook cho sự cố payment/database.

### Documentation

- [ ] README và architecture khớp implementation.
- [ ] API và database bootstrap được tài liệu hóa.
- [ ] Known limitations được ghi rõ.
- [ ] Có release notes và rollback steps.

---

## Theo dõi tiến độ

| Milestone | Owner | Target date | Status | Ghi chú |
|---|---|---|---|---|
| Security foundation | Codex + chủ dự án nghiệm thu | Theo đợt | In progress | SEC-001 code/test + audit đạt; SEC-002 đã chốt quyền, SEC-003 hoàn tất code/test phần People/Periods; các module khác còn mở trong checklist |
| Database & finance safety |  |  | Not started |  |
| Stable API & testing | Codex + chủ dự án nghiệm thu | Theo đợt | In progress | Bổ sung CI sớm; API/E2E chưa hoàn tất |
| Product completeness |  |  | Not started |  |
| Release readiness |  |  | Not started |  |

## Quy ước trạng thái

- `Not started`: chưa bắt đầu.
- `In progress`: đang triển khai.
- `Blocked`: có blocker được ghi rõ.
- `In review`: đã hoàn thành code, đang review/QA.
- `Done`: đạt Definition of Done và có bằng chứng kiểm thử.

## Đợt ưu tiên — Xếp lịch 8 người/buổi (23/09/2026)

Kế hoạch chi tiết: [SESSION_SCHEDULING_PLAN.md](docs/SESSION_SCHEDULING_PLAN.md). Hướng dẫn bước 1: [SESSION_PLANNING_STAGE1.md](docs/SESSION_PLANNING_STAGE1.md).

- [x] Bước 1A — code/test local: lịch bận thường lệ và ngoại lệ theo kỳ, admin đúng CLB/user tự sửa, revision và audit nguyên tử; migration thử trên PostgreSQL nhúng với dữ liệu giả.
- [x] Kiểm tra khả năng đáp ứng 4 buổi/người theo ngày rảnh và giới hạn 8 người/buổi; thông báo thiếu chỗ thay vì tự giảm chỉ tiêu. Không còn điều kiện chẵn/lẻ trong quy tắc mới.
- [ ] Chạy migration trên schema staging thực, nghiệm thu giao diện và áp dụng Supabase production; code/test local chưa đồng nghĩa đã dùng được trên web thật.
- [x] Bước 1A — người dùng gửi ảnh SQL thành công; kiểm tra REST chỉ đọc xác nhận bảng lịch bận/audit/RPC tồn tại. Chưa nghiệm thu thao tác ghi qua web production.
- [x] Bước 1B/2A — code/test: level thủ công, cặp ưu tiên theo kỳ, tự xếp thử/chỉnh nháp và kiểm tra đầu vào cũ; chưa lưu hay công bố nháp. Đã thử giao diện bằng dữ liệu giả. Xem [SESSION_PLANNING_STAGE2A.md](docs/SESSION_PLANNING_STAGE2A.md).
- [x] Kiểm tra riêng bản stage ngày 24/09/2026 (không `.env`, không gộp thay đổi tài chính dang dở): 125 test backend, 35 test frontend, backend syntax check và frontend lint/build đều đạt. Đã thử tương tác giao diện trên harness cục bộ; chưa phải nghiệm thu production/CI.
- [ ] Chạy migration `20260923_session_planning_profiles.sql` trên staging/schema thực và Supabase production, nghiệm thu frontend/backend/database cùng phiên bản. Thang level 3 mức đang là giả định tạm.
- [ ] Bước 2B — lưu phiên bản nháp, ổn định lịch qua tuần, kiểm tra trùng giờ nhiều CLB, admin duyệt/công bố và thông báo.
- [ ] Bước 3 — đăng ký thêm, ưu tiên cố định trước khách, hàng chờ và cảnh cáo báo nghỉ muộn.
- [ ] Bước 4/5 — điểm danh, tích hợp tài chính an toàn và nghiệm thu toàn luồng.

Bước 1–2A chưa thay đổi lịch buổi cũ, chưa tạo booking, chưa gửi thông báo hoặc phát sinh công nợ. Không tự chạy SQL production. Các phần chưa hoàn tất giữ trạng thái In progress/In review.
