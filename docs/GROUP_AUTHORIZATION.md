# SEC-002 / SEC-003 — Quyền theo nhóm

## Quyết định đã được chủ dự án xác nhận

- **Owner** là quản trị toàn hệ thống, không cần membership ở nhóm đích để có quyền quản lý.
- **Admin** chỉ quản lý nhóm được owner phân công. Nhóm đang xem không tự tạo ra quyền.
- **User** không có quyền quản trị; quyền xem kỳ dựa vào membership `active` của chính họ.
- Trạng thái tài khoản `inactive` vẫn chặn mọi role; quản trị không được chọn làm người chơi.

## Nguồn sự thật

`app_metadata.role` quyết định role toàn cục. `app_metadata.managed_group_ids` chứa mảng UUID nhóm được phân công cho admin. Cả hai được đọc từ Auth đã xác thực, không từ body/query hoặc `user_metadata`.

`person_groups` lưu membership người chơi, **không cấp quyền admin toàn cục**. `people.active_group_id` chỉ là nhóm đang xem. `people.group_id` được dùng cho hồ sơ legacy chỉ khi hồ sơ chưa có membership; không ghi đè thông tin membership hiện có.

Chỉ owner được gọi `PUT /api/admin-users/:id/groups`. Backend kiểm tra role đích phải là admin, từng nhóm phải tồn tại, tối đa 100 nhóm. Mảng rỗng thu hồi toàn bộ phạm vi nhóm. Không thay role khi cập nhật nhóm; cập nhật chỉ key cần thiết để tránh ghi đè role vừa bị thu hồi ở request khác. Cơ chế merge metadata được đối chiếu với [Supabase Auth — UpdateAppMetaData](https://github.com/supabase/auth/blob/master/internal/models/user.go).

Thu hồi global admin cũng xóa phân công. Cấp admin mới không tự cấp nhóm từ hồ sơ cũ. Không có migration SQL và không tự thay đổi tài khoản production trong quá trình triển khai code.

## Ma trận endpoint đã triển khai trong đợt 2.1

| Endpoint | Owner | Admin | User |
|---|---|---|---|
| GET `/admin-users`, GET `/admin-users/groups` | Toàn hệ thống | 403 | 403 |
| POST `/admin-users`, DELETE `/admin-users/:id`, PUT `/admin-users/:id/groups` | Cho phép, không revoke/assign owner | 403 | 403 |
| GET `/people` | Tất cả hồ sơ | Chỉ người có membership/legacy group trong các nhóm được phân công | 403 |
| GET `/people/:id` | Bất kỳ hồ sơ | Kiểm tra nhóm trên ID thật; không trả membership/ID nhóm ngoài phạm vi | 403 |
| POST `/people` | Nhóm đích đã chọn, hoặc fallback một nhóm duy nhất | Nhóm đích phải được phân công; không tạo hồ sơ liên kết Auth quản trị | 403 |
| PUT `/people/:id`, PUT `/people/:id/password`, DELETE `/people/:id` | Quản lý hồ sơ toàn hệ thống | Chỉ hồ sơ user mà mọi nhóm liên quan đều trong phạm vi; không đổi email/group | 403 |
| GET/POST/PUT `/people/me` | Hồ sơ chính mình | Hồ sơ chính mình | Hồ sơ chính mình; không sửa role/phân công qua endpoint này |
| GET `/periods` | Tất cả kỳ | Query theo nhóm được phân công | Query theo membership active |
| GET `/periods/:id` | Bất kỳ kỳ, kể cả legacy chưa gắn nhóm | Kiểm tra nhóm của kỳ | Kiểm tra membership active trong nhóm của kỳ |
| POST `/periods`, PUT `/periods/:id` | Nhóm bất kỳ, giữ validation dữ liệu | Nhóm của kỳ/nhóm tạo phải được phân công | 403 |
| GET `/groups/mine`, PUT `/groups/switch/:groupId` | Xem/chọn tất cả nhóm | Chỉ nhóm được phân công | Chỉ membership hợp lệ theo quy tắc sẵn có |
| GET `/groups/info`, PUT `/groups/regenerate-code` | Nhóm đang chọn; có thể chỉ định `group_id` | Nhóm được phân công | 403 |
| POST `/groups/create` | Cho phép | 403 | 403 |
| GET `/groups/pending`, PUT `/groups/members/:personId/approve` hoặc `/reject` | Owner theo nhóm đích; kiểm tra membership đích | 403 | 403 |
| POST `/groups/verify-code`, POST `/groups/join`, DELETE `/groups/:groupId/leave` | Theo quy tắc membership sẵn có | Không cấp thêm phân công quản trị | Theo quy tắc membership sẵn có |

Tiền tố chung `/api` được lược trong bảng. Owner thiếu hồ sơ vẫn có thể xem danh sách nhân sự/kỳ toàn hệ thống. Khi cần tạo dữ liệu, nhóm đích phải rõ; chỉ chọn tự động khi hệ thống có một nhóm. Thao tác đổi nhóm lưu trên hồ sơ vẫn cần hồ sơ.

Hồ sơ dùng chung nhiều nhóm chứa email/mật khẩu/trạng thái toàn cục. Admin chỉ được sửa nếu quản lý **tất cả** nhóm của hồ sơ, và không được sửa hồ sơ Auth quản trị. Trường hợp khác cần owner để tránh ảnh hưởng tài khoản ở nhóm ngoài phạm vi. Avatar Storage policy riêng vẫn cần SEC-004; không tuyên bố API guard đã bảo vệ đường upload trực tiếp.

## Rollout có giới hạn — chưa hoàn tất SEC-003

**Cập nhật code 23/09/2026 (chưa nghiệm thu deploy):** đã mở GET/HEAD của `period-members`, `guest-attendances`, `badminton-sessions` cho admin theo nhóm; mở POST/PUT buổi cầu. Middleware xác minh kỳ/entity thực tế trước replay và kiểm tra membership active khi thêm người. Các mutation thành viên/khách và DELETE buổi cầu vẫn trả `GROUP_FINANCE_SCOPE_NOT_READY` cho admin. UI tương ứng có danh sách chỉ xem, nút theo quyền, loading/error/retry; không tải các API tài chính bị khóa. Các mô tả khóa toàn module bên dưới là trạng thái đợt 2.1 trước cập nhật này.

`session-planning` được mở cho admin theo nhóm và user tự khai báo. Kỳ được kiểm tra ở service; RPC kiểm tra lại trusted Auth role, managed_group_ids, trạng thái và fixed membership. Panel mới chỉ chuẩn bị lịch bận, không mở các quyền ghi khách/công nợ. Ordinary user không nhận lịch bận của người khác. Xem `SESSION_PLANNING_STAGE1.md` cho migration và kiểm thử.

Các module còn lại (`period-members`, sessions/guests, debts, balances/offsets, fund/shuttle, payments, dashboard, PK, tournaments, notifications) **tạm trả 403 cho admin**, với code `GROUP_SCOPE_NOT_READY`. Owner tiếp tục dùng quy tắc sẵn có; user không được mở rộng quyền. Giao diện admin hiện thông báo rõ, không trình bày quỹ/công nợ bằng 0 và không tải các API đang khóa. Kỳ quỹ hiện chỉ mở quản lý thông tin kỳ cho admin, chưa mở thành viên trong kỳ.

Lý do: các truy vấn/ID của những module này chưa được nghiệm thu cách ly. Chỉ bỏ từng module khỏi guard sau khi có cả kiểm tra list, ID, liên kết con và test hai nhóm. **Không bật lại multi-group UI hoặc đánh dấu toàn bộ ứng dụng an toàn đa nhóm ở đợt này.**

## Retry và thay đổi quyền

Middleware đọc lại phân công từ Auth mỗi request. Idempotency cache có thêm role và tập nhóm trong scope; không replay kết quả theo quyền cũ sau khi thu hồi. Với sửa/xóa hồ sơ và sửa kỳ, quyền trên entity còn được kiểm tra trước khi tới cache, để thay đổi membership cũng có hiệu lực. Đây vẫn là cache in-memory; phần đảm bảo bền vững đa instance thuộc OPS-003.

## Sử dụng và nghiệm thu

Owner vào **Tổng quan → Danh sách quản trị viên → Phân công nhóm**. Chọn nhóm rồi Lưu. Khi bỏ chọn tất cả, admin không còn phạm vi quản lý nhóm. Thao tác này không biến admin thành người chơi.

Test local dùng Auth/DB mock, không mời hay sửa tài khoản thật:

- `backend/tests/group-authorization.test.js`: hai nhóm A/B, list/ID/mutation, hồ sơ chung, giả metadata, phân công không tồn tại, owner toàn cục, kiểm tra trước replay.
- `backend/tests/idempotency.test.js`: đổi role/phân công không replay dữ liệu đặc quyền trước đó.
- `frontend/tests/group-assignment-contract.test.js`: wiring màn hình phân công, trạng thái lỗi/lưu và thông báo phạm vi rollout.

Còn nghiệm thu trên môi trường test sau deploy: owner phân công/thu hồi một admin thử; admin A không truy cập B; thử thay ID/body; kiểm tra session đang mở và retry; kiểm tra UI lưu lỗi giữ modal. Không tạo hoặc đổi quyền admin thật chỉ để làm test.

Bằng chứng 14/09/2026: 69 test backend, 25 test frontend, lint/build đạt. Commit `c2d1961` đã push; [CI run 34834736485](https://github.com/Binni1001/Roy_app/actions/runs/34834736485) thành công cả hai job. Audit Auth chỉ đọc trước rollout: 1 owner, 0 admin; không thay đổi quyền/phân công thực tế.

## Tiếp theo

### Bổ sung 15/09/2026 — scope API buổi cầu, chưa mở lại màn hình admin

- Danh sách buổi cầu lọc ngay trong database qua nhóm của kỳ; không tải mọi buổi rồi lọc ở frontend. Owner vẫn xem toàn hệ thống.
- GET theo kỳ kiểm tra membership nhóm đang hoạt động của user; ID kỳ nhóm khác bị từ chối. Tra cứu ID buổi, tạo, sửa và xóa đều kiểm tra kỳ thực tế trước khi trả dữ liệu hoặc ghi.
- Sửa buổi chỉ trong kỳ đang mở, không cho chuyển kỳ qua payload. Số cầu phải là số nguyên không âm trong giới hạn an toàn.
- Guard kiểm tra entity trước idempotency replay đã bổ sung buổi cầu để chuẩn bị mở admin. **Rollout guard vẫn khóa module này với admin** cho tới khi kiểm tra đồng bộ khách/thành viên và UI. Test service quyền admin không có nghĩa endpoint admin đã mở.
- `backend/tests/session-group-scope.test.js`: 8 test hành vi bổ sung, dùng DB mock; chưa thay dữ liệu thật và chưa nghiệm thu truy vấn trên Supabase triển khai.

Phụ thuộc tài chính tìm thấy khi rà luồng: `supabase/20260814_automatic_balance_offset.sql` có trigger `debts_auto_offset_after_insert` gọi `offset_person_unpaid_debts`, xử lý số dư/công nợ theo người trên toàn hệ thống. Vì vậy tạo nợ tháng/khách cần xử lý FIN/DB trước khi mở cho admin theo nhóm; chỉ kiểm tra ID ở API là chưa đủ. Các luồng sửa/xóa khách còn cần kiểm tra giữ lịch sử nợ đã trả và tính nguyên khối. Không sửa trigger hay chạy migration production trong đợt này.

1. Period Members, Sessions/Guests: scope kỳ và toàn bộ người tham gia, đồng bộ debt không vượt nhóm.
2. Debts/Payments/Fund/Shuttle/Balances: đặc biệt sổ dư theo người đang tổng hợp toàn hệ thống; cần phân tách truy vấn và giao dịch theo nhóm trước khi mở cho admin.
3. PK/Tournament/Notifications/Dashboard: kiểm tra list, entity con, quyền participant và tổng hợp.
4. Hoàn thiện owner UI chọn nhóm, ma trận toàn bộ endpoint và E2E hai nhóm; sau đó mới nghiệm thu SEC-002/003.
