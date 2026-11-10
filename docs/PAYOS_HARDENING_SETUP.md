# PayOS hardening — thứ tự triển khai

Migration: `supabase/20261110_payos_payment_hardening.sql` (chạy lại nhiều lần được).

## Thứ tự bắt buộc

1. **Chạy migration trên Supabase SQL Editor trước**, rồi mới deploy backend. Backend mới gọi `create_pending_payment` và `attach_payos_link`; thiếu chúng, tạo thanh toán báo lỗi rõ ràng (không còn nhánh ghi dở).
2. Deploy backend, sau đó frontend (trang `/payments/return` và `/payments/cancel`).
3. Kiểm tra `PAYOS_RETURN_URL` / `PAYOS_CANCEL_URL` trỏ đúng `https://<frontend>/payments/return` và `/payments/cancel`.

## Kiểm tra sau khi chạy migration

```sql
-- Chỉ service_role được chạy; anon/authenticated phải là false
select proname,
       has_function_privilege('anon', oid, 'execute') as anon,
       has_function_privilege('authenticated', oid, 'execute') as authenticated,
       has_function_privilege('service_role', oid, 'execute') as service_role
from pg_proc
where proname in ('create_pending_payment','attach_payos_link','process_paid_payment','mark_payment_failed');

-- Phải có index unique (nếu không, migration đã báo NOTICE vì có mã trùng cần xử lý)
select indexname from pg_indexes where indexname = 'payments_payos_order_code_key';
```

## Đối soát thủ công

Webhook trả `processed: false` và ghi log `[payos] ...` trong hai trường hợp, khi đó tiền đã về nhưng hệ thống không tự ghi nợ:

- `AMOUNT_MISMATCH`: số tiền PayOS báo khác `payments.amount`.
- `REQUIRES_RECONCILIATION`: công nợ liên quan đã được thanh toán bằng đường khác (ví dụ link cũ và link mới cùng được trả).

Payload nằm ở `payments.raw_payload`. Cần xử lý hoàn tiền hoặc ghi nhận thủ công. Chưa có bảng/trạng thái đối soát riêng.
