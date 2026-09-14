# Điều kiện tham gia nghiệp vụ người chơi

- Người chơi phải có trạng thái `active` và không mang role quản trị (`admin`/`owner`). Role khác `user` cũng không được tham gia.
- Backend đối chiếu email hồ sơ với Supabase Auth, đọc đủ các trang và theo thứ tự role đang dùng trong ứng dụng: `app_metadata.role`, rồi `user_metadata.role`, mặc định `user`. Không suy luận từ tên “Admin”. Người được quản lý thủ công chưa có tài khoản Auth vẫn có thể tham gia.
- API danh sách nhân sự bổ sung `account_role` và `activity_eligible`; vẫn giữ hồ sơ quản trị/người đã nghỉ để quản lý và tra cứu lịch sử.
- Form kỳ quỹ, buổi cầu, chi cầu, khoản thu thủ công, thanh toán/nhắc nợ, nộp/hoàn quỹ và giải đấu lọc điều kiện chung. API chọn người PK cũng lọc điều kiện này và không trả email bổ sung ra ngoài.
- Guard hoạt động backend kiểm tra lại role từ Auth trước thao tác; lỗi tra cứu không được bỏ qua. Bù trừ hàng loạt bỏ qua hồ sơ không hợp lệ.
- Admin/owner đang hoạt động vẫn đăng nhập và quản lý hệ thống; chỉ không được dùng làm đối tượng tham gia nghiệp vụ. Không xóa hay chuyển công nợ lịch sử. Nếu dữ liệu cũ chứa quản trị trong kỳ đang chốt, guard báo lỗi để xử lý rõ ràng, không âm thầm chia lại tiền.
- Không cần SQL migration. Cần triển khai cả backend và frontend.
