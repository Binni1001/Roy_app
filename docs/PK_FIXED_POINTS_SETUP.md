# Luật Đấu trường +3/−2 theo kỳ

Kỳ áp dụng đầu tiên: Mùa 5, ID `373a7ed1-0e18-502d-9120-225b2f3c2179`,
10/10/2026–9/11/2026, nhóm Roy hiện tại. Đã kiểm tra kỳ chưa có trận khi chuẩn bị.

## Luật

- Bắt đầu từ 0, thắng +3, thua −2, cho phép điểm âm. Không có hệ số cao cho
  5 trận đầu và không trừ điểm do nghỉ lâu. Từ cập nhật 13/10, bỏ điều kiện 5 trận:
  bỏ luôn điều kiện 3 đối thủ. Người có một trận hoàn tất được lên bảng. Bảng lịch sử
  đã lưu trước cập nhật tiếp tục giữ kết quả và điều kiện tại thời điểm chốt.
- Tổng điểm cầu ghi được trừ tổng điểm cầu bị ghi qua tất cả các set là hiệu số.
- Đơn và đôi riêng; điểm/hiệu số đôi thuộc từng người. Thay đồng đội không reset số liệu.
- So điểm, rồi hiệu số. Nếu còn hòa, so thắng trừ thua trong các trận đối đầu
  thuộc nhóm còn hòa. Một trận tính một lần cho mỗi người, dù có hai người trong
  nhóm hòa ở bên đối diện. Đồng đội cùng bên không tính là đối đầu.
- Chỉ dùng đối đầu khi mọi cặp trong nhóm hòa đã gặp nhau ở hai bên đối diện;
  nếu chưa đủ đối đầu, hoặc vẫn ngang nhau sau đối đầu, cùng hạng. Ví dụ 1,1,3.
  Thứ tự tên trong nhóm cùng hạng chỉ để hiển thị. Mọi người tự bàn bạc bên ngoài;
  không tự tạo trận quyết định hay ghi thứ hạng do bàn bạc vào hệ thống.

## Giữ lịch sử

- `periods.pk_scoring_rule` lưu phiên bản luật: `elo_v1`, `legacy_wilson_v1`,
  `fixed_3_2_v1`. Kỳ đã có trận hoặc đã đóng không đổi luật.
- Các kỳ cũ được lưu cả bảng đơn/đôi vào `pk_leaderboard_snapshots`. API đọc
  bản lưu trước, không tính lại bảng cũ bằng công thức mới. Avatar có thể lấy từ
  hồ sơ hiện tại; thứ hạng, tên lưu, điểm và thành tích được giữ cố định.
- Tháng 6 vẫn đọc bản Wilson khôi phục đã đóng gói cùng backend.
- Sổ Elo cũ không bị xóa, sửa hay dựng lại khi nâng cấp. Hàm Elo gốc được giữ
  nguyên trong phiên bản riêng; các trận mới chỉ dùng Elo nếu kỳ mang luật Elo.
- Kỳ +3/−2 tính từ kết quả trận đã khóa; không tạo điểm giả trong sổ Elo.
- Sửa/hủy trận trong kỳ đang mở chỉ ảnh hưởng kỳ đó. Kỳ đã đóng khóa mọi thao tác
  sửa trận và tính lại. Snapshot không cho sửa/xóa.
- Khi đóng kỳ, backend tính cả hai bảng. RPC kiểm tra dấu vết dữ liệu trận dưới
  khóa ghi rồi lưu hai bảng và đóng kỳ trong một giao dịch. Nếu vừa có kết quả
  mới hoặc kiểm tra quỹ thất bại, toàn bộ thao tác bị hoàn tác.

## Triển khai

1. Bản sao trước nâng cấp: `private operator backup (not stored in public Git)`.
   Có bảng đang hiển thị, dữ liệu Elo và hash cho từng kỳ đã đóng.
2. Chạy **một lần** `supabase/20261011_pk_fixed_points.sql` qua Supabase SQL Editor
   trước khi deploy mã mới. Cần đã chạy các migration Elo 20260713, sửa kèo 20260803
   và chốt quỹ 20261006. Không chạy lại các migration cũ.
3. Migration tự kiểm tra Mùa 5 còn chưa có trận và dữ liệu Elo cũ khớp bản sao.
   Nếu không khớp, transaction dừng; cần đối soát, không bỏ các điều kiện kiểm tra.
4. Sau thành công, deploy backend/frontend rồi kiểm tra Mùa 5 hiển thị +3/−2,
   tháng 6 Wilson và tháng 7/8/9 đọc bảng lịch sử Elo như cũ.
5. Kỳ mới tiếp theo của nhóm Roy có ngày bắt đầu từ 10/10/2026 tự nhận luật mới.
   Nhóm khác giữ mặc định Elo. Các kỳ đã tạo trước migration giữ luật được gán,
   riêng Mùa 5 là kỳ được chuyển sang luật mới.

## Kiểm tra

`node --test backend/tests/pk-points.test.js backend/tests/pk-fixed-sql.test.js backend/tests/pk-history.test.js`

Test SQL chạy PostgreSQL cô lập và các hàm finalize/correct/void thật từ migration,
không ghi dữ liệu production. So sánh toàn bộ dòng Elo cũ trước/sau; kiểm tra
bảng lịch sử, +3/−2, hiệu số, đồng đội luân phiên, đối đầu/hòa, khóa luật, snapshot,
chốt lặp/dữ liệu thay đổi, rollback khi quỹ không cho đóng và quyền RPC.
