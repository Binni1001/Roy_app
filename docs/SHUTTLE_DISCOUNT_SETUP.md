# Miễn tiền cầu theo kỳ: 0%, 50%, 100%

Đây là quy tắc của phiên bản 20260913. Phiên bản mới dùng số suất
(50% = nửa suất) và điều kiện quỹ về 0; xem [SHUTTLE_CLOSEOUT_SETUP.md](SHUTTLE_CLOSEOUT_SETUP.md).

## Quy tắc

- Tổng tiền chia là tổng tiền cá nhân đã ứng trong shuttle_expenses.total_amount; phần quỹ đã chi không được cộng vào khoản này.
- Chia đều tổng tiền ứng cho tất cả thành viên fixed trong kỳ để lấy mức ban đầu.
- Người miễn 50% chịu một nửa mức ban đầu; người miễn 100% chịu 0.
- Phần được giảm chia đều cho các thành viên fixed không miễn.
- Làm tròn phần của người được giảm tới đồng; phần còn lại chia cho người không miễn, phân bổ đồng lẻ theo person_id ổn định. Tổng phân bổ luôn khớp tổng tiền ứng.
- Nếu tổng tiền > 0 mà không có người không miễn, không cho chốt.
- Số được nhận/bù nợ = tiền đã ứng − phần phải chịu. Người miễn hoàn toàn hoặc không còn fixed nhưng đã ứng tiền vẫn được ghi nhận đầy đủ khoản ứng.
- Phí cố định kỳ không thay đổi.
- Sau khi chốt, khóa mức miễn, trạng thái và thêm/xóa thành viên để giữ nguyên danh sách đã tính. Preview sau chốt đọc lại kết quả đã lưu.

## Cài đặt

1. Sao lưu database và kiểm tra trên staging theo quy trình hiện tại.
2. Đảm bảo đã chạy migration 20260814_automatic_balance_offset.sql.
3. Chạy supabase/20260913_shuttle_discount_percent.sql một lần trong Supabase SQL Editor.
4. Deploy backend và frontend cùng thay đổi này.
5. Vào Kỳ quỹ → Thành viên trong kỳ → Sửa → chọn Không miễn / Miễn 50% / Miễn hoàn toàn.
6. Vào Chi cầu để kiểm tra bảng phân bổ rồi chốt.

Migration chuyển exempt_shuttle=true cũ thành 100%. Không tính lại hay sửa khoản nợ/số dư của kỳ đã chốt. Cột boolean được giữ và đồng bộ để tương thích dữ liệu cũ.

## Kiểm thử tự động

Từ thư mục gốc:

```powershell
npm install --prefix backend/node_modules/.shuttle-sql-test --no-save --package-lock=false @electric-sql/pglite
node backend/scripts/verify-shuttle-discount.mjs
```

Script dùng PostgreSQL cô lập trong bộ nhớ với fixture tối thiểu. Kiểm tra migration, dữ liệu miễn cũ, phân bổ, làm tròn, hoàn ứng, tổng nợ/credit, chống chốt lặp và khóa thành viên. Hàm offset được stub trong fixture; các integration với Supabase Auth, PayOS và bù nợ production cần xác minh riêng trên staging.

Ví dụ: 1.000.000đ, 10 thành viên, một người miễn 50% → người đó chịu 50.000đ; năm người chịu 105.556đ và bốn người chịu 105.555đ.
