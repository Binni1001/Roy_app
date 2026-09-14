# SEC-001 — Nguồn role tin cậy

## Quy tắc

Chỉ `app_metadata.role` do máy chủ quản lý được dùng để xác định quyền. Giá trị hợp lệ: `user`, `admin`, `owner`. Thiếu hoặc sai giá trị → `user`. Không dùng `user_metadata.role`, tên, email hiển thị hay payload request để cấp quyền.

Supabase cảnh báo `user_metadata` có thể do người dùng tự sửa, không dùng trong phân quyền: [Users — Supabase](https://supabase.com/docs/guides/auth/users). Thao tác quản trị hợp lệ ghi `app_metadata` qua API máy chủ: [updateUserById](https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid).

- Backend dùng `src/utils/roles.js` cho middleware, danh sách/cấp/thu hồi admin và bộ lọc người chơi.
- Frontend dùng quy tắc tương đương; test đối chiếu hai phía. Session có thay đổi role được cập nhật khi nhận sự kiện Auth, không giữ nguyên portal chỉ vì ID tài khoản không đổi.
- API kiểm tra user hiện tại bằng `getUser(token)` mỗi request mới. Role trong giao diện hoặc token cũ không thay thế kiểm tra backend.
- Mời admin mới không ghi role vào metadata tự sửa được; quyền chỉ có hiệu lực sau khi ghi `app_metadata` thành công.
- Owner/admin đang hoạt động vẫn quản lý hệ thống nhưng không là đối tượng nghiệp vụ người chơi. Người đã nghỉ vẫn bị chặn bất kể role.

## Kiểm tra trước rollout (chỉ đọc)

Tại `backend/`: `node scripts/audit-auth-roles.mjs`.

Script dùng cấu hình backend, đọc đủ trang Auth và chỉ in số lượng tổng hợp; không đổi quyền, không in email/ID/token/metadata đầy đủ. Exit 0: không phát hiện bất thường được kiểm tra; exit 2: cần xem lại role cũ, role không hợp lệ hoặc thiếu owner tin cậy; exit 1: kiểm tra không thành công.

Kết quả 14/09/2026 trên Supabase đang cấu hình của dự án: 19 tài khoản, 1 owner tin cậy, 18 tài khoản không có app role (hiệu lực `user`), 0 role không hợp lệ, 0 tài khoản quản trị chỉ có role cũ, 0 metadata xung đột. Không cần thay đổi tài khoản. Đây không phải kiểm thử đăng nhập production sau deploy.

Nếu lần kiểm tra khác phát hiện quản trị chỉ có role cũ, dừng rollout để xác minh danh tính/quyền bằng nguồn quản trị độc lập. **Không tự sao chép `user_metadata.role` sang `app_metadata.role`**. Nếu cần khôi phục truy cập, chủ dự án dùng kênh quản trị Supabase để cấp đúng quyền cho tài khoản đã xác minh, không bật lại fallback không an toàn.

## Bằng chứng local và nghiệm thu triển khai

- `backend/tests/auth-roles.test.js`: middleware thật với Auth/DB được mock; giả role bị 403; role hợp lệ qua guard; thiếu/sai token bị 401; thu hồi quyền được đọc mới; owner không bị revoke; invite/revoke ghi nguồn đúng.
- `backend/tests/activityEligibility.test.js`: danh sách chọn dùng nguồn role mới, đọc đủ trang, lỗi kiểm tra không bị bỏ qua.
- `frontend/tests/auth-roles.test.js`: metadata tự sửa không mở portal quản trị.
- Các test không gửi lời mời, không đổi quyền và không tạo tài khoản thật.
- Sau deploy cả hai project: kiểm tra owner hợp lệ đăng nhập/quản lý, user chỉ vào portal người dùng, danh sách chọn không chứa owner, tài khoản nghỉ vẫn bị chặn. Chỉ kiểm thử giả role trên tài khoản/môi trường thử được cho phép; không thay metadata tài khoản thật để tạo bằng chứng.
- Chưa hoàn tất cách ly nhóm SEC-002/003 trong thay đổi này.
