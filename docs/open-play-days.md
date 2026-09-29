# Buổi tự đăng ký

## Kích hoạt

1. Chạy toàn bộ `supabase/20260929_open_play_days.sql` trong Supabase SQL Editor của dự án Roy.
2. Vercel triển khai cả frontend và backend từ commit mới trên GitHub.
3. Trong kỳ **đang mở**, admin vào Buổi cầu → Buổi tự đăng ký → Mở ngày tự đăng ký.
4. Dùng tài khoản thành viên cùng CLB kiểm tra ngày đó có nút Đăng ký tham gia, rồi kiểm tra danh sách bằng tài khoản admin.

Migration có thể chạy lại mà không mất đăng ký. Không phụ thuộc migration lịch bận/xếp nháp. Nếu chưa chạy, riêng mục Buổi tự đăng ký hiện thông báo chưa kích hoạt và nút làm mới; những phần còn lại vẫn dùng bình thường.

## Quy tắc đã thống nhất

- Admin có ba mục: Lịch tuần, Xếp lịch cố định, Buổi đã chơi. Lịch cố định hiện vẫn là bản nháp, chưa công bố.
- Mọi ngày tự đăng ký (kể cả đã đóng đăng ký) bị loại khỏi xếp nháp cố định và chỉnh người thủ công. Mở thêm ngày làm bản nháp cũ hết hiệu lực khi kiểm tra lại.
- Chỉ tiêu cố định vẫn 4 buổi/người; nếu không đủ ngày/chỗ, hệ thống báo thiếu, không tự điền vào ngày tự đăng ký.
- Phần xếp cố định cần đọc được bảng ngày tự đăng ký. Nếu chưa chạy migration hoặc truy vấn lỗi, hệ thống dừng xếp thử để tránh xếp nhầm ngày.

- Admin chỉ mở/đóng ngày của CLB được phân công; owner quản lý mọi CLB.
- Ngày nằm trong kỳ đang mở; admin được chọn cả thứ Năm.
- Thành viên đang hoạt động trong CLB được tự đăng ký; không bắt buộc là thành viên cố định của kỳ. Admin/owner hiện không phải người chơi theo mô hình sẵn có.
- 8 chỗ, ai đăng ký trước giữ chỗ trước; đăng ký và hủy trước 17:30 ngày chơi, múi giờ Việt Nam. Giờ chơi 17:30–19:30.
- Đóng đăng ký giữ nguyên danh sách, người đã đăng ký vẫn được hủy trước giờ chơi. Admin có thể mở lại trước giờ chơi.
- Không tự tính vào 4 buổi cố định, không tạo buổi đã diễn ra, khách vãng lai, công nợ hoặc thanh toán. Admin ghi nhận buổi thực tế bằng luồng hiện có.

## Bảo đảm dữ liệu

- RPC chỉ cho service role gọi; nhận actor từ JWT đã xác thực. RPC kiểm tra lại vai trò, CLB, trạng thái thành viên/kỳ và thời gian.
- Khóa giao dịch theo kỳ/ngày cho mọi thao tác để không vượt 8 chỗ; khóa chính chặn đăng ký trùng.
- Thành viên nhận số người và trạng thái đăng ký của mình; admin nhận thêm tên người đăng ký, không trả email/Auth metadata.
- Khi rollback ứng dụng, giữ hai bảng và RPC để bảo toàn đăng ký đã có. Không xóa dữ liệu để rollback giao diện.

## Kiểm tra tự động

`cd backend` → `node --test tests/open-days.test.js tests/open-days-sql.test.js`

SQL được thực thi trên PostgreSQL nhúng PGlite với dữ liệu giả. Kiểm tra sức chứa, trùng lặp, hủy, đóng/mở, quyền nhóm, hạn giờ, RLS và chạy lại migration. PGlite xử lý truy vấn tuần tự, không thay thế bài tải nhiều kết nối trên production PostgreSQL.
