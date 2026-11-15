# Danh sách việc — Roy Badminton v2

Làm xong mục nào thì đổi `[ ]` thành `[x]`. Phạm vi và lý do: [OVERHAUL_PLAN.md](OVERHAUL_PLAN.md).
Cập nhật lần cuối: phiên 5.

## Làm tiếp ngay (theo thứ tự)

Trạng thái sau phiên 5: phần thành viên đã gần đủ: xem (trang chủ, Ví, Lịch, Đấu trường, Giải đấu, Thông báo) và thao tác (giữ chỗ, kèo, hồ sơ, ảnh đại diện, thông báo, khai lịch bận), cùng đăng ký, quên mật khẩu, vào nhóm bằng mã mời, đổi nhóm và PWA. Owner duyệt được yêu cầu vào nhóm ngay trên v2. Code nằm trên nhánh `claude/roy-bad-refactoring-4b915c` (đã đẩy lên GitHub, đã gộp toàn bộ nhánh `claude/project-analysis-83dc4c`), chưa vào `main`, chưa deploy.

Cách chạy: `cd v2 && npm install`, rồi `npm run dev:api` (cổng 5050) và `npm run dev:web` (cổng 5174). Kiểm tra: `npm run typecheck && npm test && npm run build`. 109 test API đang qua (gồm 3 bài chạy migration trên PostgreSQL nhúng và 1 bài so bảng xếp hạng với code bản cũ).

0. **Chủ CLB chạy ba migration** trong Supabase SQL Editor, mỗi file một lần:
   - `supabase/20261116_avatars_own_only.sql`: siết quyền ảnh đại diện. Chạy xong thì thử đổi ảnh của mình ở cả bản cũ và v2.
   - `supabase/20261116_v2_period_members.sql`: chỉ thêm hai hàm mới cho màn hình Kỳ quỹ của v2 (thêm người vào kỳ, đổi trạng thái và mức miễn cầu, kèm tạo hoặc hủy phí cố định trong một giao dịch). Không đổi bảng hay dữ liệu cũ.
   - `supabase/20261116_v2_guest_attendance.sql`: chỉ thêm hàm mới cho màn hình Lịch & điểm danh (ghi khách vãng lai kèm tạo, đổi, hủy phí khách trong một giao dịch; không bao giờ hủy phí đã trả).
1. **Chủ CLB thử tay trên dữ liệu thật** (danh sách ở khung bên dưới). Mọi thao tác ghi mới chỉ mới qua test tự động.
2. **Cấu hình Supabase cho v2** (chủ CLB làm trong Supabase Dashboard → Authentication → URL Configuration): thêm `http://localhost:5174/**` và địa chỉ v2 sau khi deploy vào Redirect URLs. Thiếu bước này thì email xác nhận, email đặt lại mật khẩu và đăng nhập Google sẽ quay về trang cũ.
3. **Deploy thử v2** lên hai project Vercel mới: `v2/apps/api` (đã có `vercel.json` chạy ở `sin1`) và `v2/apps/web` (đã có `vercel.json` cho đường dẫn SPA và cache service worker). Biến môi trường như `.env.example`; nhớ đặt `CORS_ORIGINS` của API bằng địa chỉ web. Rồi đo lại tốc độ thật.
4. **Kiểm tra quyền của vai trò `authenticated`** trên các bảng lõi: cần một phiên đăng nhập thật (khóa anon đã bị chặn hết, xem giai đoạn 0).
5. **Trả gộp bằng QR PayOS** — dùng lại RPC `create_pending_payment` và `attach_payos_link`; webhook `process_paid_payment` vẫn do backend cũ nhận cho tới khi chuyển đổi. Cần khóa PayOS trong `v2/apps/api/.env` và thử trên bản sao, không thử trên database thật.
6. **Giai đoạn 4 (quản trị)** còn lại: quản lý kèo PK (sửa, hủy kết quả) và giải đấu đôi (tạo giải, xếp đội, nhập tỷ số); rồi chạy thử trọn một kỳ, rồi xếp lịch từ lịch bận đã khai (bản cũ mới có xếp nháp, chưa có duyệt và công bố), rồi điểm danh.
7. **Lịch: lịch cố định của tôi** — chờ phần xếp lịch ở mục 6: ngay cả bản cũ cũng chưa lưu hay công bố lịch cố định, nên chưa có dữ liệu để hiện.

Chủ CLB đã quyết định (phiên 5):

