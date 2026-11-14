# Danh sách việc — Roy Badminton v2

Làm xong mục nào thì đổi `[ ]` thành `[x]`. Phạm vi và lý do: [OVERHAUL_PLAN.md](OVERHAUL_PLAN.md).
Cập nhật lần cuối: 15/11/2026.

## Đã xong

- [x] Phân tích bản cũ, đo tốc độ, tìm nguyên nhân chậm
- [x] Chuyển backend cũ về Singapore (PR #1, đã merge): trang chủ từ ~11 giây còn ~3,8 giây
- [x] Chốt nghiệp vụ sau khi gộp (25 mục) và các quyết định nền
- [x] Bản mẫu giao diện: web trang chủ, app trang chủ, app đấu trường
- [x] Khung `v2/`: API (xác thực tại chỗ, `/bootstrap`), web (đăng nhập, hai bố cục), kiểu dùng chung
- [x] File `.env` cho `v2/apps/api` và `v2/apps/web` (chỉ có trên máy, không lên Git)
- [x] Xác nhận Supabase ký token bằng khóa công khai (JWKS) và truy vấn `/bootstrap` chạy được với database thật

## Giai đoạn 0 — Nền dữ liệu

- [ ] Xuất schema thật (không kèm dữ liệu) vào `supabase/migrations/0000_baseline.sql` — cần chủ CLB
- [ ] Kiểm tra RLS của `people`, `debts`, `payments`, `periods`, `period_members`, `club_fund_transactions`, `badminton_sessions`; viết migration bật RLS nếu thiếu
- [ ] Tạo project Supabase thử nghiệm, nạp schema và dữ liệu giả — cần chủ CLB
- [ ] Chuyển quản lý migration sang Supabase CLI

## Giai đoạn 1 — Nền ứng dụng

- [ ] Đăng nhập thật trên v2 và xem `/bootstrap` trả đúng hồ sơ, nhóm, kỳ
- [ ] Đăng ký, quên mật khẩu, đặt lại mật khẩu
- [ ] Màn hình cho tài khoản chưa có hồ sơ, đang chờ duyệt, đã nghỉ
- [ ] Tách mã theo màn hình (gói web hiện 164 KB nén)
- [ ] Service worker: mở lại app khi mất mạng, nút cài app
- [ ] Deploy thử: project Vercel cho `v2/apps/api` (sin1) và `v2/apps/web`
- [ ] CI: kiểm tra kiểu, test, build mỗi lần đẩy code

## Giai đoạn 2 — Thành viên, chỉ xem

- [ ] Trang chủ: buổi tối nay, khoản cần đóng, hạng, kèo đang chờ
- [ ] Ví: công nợ, số dư, lịch sử giao dịch, tiền mượn cầu (một màn hình)
- [ ] Lịch: tuần này, cả kỳ, ai đã giữ chỗ
- [ ] Đấu trường: bảng xếp hạng đơn và đôi, kèo của tôi, lịch sử kỳ cũ
- [ ] Giải đấu: vòng bảng, nhánh loại trực tiếp
- [ ] Thông báo
- [ ] Đối chiếu số liệu v2 với bản cũ trên cùng database

## Giai đoạn 3 — Thành viên, thao tác

- [ ] Trả gộp mọi khoản nợ bằng QR PayOS, màn hình kết quả thanh toán
- [ ] Giữ chỗ và hủy chỗ buổi đánh
- [ ] Khai lịch bận
- [ ] Tạo kèo, nhận kèo, ghi tỷ số
- [ ] Ghép cặp ngẫu nhiên
- [ ] Sửa hồ sơ và ảnh đại diện

## Giai đoạn 4 — Quản trị

- [ ] Nhân sự: thêm, sửa, cho nghỉ
- [ ] Kỳ quỹ: tạo, mở, đóng; thành viên trong kỳ; mức miễn tiền cầu
- [ ] Luồng lịch gộp: lên lịch → giữ chỗ → điểm danh → buổi đã chơi tự sinh; khách vãng lai
- [ ] Chi cầu: mua cầu, chia nguồn quỹ và cá nhân, dùng quỹ dư bù
- [ ] Chốt chia tiền cầu cuối kỳ
- [ ] Mượn cầu đánh sân ngoài
- [ ] Công nợ: khoản thu tay, nhắc nợ; bù trừ số dư chỉ chạy tự động
- [ ] Sổ quỹ: thu, chi, nộp quỹ, hoàn tiền (bỏ kết chuyển)
- [ ] Quản lý kèo PK: sửa và hủy kết quả; chỉ tính luật +3/−2
- [ ] Giải đấu đôi: tạo giải, xếp đội, nhập tỷ số
- [ ] Một trang báo cáo kỳ, có in
- [ ] Chạy thử trọn một kỳ trên bản sao

## Giai đoạn 5 — Nhiều nhóm

- [ ] Quyền theo từng nhóm; quản trị cũng là người chơi
- [ ] Xin tạo nhóm, owner duyệt và cấp
- [ ] Mã mời, duyệt thành viên, chuyển nhóm
- [ ] Phạm vi nhóm cho thanh toán và mọi thao tác tiền
- [ ] Thử hai nhóm: không thấy dữ liệu của nhau
- [ ] Mỗi CLB một tài khoản PayOS (làm sau cùng)

## Giai đoạn 6 — Chuyển đổi

- [ ] Chạy song song bản cũ và v2 trọn một kỳ
- [ ] Đổi tên miền sang v2
- [ ] Tắt bản cũ, dọn `backend/` và `frontend/`

## Giao diện (làm xuyên suốt)

- [ ] Chốt bản mẫu với chủ CLB; nhận thêm yêu cầu giao diện
- [ ] Bộ ảnh cầu lông có giấy phép dùng tự do hoặc ảnh thật của CLB, nén WebP
- [ ] Chuyển động điểm nhấn: màn hình chào, công bố vô địch mùa, ô tỷ số lật
- [ ] Thay ảnh vận động viên chuyên nghiệp trong bản cũ

## Việc tồn của bản cũ

- [ ] Nén `logo.png` (1,5 MB) và `cat-loading.png` (1 MB)
- [ ] Sửa 4 file test lỗi khi thiếu biến môi trường
- [ ] Ghim phiên bản thư viện đang để `latest` trong `backend/package.json`
- [ ] Cập nhật `CLAUDE.md` cho khớp cấu trúc thật
