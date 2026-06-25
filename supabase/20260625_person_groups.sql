-- ============================================================
-- MIGRATION: 20260625_person_groups.sql
-- Many-to-many group membership + active_group_id switcher
-- ============================================================

-- ============================================================
-- BƯỚC 1: Tạo bảng person_groups (junction table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.person_groups (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id    uuid        NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  group_id     uuid        NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  status       public.person_status NOT NULL DEFAULT 'pending',
  member_role  text        NOT NULL DEFAULT 'member'
                           CHECK (member_role IN ('owner', 'admin', 'member')),
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(person_id, group_id)
);

CREATE INDEX IF NOT EXISTS person_groups_person_id_idx ON public.person_groups (person_id);
CREATE INDEX IF NOT EXISTS person_groups_group_id_idx  ON public.person_groups (group_id);
CREATE INDEX IF NOT EXISTS person_groups_status_idx    ON public.person_groups (status);

-- ============================================================
-- BƯỚC 2: Thêm active_group_id vào people
-- ============================================================
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS active_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- ============================================================
-- BƯỚC 3: Migrate data cũ từ people.group_id → person_groups
-- Toàn bộ người có group_id hiện tại → thêm vào person_groups
-- ============================================================
INSERT INTO public.person_groups (person_id, group_id, status, member_role)
SELECT
  id,
  group_id,
  CASE WHEN status = 'active' THEN 'active'::public.person_status
       WHEN status = 'inactive' THEN 'inactive'::public.person_status
       ELSE 'pending'::public.person_status
  END,
  'member'
FROM public.people
WHERE group_id IS NOT NULL
ON CONFLICT (person_id, group_id) DO NOTHING;

-- Set active_group_id = group_id hiện tại cho toàn bộ member active
UPDATE public.people
SET active_group_id = group_id
WHERE group_id IS NOT NULL
  AND status = 'active';

-- ============================================================
-- BƯỚC 4: RLS
-- ============================================================
ALTER TABLE public.person_groups ENABLE ROW LEVEL SECURITY;
-- Backend dùng service_role → bypass RLS, không cần policy

-- ============================================================
-- NOTE: people.group_id và people.status vẫn được giữ lại
-- để backward compat với code cũ. Sẽ deprecate sau.
-- active_group_id = nhóm đang được chọn xem
-- person_groups = danh sách tất cả nhóm của người đó
-- ============================================================
