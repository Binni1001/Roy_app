# Chia cầu, đóng kỳ và mượn cầu của quỹ

Áp dụng từ `20261006_shuttle_closeout_and_loans.sql`. Cần đã chạy
`20260814_automatic_balance_offset.sql` và `20260913_shuttle_discount_percent.sql`.
Chạy migration mới một lần qua Supabase SQL Editor trước khi deploy bản app này.
Không tính lại các kỳ đã chốt; preview của kỳ cũ trả kết quả đã lưu.

## Chốt kỳ

1. Thu các khoản nợ đang mở của nhóm trong kỳ hiện tại và các kỳ trước,
   gồm tiền mượn cầu. Preview liệt kê từng người, kỳ và số còn thiếu.
2. Nếu quỹ dương, vào Chi cầu → Dùng quỹ dư bù tiền cầu. Chọn người đã
   ứng tiền và số quỹ thực trả cho họ. Chỉ xác nhận sau khi đã trả tiền.
   Hệ thống đồng thời ghi chi quỹ, giảm phần cá nhân ứng đem chia và lưu
   liên kết phân bổ để giữ lịch sử giá mua ban đầu. Có thể bù nhiều lần
   cho nhiều người; không vượt số dư quỹ hoặc khoản ứng của người đó.
3. Quỹ âm phải được đối soát/thu tiền thực tế. Nếu quỹ dư lớn hơn tổng ứng
   mua cầu, cần xử lý khoản dư bằng nghiệp vụ thu/chi thực tế trước khi chia.
4. Chỉ chốt chia khi quỹ = 0 và không còn nợ trước chia. Không miễn = 1 suất,
   miễn 50% = 0,5 suất, miễn 100% = 0 suất. Phần chịu là tổng cá nhân ứng
   × suất của người / tổng suất. Đồng lẻ phân bổ theo phần dư lớn nhất,
   rồi mức miễn và person_id để kết quả ổn định, tổng luôn khớp.
5. Chốt tạo số dư được nhận hoặc nợ tiền cầu và giữ cơ chế bù số dư cũ.
   Sau đó vào Kỳ quỹ để đóng kỳ khi quỹ vẫn = 0. Nợ tiền cầu phát sinh
   sau chia được phép còn lại. Đóng kỳ đang mở trước khi mở kỳ tiếp theo;
   vẫn có thể chuẩn bị kỳ nháp trước đó.
6. Tiền trả nợ cũ sau đóng kỳ được ghi thu vào kỳ đang mở cùng nhóm.
   Phải mở kỳ tiếp theo trước khi ghi thu nợ cũ để có kỳ nhận dòng tiền.

Giao dịch quỹ liên kết với bù tiền cầu hoặc trả cầu mượn bị khóa sửa/xóa.
Chi phí đã được quỹ bù cũng bị khóa sửa/xóa; chi phí sau chốt không thể đổi.
Luồng Kết chuyển quỹ cũ được thay bằng dùng quỹ dư bù tiền cầu.
Nộp quỹ kèm thanh toán nợ và mua cầu chia nguồn quỹ/cá nhân đều ghi nguyên
khối: lỗi ở một bước sẽ hoàn tác toàn bộ để tránh nợ đã trả mà chưa ghi thu,
hoặc khoản ứng mua cầu đã ghi nhưng chưa ghi chi quỹ.

Ví dụ tháng 8: tổng ứng 1.240.000đ, quỹ bù 255.000đ, còn 985.000đ;
6 người một suất và 2 người nửa suất → tổng 7 suất, một suất khoảng
140.714đ, nửa suất 70.357đ. Đây là ví dụ tính toán, không cập nhật kỳ cũ.

## Mượn cầu đánh sân ngoài

- Owner ghi người đại diện đang hoạt động trong đúng nhóm, ngày mượn,
  số quả, giá mỗi quả tại lần mượn và ghi chú. Giá và số lượng phải nguyên
  dương; không tự lấy giá của lần mua cầu khác.
- Khoản phải trả = số quả × giá mỗi quả. Đây là nghĩa vụ của người đại diện,
  được quản lý riêng trong danh sách Mượn cầu; không cộng vào chi phí cầu
  cuối kỳ và không tự bù bằng số dư cá nhân hay đưa vào QR công nợ khác.
- Khi thực nhận đủ tiền, owner bấm Đã nhận đủ tiền. Database cập nhật trạng
  thái và ghi thu quỹ trong cùng giao dịch. Bấm lại không tạo thêm khoản thu.
- User xem các lượt mình đại diện và tổng còn phải nộp quỹ trên Tổng quan.
- Có thể hủy bản ghi nhầm chưa trả; không hủy khoản đã trả.
- Ghi mượn sau khi đã chia/đóng kỳ bị chặn. Tính năng ghi số quả đã mượn,
  chưa quản lý tồn kho hay tự kiểm tra số quả còn trong từng ống cầu.
- Phân quyền tài chính hiện tại của repo vẫn dành cho owner; admin theo nhóm
  tiếp tục theo rollout tài chính đang có. API user chỉ trả khoản của chính họ.

## Kiểm tra

`node --test backend/tests/shuttle-closeout.test.js` chạy PostgreSQL cô lập
qua PGlite, không truy cập database thật. Kiểm tra nợ cũ, quỹ dư, suất giảm,
đồng lẻ, chốt lặp, khóa lịch sử, chuyển kỳ, mượn/trả/hủy, chống ghi thu hai
lần và quyền SQL. Offset đầy đủ được kiểm tra ở regression riêng trong test.

Ứng dụng chủ động báo thiếu migration ở bước chia/mở kỳ để tránh chạy tiếp
bằng RPC cũ. Các hàm và bảng mới chỉ cấp cho service_role, bật RLS và không
cho anon/authenticated gọi trực tiếp.