- Lịch: thành viên **được xem tên** người đã giữ chỗ (khác bản cũ, nơi chỉ admin xem). v2 đã làm theo.
- Kèo: **giữ quy tắc như bản cũ**: thành viên tạo kèo được cho bất kỳ ai trong CLB, và ai trong trận cũng nhận, hủy, ghi tỷ số được. v2 đã làm theo.

- Ảnh đại diện: **mỗi người chỉ đổi ảnh của chính mình** (owner và admin vẫn đổi hộ được). Migration `supabase/20261116_avatars_own_only.sql` đã viết và chạy thử trên PostgreSQL nhúng (PGlite): người thường không thêm, ghi đè hay xóa được ảnh người khác, kể cả khi đặt tên file lách luật hoặc tự khai vai trò trong `user_metadata`; ai cũng vẫn xem được ảnh. **Chủ CLB cần chạy file này trong Supabase SQL Editor** thì mới có hiệu lực.

Quy ước khi làm tiếp:

- Tên bảng và cột lấy từ schema thật: gọi `$SUPABASE_URL/rest/v1/` bằng khóa service (đã có trong `v2/apps/api/.env`), không đoán.
- Truy vấn nằm trong `v2/apps/api/src/store*.ts`; logic nằm trong `routes/` và `domain/`, có test đi kèm.
- Mọi đường `/me/*` đi qua `resolveMember` để lấy đúng người và đúng nhóm đang chọn.
- Thao tác ghi về tiền và xếp hạng chỉ gọi RPC có sẵn của database, không viết lại bằng nhiều câu lệnh rời.

> **Đẩy code lên GitHub:** lệnh `git push` chỉ chạy được trong tab Terminal của app (nơi có đăng nhập GitHub của chủ CLB), không chạy được từ công cụ Bash của Claude.

> **Cần thử tay trước khi coi là xong** (mọi thao tác ghi mới chỉ qua test tự động): đánh dấu thông báo đã đọc; xóa một thông báo; giữ chỗ rồi hủy chỗ một buổi tự đăng ký; lưu hồ sơ; đổi ảnh đại diện (ảnh hiện cả ở bản cũ vì dùng chung tên file `<person_id>.<đuôi>`); khai lịch bận (Lịch → Lịch bận của tôi, bằng tài khoản thành viên cố định) rồi mở bản cũ xem cùng dữ liệu; tạo một kèo thử, nhận kèo bằng tài khoản thứ hai, ghi tỷ số, rồi nhờ admin hủy kết quả kèo thử; vào Nhân sự thêm một người thử, sửa, cho nghỉ rồi cho chơi lại; mở Công nợ & sổ quỹ và Báo cáo kỳ (Kỳ quỹ → Báo cáo) để **xem** số có khớp bản cũ; khi có người trả tiền thật thì bấm Thu tiền trên v2 thay vì bản cũ; mở Tiền cầu & chốt kỳ và **chỉ xem**: bảng chia tiền cầu phải ra cùng số với bản cũ; đừng ghi mua cầu, mượn cầu, chốt hay đóng kỳ thử, vì đó là tiền thật và chốt, đóng kỳ không hoàn tác được; khi tới cuối Mùa 6 thật thì làm các bước đó trên v2; vào Lịch & điểm danh mở một ngày rồi đóng lại, ghi một buổi thử, thêm một khách với **phí 0đ** (phí thật sẽ tự trừ vào số dư của người đó), rồi xóa khách và xóa buổi thử; vào Kỳ quỹ tạo một kỳ nháp thử với **phí cố định 0đ** (để không tạo nợ thật cho ai), thêm hai người, đổi cố định/vãng lai và mức miễn cầu; đừng mở kỳ thử. Kỳ nháp chưa xóa được trong app: dùng luôn nó làm kỳ thật tiếp theo (sửa tên, ngày, phí) hoặc nhờ em dọn. Phần tạo và hủy phí cố định đã được kiểm tra trên PostgreSQL nhúng; thử trên dữ liệu thật khi mở kỳ thật kế tiếp; tạo tài khoản mới bằng một email phụ, nhập mã mời, rồi duyệt yêu cầu đó trên v2 (Tôi → Duyệt thành viên, hoặc thẻ Chờ duyệt ở trang chủ của owner); quên mật khẩu với email phụ đó; cài app lên điện thoại từ bản đã deploy.

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
  - [x] Vai trò `anon` (phiên 5): cả 20 bảng lõi trả `permission denied` (42501), tức là khóa công khai không đọc được dữ liệu nào
  - [ ] Vai trò `authenticated`: cần thử bằng token của một phiên đăng nhập thật
