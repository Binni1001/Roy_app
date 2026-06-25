-- ============================================================
-- MIGRATION: 20260625_groups_invite.sql
-- Multi-group support + invite code + member approval flow
-- ============================================================

-- ============================================================
-- BƯỚC 1: Thêm 'pending' vào enum person_status
-- Hiện tại chỉ có: active, inactive
-- ============================================================
ALTER TYPE public.person_status ADD VALUE IF NOT EXISTS 'pending';

-- ============================================================
-- BƯỚC 2: Tạo bảng groups
-- ============================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text        NOT NULL,
  invite_code  text        NOT NULL UNIQUE,
  created_by   uuid        REFERENCES public.people(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS groups_invite_code_idx ON public.groups (lower(invite_code));

-- ============================================================
-- BƯỚC 3: Thêm group_id vào people
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS people_group_id_idx ON public.people (group_id);

-- ============================================================
-- BƯỚC 4: Thêm group_id vào periods
-- ============================================================
ALTER TABLE public.periods
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS periods_group_id_idx ON public.periods (group_id);

-- ============================================================
-- BƯỚC 5: Tạo group mặc định "Roy Badminton"
-- Gán toàn bộ people + periods hiện tại vào group này
-- Dùng DO block để capture id và update ngay trong 1 transaction
-- ============================================================
DO $$
DECLARE
  v_group_id uuid;
BEGIN
  -- Tạo group mặc định
  INSERT INTO public.groups (name, invite_code)
  VALUES ('Roy Badminton', 'DEMO-CLUB')
  ON CONFLICT (invite_code) DO NOTHING
  RETURNING id INTO v_group_id;

  -- Nếu đã tồn tại (conflict), lấy id hiện có
  IF v_group_id IS NULL THEN
    SELECT id INTO v_group_id
    FROM public.groups
    WHERE lower(invite_code) = 'demo-club'
    LIMIT 1;
  END IF;

  -- Gán toàn bộ thành viên hiện tại vào group
  UPDATE public.people
  SET group_id = v_group_id
  WHERE group_id IS NULL;

  -- Gán toàn bộ periods hiện tại vào group
  UPDATE public.periods
  SET group_id = v_group_id
  WHERE group_id IS NULL;

  RAISE NOTICE 'Default group id: %', v_group_id;
END;
$$;

-- ============================================================
-- BƯỚC 6: RLS cho bảng groups
-- Service role (backend) bypass RLS → chỉ cần policy cho anon/authenticated nếu cần
-- ============================================================
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Backend dùng service_role nên không bị block
-- Không cần policy cho authenticated vì frontend không query groups trực tiếp
