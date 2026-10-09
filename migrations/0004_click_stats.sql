-- Click statistics: one row per (card, day) with a running counter.
-- Written by POST /api/stats/click (INSERT ... ON CONFLICT count+1).
-- `day` is the CLIENT's local calendar day (YYYY-MM-DD), so "today" matches
-- the user's clock without server-side timezone math.
--
-- Totals are never stored redundantly: SUM(count) over all days IS the total.
-- Rows for deleted bookmarks are left in place (harmless orphans); the
-- frontend joins against live bookmarks so they simply never render.

CREATE TABLE IF NOT EXISTS click_stats (
  card_id TEXT NOT NULL,
  day     TEXT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (card_id, day)
);
CREATE INDEX IF NOT EXISTS idx_click_stats_day ON click_stats(day);
