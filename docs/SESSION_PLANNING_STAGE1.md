# Xếp lịch buổi cầu — triển khai bước 1

Ngày: 23/09/2026. Phạm vi: lịch bận và kiểm tra sức chứa; chưa tạo lịch thi đấu/đăng ký/thông báo/công nợ.

## Đã có trong source

- Panel “Chuẩn bị xếp lịch — bước 1” ở tab Buổi cầu của admin và Lịch buổi đánh của thành viên.
- Quy tắc nền: 8 người, 4 buổi/người, thứ Hai/Ba/Tư/Sáu/Bảy/Chủ nhật, 17:30–19:30, giờ Việt Nam. Không có điều kiện tuyển khách theo chẵn/lẻ.
- Lịch bận thường lệ trong kỳ và ngoại lệ theo ngày Bận/Rảnh; không khai báo mới thì giữ dữ liệu đã lưu.
- Admin theo CLB, user chỉ sửa chính mình; chỉ người cố định trong kỳ, active ở cả hồ sơ và membership, không phải quản trị mới đủ điều kiện.
- Kiểm tra khả năng phân đủ 4 buổi bằng max-flow trên ngày rảnh và sức chứa, không chỉ lấy số người nhân 4. Kết quả chưa phải bản nháp phân lịch.
- Ngày ngoại lệ phải nằm trong kỳ; không mở ngày thứ Năm; tuần không trọn vẹn được cảnh báo và không tự giảm chỉ tiêu.
- Revision và transaction bảo vệ chỉnh sửa đồng thời; lưu thay đổi và audit trong một giao dịch. Auth/group/self được kiểm tra lại trong RPC.
- Giao diện không giữ response cũ khi đổi kỳ/tuần, có retry và thông báo thiếu migration rõ ràng.

## Chưa làm ở bước này

- Chưa nhập level/cặp ưu tiên, chưa chọn/giữ bốn ngày cố định, chưa tự xếp nháp hoặc duyệt/công bố.
- Chưa có slot đặt chỗ, tuyển khách, hàng chờ, cảnh cáo hủy muộn hoặc thông báo lịch.
- Chưa thay đổi giới hạn ở luồng ghi buổi/ghi khách cũ: con số 8 hiện dùng trong công cụ chuẩn bị xếp lịch, chưa phải kiểm soát booking đã triển khai.
- Chưa nối điểm danh/tài chính; không chạy các trigger/RPC tài chính và không sửa dữ liệu lịch sử.
- Chưa kiểm tra xung đột lịch đã xác nhận ở CLB khác vì chưa có dữ liệu booking của luồng mới.

## API

- `GET /api/session-planning/period/:periodId?week_start=YYYY-MM-DD`: thứ Hai của tuần; bỏ qua query thì chọn tuần hiện tại nằm trong kỳ hoặc tuần gần nhất ở biên kỳ.
- `PUT /api/session-planning/period/:periodId/people/:personId`: body chỉ nhận `expected_revision`, `busy_weekdays` (ISO 1–7), `date_overrides` (ngày → `busy`/`available`).
- Bản chưa lưu có revision 0; mỗi lần lưu thành công tăng 1. Stale revision trả 409 và yêu cầu tải lại, không ghi đè.
- Cả admin và user phải qua JWT/account status. Scope nhóm/self trong service và RPC; không đi qua cache replay chung để tránh trả dữ liệu sau khi bị thu hồi quyền.
- User không nhận lịch bận/email của người khác. Frontend không đọc trực tiếp bảng mới bằng Supabase anon key.
- Thiếu migration trả 503 `PLANNING_SCHEMA_NOT_READY`, không tự tạo bảng hoặc fallback ghi nơi khác.

## Migration — cần chạy riêng, chưa chạy trên Supabase thật

File: `supabase/20260923_session_planning_preferences.sql`.

Chỉ tạo hai bảng `session_planning_preferences`, `session_planning_preference_audits` và một RPC `save_session_planning_preferences`. Không UPDATE/DELETE các bảng dữ liệu cũ, không tạo nợ, không tự tạo buổi.

