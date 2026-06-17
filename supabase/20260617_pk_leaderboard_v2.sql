-- ============================================================
-- MIGRATION: 20260617_pk_leaderboard_v2.sql
-- Cải thiện xếp hạng PK:
--   1. Thêm wilson_score: lower bound 95% confidence interval
--      → người ít trận bị kéo về trung bình, tránh 100% từ 1 trận
--   2. Thêm points: wins*3 - losses*1 (tối thiểu 0) để hiển thị
--   3. Sort theo wilson_score DESC thay vì wins DESC
-- ============================================================

CREATE OR REPLACE VIEW pk_leaderboard AS
WITH all_results AS (
  -- Challenger side
  SELECT
    challenger_id AS person_id,
    CASE WHEN winner_side = 'challenger' THEN 1 ELSE 0 END AS is_win
  FROM pk_matches
  WHERE status = 'completed'

  UNION ALL

  -- Challenger partner (doubles)
  SELECT
    challenger_partner_id AS person_id,
    CASE WHEN winner_side = 'challenger' THEN 1 ELSE 0 END AS is_win
  FROM pk_matches
  WHERE status = 'completed' AND challenger_partner_id IS NOT NULL

  UNION ALL

  -- Opponent side
  SELECT
    opponent_id AS person_id,
    CASE WHEN winner_side = 'opponent' THEN 1 ELSE 0 END AS is_win
  FROM pk_matches
  WHERE status = 'completed'

  UNION ALL

  -- Opponent partner (doubles)
  SELECT
    opponent_partner_id AS person_id,
    CASE WHEN winner_side = 'opponent' THEN 1 ELSE 0 END AS is_win
  FROM pk_matches
  WHERE status = 'completed' AND opponent_partner_id IS NOT NULL
),
stats AS (
  SELECT
    person_id,
    COUNT(*)::int              AS total_matches,
    SUM(is_win)::int           AS wins,
    (COUNT(*) - SUM(is_win))::int AS losses,
    ROUND(SUM(is_win)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate,

    -- Wilson Score (z = 1.96 cho 95% confidence)
    -- Công thức: lower bound của khoảng tin cậy Wilson
    -- Người ít trận → score kéo về ~0.5, người nhiều trận → gần win_rate thực
    ROUND(
      (
        (SUM(is_win)::NUMERIC / NULLIF(COUNT(*), 0))
        + (1.96 * 1.96) / (2.0 * COUNT(*))
        - 1.96 * SQRT(
            (SUM(is_win)::NUMERIC / NULLIF(COUNT(*), 0))
            * (1.0 - SUM(is_win)::NUMERIC / NULLIF(COUNT(*), 0))
            / COUNT(*)
            + (1.96 * 1.96) / (4.0 * COUNT(*) * COUNT(*))
          )
      ) / (1.0 + (1.96 * 1.96) / COUNT(*)) * 100,
    1) AS wilson_score,

    -- Điểm tích lũy: thắng +3, thua -1 (không âm)
    GREATEST(0, SUM(is_win) * 3 - (COUNT(*) - SUM(is_win)) * 1)::int AS points

  FROM all_results
  GROUP BY person_id
)
SELECT
  p.id,
  p.full_name,
  p.nickname,
  p.avatar_url,
  s.total_matches,
  s.wins,
  s.losses,
  s.win_rate,
  s.wilson_score,
  s.points,
  RANK() OVER (ORDER BY s.wilson_score DESC, s.points DESC, s.wins DESC) AS rank
FROM stats s
JOIN people p ON p.id = s.person_id
ORDER BY rank;
