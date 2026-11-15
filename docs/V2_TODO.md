# Danh sách việc — Roy Badminton v2

Làm xong mục nào thì đổi `[ ]` thành `[x]`. Phạm vi và lý do: [OVERHAUL_PLAN.md](OVERHAUL_PLAN.md).
Cập nhật lần cuối: 16/11/2026.

## Làm tiếp ngay (theo thứ tự)

Trạng thái ngày 16/11/2026: phần thành viên chỉ xem đã chạy với dữ liệu thật (trang chủ, Ví, Lịch, Đấu trường, Giải đấu, Thông báo). Mọi thứ nằm trên nhánh `claude/project-analysis-83dc4c`, chưa vào `main`, chưa deploy.

Cách chạy: `cd v2 && npm install`, rồi `npm run dev:api` (cổng 5050) và `npm run dev:web` (cổng 5174). Kiểm tra: `npm run typecheck && npm test && npm run build`.

1. ~~Đánh dấu thông báo đã đọc~~ — đã viết (`POST /me/notifications/read`), **chưa bấm thử trên dữ liệu thật**.
   Bản gốc: Thêm `POST /me/notifications/read` (cập nhật `notifications.read = true` theo `person_id`), gọi khi mở màn hình Thông báo, làm mới cache `["me","notifications"]`.
2. ~~Giữ chỗ và hủy chỗ buổi tự đăng ký~~ — đã viết (`POST /me/open-days/:id/join|leave`), **chưa bấm thử trên dữ liệu thật** vì kỳ đang mở không có buổi sắp tới. Cần admin mở một ngày tự đăng ký rồi thử giữ chỗ và hủy chỗ.
   Bản gốc: gọi RPC có sẵn `mutate_open_play_day` (xem cách bản cũ gọi trong `backend/src/modules/session-planning/`). RPC đã tự kiểm tra sức chứa 8 chỗ, hạn 17:30 và quyền nhóm.
3. **Lịch: xem ai đã giữ chỗ** — CẦN HỎI CHỦ CLB TRƯỚC. Quy tắc bản cũ (docs/open-play-days.md): thành viên chỉ thấy số người, chỉ admin thấy tên. Không tự đổi quy tắc này.
4. **Trả gộp bằng QR PayOS** — dùng lại RPC `create_pending_payment` và `attach_payos_link`; webhook `process_paid_payment` vẫn do backend cũ nhận cho tới khi chuyển đổi. Cần thêm khóa PayOS vào `v2/apps/api/.env`. Phải thử trên bản sao trước, không thử trên database thật.
5. ~~Tạo kèo, nhận kèo, hủy kèo, ghi tỷ số~~ — đã viết (`POST /me/matches`, `POST /me/matches/:id/accept|cancel|result`, form trong màn hình Đấu trường), **chưa bấm thử trên dữ liệu thật**. Khác bản cũ, cần chủ CLB xác nhận: người tạo kèo bắt buộc là bên thách đấu (bản cũ cho thành viên tạo kèo cho người khác), và chỉ bên được thách đấu mới nhận kèo.
6. ~~Bảng lịch sử Đấu trường các kỳ cũ~~ — xong (`GET /me/arena/history`, thẻ Các kỳ trước trong màn hình Đấu trường).
7. ~~Sửa hồ sơ~~ — xong phần họ tên, biệt danh, số điện thoại, giới thiệu (`GET/PUT /me/profile`), **chưa bấm lưu trên dữ liệu thật**. Còn lại: đổi ảnh đại diện (tải lên bucket `avatars` của Supabase Storage).
8. ~~Tách mã theo màn hình~~ — đã tách, nhưng gần như không giảm dung lượng: mỗi màn hình chỉ 1–2 KB nén, còn ~169 KB nén là thư viện (supabase-js, react-dom, TanStack). Muốn nhẹ hơn thật thì thay `@supabase/supabase-js` ở web bằng `@supabase/auth-js` (chỉ cần đăng nhập); việc này đụng luồng đăng nhập nên phải thử lại đăng nhập, Google và làm mới token.
9. **Deploy thử v2** lên hai project Vercel mới (API ở `sin1`), rồi đo lại tốc độ thật.

Quy ước khi làm tiếp:

- Tên bảng và cột lấy từ schema thật: gọi `$SUPABASE_URL/rest/v1/` bằng khóa service (đã có trong `v2/apps/api/.env`), không đoán.
- Truy vấn nằm trong `v2/apps/api/src/store*.ts`; logic nằm trong `routes/` và `domain/`, có test đi kèm.
- Mọi đường `/me/*` đi qua `resolveMember` để lấy đúng người và đúng nhóm đang chọn.
- Thao tác ghi về tiền và xếp hạng chỉ gọi RPC có sẵn của database, không viết lại bằng nhiều câu lệnh rời.

> **Đẩy code lên GitHub:** lệnh `git push` chỉ chạy được trong tab Terminal của app (nơi có đăng nhập GitHub của chủ CLB), không chạy được từ công cụ Bash của Claude.

> **Cần thử tay trước khi coi là xong** (mọi thao tác ghi mới chỉ qua test tự động): đánh dấu thông báo đã đọc; giữ chỗ rồi hủy chỗ một buổi tự đăng ký; lưu hồ sơ; tạo một kèo thử, nhận kèo bằng tài khoản thứ hai, ghi tỷ số, rồi nhờ admin hủy kết quả kèo thử.

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

- [x] Đăng nhập thật trên v2 và xem `/bootstrap` trả đúng hồ sơ, nhóm, kỳ (trang chủ tải đủ trong ~1 giây)
- [ ] Đăng ký, quên mật khẩu, đặt lại mật khẩu
- [ ] Màn hình cho tài khoản chưa có hồ sơ, đang chờ duyệt, đã nghỉ
- [x] Tách mã theo màn hình (màn hình đã tách; phần nặng còn lại là thư viện)
- [ ] Giảm dung lượng thư viện: dùng `@supabase/auth-js` thay cho `@supabase/supabase-js` ở web
- [x] Phân biệt lỗi xác thực: token sai trả 401, lỗi tải khóa công khai trả 503; web tự làm mới token và thử lại một lần khi gặp 401
- [ ] Service worker: mở lại app khi mất mạng, nút cài app
- [ ] Deploy thử: project Vercel cho `v2/apps/api` (sin1) và `v2/apps/web`
- [ ] CI: kiểm tra kiểu, test, build mỗi lần đẩy code

## Giai đoạn 2 — Thành viên, chỉ xem

- [x] Trang chủ: khoản cần đóng, buổi mở sắp tới
- [x] Trang chủ: hạng và kèo đang chờ
- [x] Ví: công nợ, số dư, lịch sử giao dịch, tiền mượn cầu (một màn hình)
- [x] Lịch: buổi tự đăng ký sắp tới, buổi đã chơi trong kỳ
- [ ] Lịch: lịch cố định của tôi
- [ ] Lịch: thành viên có được xem tên người đã giữ chỗ không? (hỏi chủ CLB; bản cũ chỉ cho admin xem)
- [x] Ví hai cột trên máy tính
- [x] Đấu trường: bảng xếp hạng đơn và đôi theo luật +3/−2, kèo của tôi (khớp cách tính bản cũ trên dữ liệu thật)
- [x] Đấu trường: bảng lịch sử các kỳ cũ, đọc nguyên từ bảng đã lưu (5 kỳ trên dữ liệu thật)
- [ ] Đấu trường: xem kèo của người khác
- [x] Giải đấu: danh sách giải, vòng bảng có bảng xếp hạng, các vòng loại trực tiếp
- [x] Thông báo: chuông có số chưa đọc, danh sách thông báo
- [ ] Đối chiếu số liệu v2 với bản cũ trên cùng database

## Giai đoạn 3 — Thành viên, thao tác

- [ ] Trả gộp mọi khoản nợ bằng QR PayOS, màn hình kết quả thanh toán
- [x] Giữ chỗ và hủy chỗ buổi tự đăng ký (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [ ] Khai lịch bận
- [x] Tạo kèo, nhận kèo, hủy kèo, ghi tỷ số (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [ ] Ghép cặp ngẫu nhiên
- [x] Sửa hồ sơ: họ tên, biệt danh, số điện thoại, giới thiệu (đã viết và có test; chưa bấm lưu trên dữ liệu thật)
- [ ] Đổi ảnh đại diện
- [x] Đánh dấu thông báo đã đọc (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [ ] Xóa thông báo

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