- [ ] Tạo project Supabase thử nghiệm, nạp schema và dữ liệu giả — cần chủ CLB
- [ ] Chuyển quản lý migration sang Supabase CLI

## Giai đoạn 1 — Nền ứng dụng

- [x] Đăng nhập thật trên v2 và xem `/bootstrap` trả đúng hồ sơ, nhóm, kỳ (trang chủ tải đủ trong ~1 giây)
- [x] Đăng ký, quên mật khẩu, đặt lại mật khẩu (chưa gửi email thật; cần thêm địa chỉ v2 vào Redirect URLs của Supabase)
- [x] Màn hình cho tài khoản chưa có hồ sơ, đang chờ duyệt, đã nghỉ (nhập mã mời, tạo hồ sơ chờ duyệt)
- [x] Tách mã theo màn hình (màn hình đã tách; phần nặng còn lại là thư viện)
- [ ] Giảm dung lượng thư viện: dùng `@supabase/auth-js` thay cho `@supabase/supabase-js` ở web
- [x] Phân biệt lỗi xác thực: token sai trả 401, lỗi tải khóa công khai trả 503; web tự làm mới token và thử lại một lần khi gặp 401
- [x] Service worker: mở lại app khi mất mạng, nút cài app, icon PWA (chỉ bật ở bản build; trước đây icon PNG bị `.gitignore` chặn nên chưa từng lên Git)
- [ ] Deploy thử: project Vercel cho `v2/apps/api` (sin1) và `v2/apps/web`
- [x] CI: kiểm tra kiểu, test, build mỗi lần đẩy code (job `v2` trong `.github/workflows/quality.yml`, chạy cả trên nhánh `claude/**`)

## Giai đoạn 2 — Thành viên, chỉ xem

- [x] Trang chủ: khoản cần đóng, buổi mở sắp tới
- [x] Trang chủ: hạng và kèo đang chờ
- [x] Ví: công nợ, số dư, lịch sử giao dịch, tiền mượn cầu (một màn hình)
- [x] Lịch: buổi tự đăng ký sắp tới, buổi đã chơi trong kỳ
- [ ] Lịch: lịch cố định của tôi (chờ phần xếp và công bố lịch ở giai đoạn 4; bản cũ cũng chưa có)
- [x] Lịch: thành viên xem được tên người đã giữ chỗ (chủ CLB quyết định ở phiên 5)
- [x] Ví hai cột trên máy tính
- [x] Đấu trường: bảng xếp hạng đơn và đôi theo luật +3/−2, kèo của tôi (khớp cách tính bản cũ trên dữ liệu thật)
- [x] Đấu trường: bảng lịch sử các kỳ cũ, đọc nguyên từ bảng đã lưu (5 kỳ trên dữ liệu thật)
- [x] Đấu trường: xem kèo của người khác (thẻ Tất cả, 60 kèo gần nhất của kỳ)
- [x] Giải đấu: danh sách giải, vòng bảng có bảng xếp hạng, các vòng loại trực tiếp
- [x] Thông báo: chuông có số chưa đọc, danh sách thông báo
- [ ] Đối chiếu số liệu v2 với bản cũ trên cùng database

## Giai đoạn 3 — Thành viên, thao tác

