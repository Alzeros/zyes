-- Add per-card display_mode to bookmarks (the per-card-display-mode change).
-- New deployments get this column from CREATE TABLE in init.ts / 0001_init.sql;
-- this migration is for EXISTING deployments whose table predates the column.
--
-- SQLite ALTER TABLE ADD COLUMN with a CHECK constraint: the CHECK is allowed
-- on a new column. Existing rows get the DEFAULT 'compact'. Idempotent-guarded
-- in init.ts via pragma_table_info, but running this directly in the D1 console
-- requires you to NOT have the column yet (re-running errors harmlessly).

ALTER TABLE bookmarks ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'compact'
  CHECK (display_mode IN ('compact', 'detail'));
