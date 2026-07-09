-- ============================================================
-- 20260709_pk_matches_period.sql
-- Gắn kèo PK vào từng KỲ (period) → qua kỳ mới, Đấu trường bắt đầu lại;
-- kỳ cũ vẫn giữ nguyên dữ liệu kèo + bảng xếp hạng của kỳ đó.
-- ============================================================

alter table public.pk_matches
  add column if not exists period_id uuid references public.periods(id) on delete cascade;

create index if not exists idx_pk_period on public.pk_matches(period_id);

-- Backfill: các kèo cũ chưa có kỳ -> gán vào kỳ hiện tại "Tháng 6 đổ máu".
-- (Sau này mọi kèo mới đều được backend gán period_id tự động.)
update public.pk_matches
set period_id = (select id from public.periods where name = 'Tháng 6 đổ máu' limit 1)
where period_id is null;
