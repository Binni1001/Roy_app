# Hiển thị và sửa tỷ số Đấu trường

- Thẻ trận user và quản trị hiển thị tổng set thắng cùng điểm từng set, ví dụ
  `2–1 set thắng`, `Set 1: 21–19`, `Set 2: 15–21`, `Set 3: 21–18`.
- Trận cũ không có tỷ số set chỉ hiển thị chưa lưu; không đoán hay điền lại điểm.
- Ở kỳ đang mở, quản trị chọn **Sửa tỷ số** trên trận đã hoàn tất. Form điền sẵn
  bên thắng và các set cũ, kiểm tra điểm nguyên không âm, không hòa mỗi set,
  số set không vượt cấu hình và bên thắng khớp đa số set.
- Xác nhận sửa sẽ cập nhật kết quả và lưu bản trước/sau, người sửa, thời điểm trong
  `pk_match_audits`. Điểm/hiệu số/đối đầu theo +3/−2 đọc lại từ kết quả mới; kỳ Elo
  đang mở dùng đúng phiên bản Elo của kỳ. Người chơi không có quyền sửa kết quả đã khóa.
- Kỳ đã đóng, bản lưu lịch sử và trận đã hủy kết quả không được sửa.
- Nếu trận vừa được người khác sửa, server từ chối bản cũ và giao diện tải lại để
  người quản trị mở kết quả mới. Chốt kỳ và sửa tỷ số dùng cùng khóa ghi.

## Triển khai

Sau migration `20261011_pk_fixed_points.sql` đã áp dụng, chạy một lần file bổ sung
`supabase/20261011_pk_result_correction.sql` trong Supabase SQL Editor, rồi deploy
mã mới. File này chỉ tạo RPC sửa kết quả, không chạy cập nhật trận hoặc bảng cũ.
Các thao tác tài chính/PK cho admin theo nhóm vẫn theo rollout hiện tại của repo;
owner có thể dùng nút sửa trên giao diện quản trị.

## Kiểm tra

`node --test backend/tests/pk-result-edit.test.js`

`node --test --test-name-pattern="result correction" backend/tests/pk-fixed-sql.test.js`

Test PostgreSQL cô lập dùng RPC thật: đổi bên thắng, kiểm tra +3/−2 và hiệu số,
audit trước/sau, lỗi tỷ số, xung đột bản sửa cũ, khóa kỳ đã đóng và quyền SQL.
Không sửa dữ liệu production khi chạy test.
