# OPS-001 — Kiểm tra tự động

Workflow `.github/workflows/quality.yml` chạy khi push `main`, PR vào `main` hoặc chạy thủ công. Hai job độc lập dùng Node.js 22 và `npm ci` từ lockfile:

- `Backend tests`: kiểm tra syntax và chạy toàn bộ backend tests.
- `Frontend checks`: lint, tests và production build với cấu hình giả, không kết nối production.

Workflow không cần secret Supabase/PayOS/Vercel, không chạy audit tài khoản live, không sửa database và không tự deploy. Quyền GitHub chỉ `contents: read`; checkout không giữ credential. Mỗi job giới hạn 10 phút.

Mẫu sử dụng Node, lockfile và Actions tham khảo [GitHub — Building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs).

## Phần cần cấu hình/xác minh trên dịch vụ

1. Xem lần chạy đầu tại tab Actions, bảo đảm cả hai job đạt trên Linux từ checkout sạch.
2. Cấu hình ruleset/branch protection cho `main`: bắt buộc hai status checks trên. Kiểm tra quyền bypass và đường push trực tiếp đang dùng trước khi bật để không vô tình chặn quy trình của chủ dự án.
3. Vercel Git integration có thể deploy song song với Actions; có workflow **không đồng nghĩa deploy đã bị chặn khi test lỗi**. Cần chốt quy trình PR/merge hoặc cơ chế deployment gate của cả hai project và kiểm tra với một bản test thất bại.
4. Database baseline/migration ordering gate bổ sung sau DB-001; hiện không tuyên bố các migration dựng được database trống.

Không đánh dấu hoàn thành toàn bộ OPS-001 khi các bước remote này chưa được nghiệm thu.
