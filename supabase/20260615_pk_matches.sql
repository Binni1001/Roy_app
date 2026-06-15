-- PK (Player vs Player) matches
CREATE TABLE IF NOT EXISTS pk_matches (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type             TEXT NOT NULL CHECK (match_type IN ('singles', 'doubles')),
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),

  -- Challenger side
  challenger_id          UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  challenger_partner_id  UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Opponent side
  opponent_id            UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  opponent_partner_id    UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Result
  winner_side            TEXT CHECK (winner_side IN ('challenger', 'opponent')),

  -- Bet items (e.g. "nước, bánh mì")
  bet_items              TEXT,

  played_at              TIMESTAMPTZ,
  note                   TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now()
);

-- Index để query nhanh theo người chơi
CREATE INDEX IF NOT EXISTS idx_pk_challenger   ON pk_matches(challenger_id);
CREATE INDEX IF NOT EXISTS idx_pk_opponent     ON pk_matches(opponent_id);
CREATE INDEX IF NOT EXISTS idx_pk_status       ON pk_matches(status);

-- Leaderboard view: tổng hợp win/loss theo từng người
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
    COUNT(*)           AS total_matches,
    SUM(is_win)        AS wins,
    COUNT(*) - SUM(is_win) AS losses,
    ROUND(SUM(is_win)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1) AS win_rate
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
  RANK() OVER (ORDER BY s.wins DESC, s.win_rate DESC) AS rank
FROM stats s
JOIN people p ON p.id = s.person_id
ORDER BY rank;
