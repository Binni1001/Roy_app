# Kế hoạch đại tu Roy Badminton (v2)

Cập nhật: 15/11/2026. Tài liệu này là điểm bắt đầu cho mọi phiên làm việc tiếp theo.

## 1. Đã chốt với chủ CLB

- **Hình thức:** PWA cài được. Hai giao diện riêng: app (điện thoại) và web (máy tính).
- **Cách chuyển:** dựng bản mới song song, dùng chung database Supabase hiện tại. Bản cũ chạy đến khi bản mới đủ tính năng rồi đổi tên miền. Không tạo database mới, mọi thay đổi schema là thêm vào, không phá dữ liệu.
- **Nhiều nhóm:** làm đầy đủ. Tạo nhóm cần owner duyệt rồi cấp cho người đó.
- **PayOS:** về sau mỗi CLB một tài khoản riêng; trước mắt chỉ làm cho CLB Roy.
- **Giao diện:** tông tối-vàng (`#10141b`, `#efe7d2`, `#d8ae52`), giữ logo hiện tại, chữ Be Vietnam Pro, nhiều chuyển động nhưng nhẹ. Tham chiếu componentry.dev. Bản mẫu: https://claude.ai/artifact/PNfY8yorY5X44MqkWoRDVb
- **Quy mô:** khoảng 22 người dùng, không có thời hạn.

## 2. Nghiệp vụ sau khi gộp (đã duyệt)

| Cụm | Giữ nguyên | Gộp lại |
|---|---|---|
| Người và nhóm | Hồ sơ, nhóm (mã mời, duyệt, chuyển nhóm) | Quản trị cũng là người chơi, quyền theo từng nhóm. Trạng thái còn hai lớp: trong nhóm và trong kỳ |
| Kỳ và phí | Kỳ quỹ, thành viên trong kỳ, phí cố định | Mức miễn tiền cầu còn một cột (bỏ `exempt_shuttle`) |
| Lịch | Buổi đã chơi, khách vãng lai | Một luồng: lên lịch → giữ chỗ → điểm danh → buổi đã chơi tự sinh |
| Tiền | Công nợ, chi cầu, chốt chia tiền cầu, mượn cầu, nhắc nợ | Chỉ còn QR trả gộp. Bù trừ số dư chỉ chạy tự động. Bỏ kết chuyển quỹ |
| Thi đấu | Kèo PK, hạng mùa, ghép cặp, giải đôi | Chỉ tính luật +3/−2; kỳ cũ đọc `pk_leaderboard_snapshots` |
| Màn hình | | Một trang báo cáo cho admin. Một màn hình ví cho thành viên |

## 3. Vì sao bản cũ chậm (đã đo 15/11/2026)

- Backend chạy ở Mỹ (`iad1`), Supabase ở Singapore. Mỗi yêu cầu API mất 2,5–6 giây. Đã sửa bằng `"regions": ["sin1"]` trong `backend/vercel.json` (PR #1).
- Mỗi yêu cầu gọi Supabase nhiều lần liên tiếp: `auth.getUser`, tra trạng thái tài khoản, tra nhóm, rồi mới truy vấn chính.
- Frontend tải nối đuôi ba đợt, gọi trùng (`/people/me` bốn lần), không có bộ nhớ đệm.
- Trang đầu tải logo 1,5 MB và ảnh loading 1 MB.

## 4. Cấu trúc bản mới

```
v2/
  apps/web/        React 19 + Vite + TypeScript, PWA
  apps/api/        Hono + TypeScript trên Vercel (sin1)
  packages/shared/ Kiểu dữ liệu và schema zod dùng chung
supabase/migrations/  Quản lý bằng Supabase CLI, có bản schema gốc
```

Nguyên tắc để không chậm lại:

1. **Xác thực không tốn lượt gọi mạng:** kiểm tra JWT của Supabase tại chỗ bằng khóa công khai (JWKS).
2. **Một lượt tra quyền cho mỗi yêu cầu:** người, vai trò theo nhóm và trạng thái lấy trong một truy vấn.
3. **Một lần gọi khi mở app:** `GET /bootstrap` trả hồ sơ, nhóm, kỳ đang mở, số dư, thông báo.
4. **Bộ nhớ đệm phía trình duyệt:** TanStack Query. Đổi tab không tải lại, dữ liệu cũ hiện ngay rồi làm mới ngầm.
5. **Địa chỉ theo URL:** TanStack Router, tách mã theo từng màn hình.
6. **Tiền và xếp hạng vẫn nằm trong RPC của database** để giữ tính nguyên tử. API chỉ kiểm quyền rồi gọi RPC.
7. **Ảnh:** WebP/AVIF, dưới 150 KB mỗi ảnh; ảnh có giấy phép dùng tự do hoặc ảnh thật của CLB.

Giao diện: `layouts/app` (thanh điều hướng đáy, thẻ lớn, thao tác một tay) và `layouts/web` (thanh trên, lưới nhiều cột). Hai bố cục dùng chung hook dữ liệu và thành phần cơ bản.

## 5. Các giai đoạn

| # | Việc | Xong khi |
|---|---|---|
| 0 | Xuất schema thật vào repo, kiểm tra RLS các bảng lõi, tạo project Supabase thử nghiệm | Có `supabase/migrations/0000_baseline.sql` và bản sao chạy được |
| 1 | Nền: khung `v2/`, đăng nhập, `/bootstrap`, vỏ app và web, PWA | Đăng nhập được, mở app dưới 1 giây khi đã có cache |
| 2 | Thành viên, chỉ xem: trang chủ, ví, lịch, đấu trường, giải đấu | Số liệu khớp bản cũ trên cùng database |
| 3 | Thành viên, thao tác: trả nợ QR, giữ chỗ, tạo và ghi kèo, sửa hồ sơ | Mọi thao tác của thành viên làm được trên bản mới |
| 4 | Quản trị: kỳ, thành viên, buổi, chi cầu, chốt kỳ, sổ quỹ, báo cáo | Chạy thử trọn một kỳ trên bản sao |
| 5 | Nhiều nhóm: xin tạo nhóm, owner duyệt, mời, chuyển nhóm, quyền theo nhóm | Hai nhóm thử nghiệm không thấy dữ liệu của nhau |
| 6 | Chuyển đổi: chạy song song một kỳ, đổi tên miền, tắt bản cũ | Bản cũ ngừng nhận truy cập |

## 6. Cần chủ CLB cung cấp

- Bản xuất schema (không kèm dữ liệu) từ Supabase, lưu vào `supabase/`.
- Một project Supabase thử nghiệm (gói miễn phí).
- Khóa bí mật chỉ điền vào `.env` trên máy, không gửi qua chat.

## 7. Việc tồn từ bản cũ, nên làm sớm

- Kiểm tra RLS của `people`, `debts`, `payments`, `periods`, `period_members`, `club_fund_transactions`, `badminton_sessions`: repo không có lệnh bật RLS cho các bảng này.
- Nén `logo.png` và `cat-loading.png`.
- Thay các ảnh vận động viên chuyên nghiệp bằng ảnh có giấy phép.
