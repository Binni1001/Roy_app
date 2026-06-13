# Giao diện Roy Badminton

Ứng dụng dùng React và Vite để kết nối với máy chủ Roy Badminton.

## Chạy tại máy

```bash
npm install
npm run dev
```

Mặc định giao diện gọi máy chủ tại `http://localhost:5000`.
Khi máy chủ triển khai ở địa chỉ khác, tạo tập tin `.env`:

```env
VITE_API_BASE_URL=https://dia-chi-may-chu-cua-ban
```

## Đường dẫn

- `/admin`: khu quản trị kỳ quỹ, nhân sự, buổi cầu, khách, chi phí cầu, công nợ, thanh toán PayOS, sổ quỹ và số dư từng người.
- `/user`: khu người dùng để xem hồ sơ, công nợ, số dư, lịch sử, buổi cầu và tạo thanh toán PayOS.
- `/`: màn hình chọn khu vực sử dụng.