1. Xác nhận đúng project Supabase, có backup/recovery phù hợp. Ưu tiên thử trên staging với schema thực trước.
2. Kiểm tra schema thực: `periods` có group/status/start_date/end_date, `period_members` có period/person/status=fixed, `people` có email/status, `person_groups` có group/person/status/member_role; `auth.users` có `raw_app_meta_data`. Đã đối chiếu tên cột public qua REST chỉ đọc; đó không thay thế export đầy đủ FK/index/trigger.
3. Chạy toàn bộ file SQL trong một lần tại SQL Editor. Script có BEGIN/COMMIT; lỗi thì không tiếp tục chạy riêng từng nửa.
4. Kiểm tra RLS được bật trên cả hai bảng. Anon/authenticated không có quyền đọc/ghi hay thực thi RPC. Backend service_role chỉ đọc trực tiếp; ghi qua RPC đã kiểm tra quyền.
5. Triển khai backend và frontend tương thích. Nếu code lên trước SQL, chỉ panel mới báo chưa cài đặt khi mở; luồng cũ vẫn dùng độc lập.
6. Admin mở Buổi cầu → Lịch bận và sức chứa; user cố định mở Lịch buổi đánh → cùng nút. Thử sửa một ngày, tải lại, đối chiếu revision/audit; dùng tài khoản test trên staging.
7. Thử hai cửa sổ sửa cùng phiên bản: lần sau nhận 409. Kiểm tra admin khác CLB/user khác người bị 403; kỳ đóng chỉ xem.
8. Chỉ sau smoke test và xác minh deploy mới tick hoàn tất triển khai production trong checklist.

Nếu dừng rollout: tắt/gỡ panel và endpoint mới trong bản code kế tiếp; giữ nguyên hai bảng và audit đã có người dùng. Không DROP để “rollback”, không xóa lịch bận hoặc lịch sử. Không thay đổi kỳ/quỹ để sửa lỗi lịch.

## Bằng chứng kiểm thử và giới hạn

- Đã xuất riêng đúng bản Git được stage (không mang `.env` hay thay đổi tài chính dang dở) và chạy lại: **108 test backend**, **30 test frontend**, backend syntax check, frontend lint/build đều đạt. Đây là kiểm thử local trên bản sẽ commit, chưa phải kết quả CI/deploy.
- `backend/tests/session-planning.test.js`: 12 test cấu hình, ngày, max-flow, privacy, nhóm/self, trạng thái, lỗi schema và revision.
- `backend/tests/session-planning-sql.test.js`: migration chạy thật trên PostgreSQL nhúng PGlite với schema tối thiểu và dữ liệu hoàn toàn giả; 8 subtest, gồm rerun giữ dữ liệu, quyền RPC/table, rollback khi audit lỗi, revision và hai CLB.
- `frontend/tests/session-planning.test.js`: 3 test utility/contract về ngày, payload, tích hợp và bảo vệ response cũ.
- Kiểm thử SQL này không phải diễn tập trên bản sao production. PGlite chỉ có một kết nối độc quyền; test hai yêu cầu cùng revision không thay thế stress test đa kết nối của PostgreSQL/Supabase.
- Chưa nghiệm thu tương tác trình duyệt/staging với tài khoản thực. Lint/build và contract test không được coi là E2E.

Tài liệu kỹ thuật tham chiếu: [PGlite — chạy PostgreSQL trong bộ nhớ](https://pglite.dev/docs/), [PostgreSQL — khóa giao dịch](https://www.postgresql.org/docs/current/explicit-locking.html).

## Bước tiếp theo

Nhập level và cặp ưu tiên, sau đó dựng bộ xếp nháp tuần và màn hình admin duyệt. Cần chốt thang level, thời điểm nhận lịch bận/mở đăng ký, giữ ngày cố định trong kỳ và chính sách tuần giao hai kỳ. Không cần tự giảm 4 buổi hoặc tăng sức chứa để vượt qua báo thiếu chỗ.