- [ ] Trả gộp mọi khoản nợ bằng QR PayOS, màn hình kết quả thanh toán
- [x] Giữ chỗ và hủy chỗ buổi tự đăng ký (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [x] Khai lịch bận: thứ thường bận và ngoại lệ từng ngày, qua RPC `save_session_planning_preferences` (chưa thử lưu trên dữ liệu thật)
- [x] Tạo kèo, nhận kèo, hủy kèo, ghi tỷ số (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [ ] Ghép cặp ngẫu nhiên
- [x] Sửa hồ sơ: họ tên, biệt danh, số điện thoại, giới thiệu (đã viết và có test; chưa bấm lưu trên dữ liệu thật)
- [x] Đổi ảnh đại diện (cắt vuông 512 px WebP ở trình duyệt, API kiểm tra nội dung file; chưa thử trên dữ liệu thật)
- [x] Đánh dấu thông báo đã đọc (đã viết và có test; chưa bấm thử trên dữ liệu thật)
- [x] Xóa thông báo, từng cái hoặc tất cả (chưa thử trên dữ liệu thật)

## Giai đoạn 4 — Quản trị

- [x] Nhân sự: thêm, sửa, cho nghỉ, cho chơi lại (Tôi → Quản trị → Nhân sự; chỉ owner, theo nhóm đang xem; chưa thử ghi trên dữ liệu thật). Không có nút xóa: bản cũ cũng khuyên cho nghỉ thay vì xóa
- [x] Kỳ quỹ: tạo, mở, đóng; thành viên trong kỳ; mức miễn tiền cầu — đóng kỳ nằm ở màn hình Tiền cầu & chốt kỳ, lưu bảng xếp hạng đúng định dạng bản cũ (đã so trùng khớp với bảng đã lưu của kỳ đóng trước). Xong tạo bản nháp, sửa, mở kỳ, thêm người vào kỳ, đổi cố định/vãng lai/nghỉ và mức miễn cầu (Tôi → Quản trị → Kỳ quỹ; cần migration `20261116_v2_period_members.sql`). Còn **đóng kỳ**: làm sau phần chốt chia tiền cầu, vì đóng kỳ đòi đã chia cầu, trả hết tiền mượn cầu, quỹ về 0 và lưu bảng xếp hạng của kỳ
- [ ] Luồng lịch gộp: lên lịch → giữ chỗ → điểm danh → buổi đã chơi tự sinh; khách vãng lai — xong phần owner (Tôi → Quản trị → Lịch & điểm danh): mở, đóng, mở lại ngày tự đăng ký; ghi, sửa, xóa buổi đã chơi; ghi khách vãng lai với phí khách (người đã giữ chỗ ngày đó lên đầu danh sách). Cần migration `20261116_v2_guest_attendance.sql`. Còn: tự sinh buổi từ ngày tự đăng ký và xếp lịch cố định từ lịch bận
- [x] Chi cầu: mua cầu, chia nguồn quỹ và cá nhân, dùng quỹ dư bù (Tôi → Quản trị → Tiền cầu & chốt kỳ; gọi các hàm database có sẵn của bản cũ)
- [x] Chốt chia tiền cầu cuối kỳ (hàm `settle_shuttle_period` có sẵn, gửi thông báo cho từng người như bản cũ)
- [x] Mượn cầu đánh sân ngoài: ghi, đánh dấu đã trả vào quỹ, hủy
- [x] Công nợ: khoản thu tay, nhắc nợ, thu tiền (đánh dấu đã trả và ghi quỹ cùng lúc qua `deposit_fund_atomic`), hủy nợ; bù trừ số dư vẫn chỉ chạy tự động bằng trigger (Tôi → Quản trị → Công nợ & sổ quỹ)
- [x] Sổ quỹ: thu (nộp quỹ), chi, hoàn số dư qua `refund_person_balance`; không có kết chuyển. Số dư quỹ đã đối chiếu khớp với hàm `shuttle_fund_balance` trên 3 kỳ thật
- [x] Quản lý kèo PK: ghi kết quả hộ, hủy kèo, sửa tỷ số (`correct_pk_match_result`), hủy kết quả có lý do (`void_pk_match`); chỉ kỳ đang mở (Tôi → Quản trị → Quản lý kèo)
- [ ] Giải đấu đôi: tạo giải, xếp đội, nhập tỷ số
- [x] Một trang báo cáo kỳ, có in (Kỳ quỹ → Báo cáo): phải thu, đã thu, còn nợ theo loại, quỹ, tiền cầu, kết quả chốt, người còn nợ
- [ ] Chạy thử trọn một kỳ trên bản sao

## Giai đoạn 5 — Nhiều nhóm

- [ ] Quyền theo từng nhóm; quản trị cũng là người chơi
- [ ] Xin tạo nhóm, owner duyệt và cấp
- [ ] Mã mời, duyệt thành viên, chuyển nhóm — xong nhập mã, xin vào, đổi nhóm đang xem, owner duyệt và từ chối (giống bản cũ: chỉ owner, theo nhóm đang xem); còn đổi mã mời và quyền duyệt theo từng nhóm
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

- [x] Nén `logo.png` (1,5 MB → 22 KB) và `cat-loading.png` (1 MB → 25 KB) của bản cũ; cùng tên file nên không phải sửa code
- [ ] Sửa 4 file test lỗi khi thiếu biến môi trường
- [ ] Ghim phiên bản thư viện đang để `latest` trong `backend/package.json`
- [x] Cập nhật `CLAUDE.md`: thêm phần v2
