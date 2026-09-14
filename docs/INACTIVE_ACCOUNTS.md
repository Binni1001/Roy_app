# Trạng thái Đã nghỉ

- Request API từ người có people.status = inactive bị chặn bằng 403 ACCOUNT_INACTIVE, kể cả owner/admin và JWT cũ.
- Backend kiểm tra trước idempotency replay. Lookup lỗi thì từ chối request.
- Frontend chặn trước khi chọn portal admin/user, phản ứng khi API báo tài khoản nghỉ; kiểm tra mỗi 30 giây khi trang hiển thị và khi quay lại cửa sổ.
- Admin đang hoạt động có thể sửa hồ sơ để kích hoạt lại. Người đã nghỉ không tự kích hoạt được qua API.
- Thao tác ghi nợ, thêm kỳ, sửa hoạt động cũ, thanh toán mới, PK, giải đấu và chốt cầu kiểm tra người liên quan. Bù số dư hàng loạt chỉ chọn người active.
- Admin đang hoạt động vẫn xem được lịch sử và hủy/dọn bản ghi cũ.
- Chốt cầu có người nghỉ trong danh sách fixed hoặc người ứng tiền bị chặn, không tự chuyển nghĩa vụ sang người khác. Cần xử lý danh sách/nghĩa vụ trước khi cho nghỉ hoặc kích hoạt lại để xử lý.
- Kích hoạt lại không xóa lịch sử hay tự tạo kỳ/trận/nợ mới. Liên kết lịch sử được giữ.
- Webhook PayOS vẫn xử lý tiền đã chuyển theo xác minh hiện có để không bỏ sót giao dịch trước khi tài khoản nghỉ.
- Khóa API ứng dụng không đồng nghĩa xóa Supabase Auth/session. Chính sách truy cập trực tiếp Storage/database được quản lý riêng.

Không có migration mới. Deploy backend và frontend cùng nhau.
Nếu tất cả quản trị viên đều đã nghỉ, người quản lý Supabase cần kích hoạt lại hồ sơ quản trị; API không có đường bypass.
