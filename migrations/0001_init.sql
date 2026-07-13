-- zyes D1 schema (mirrors server/types.ts + src/lib/types.ts).
-- Snake_case columns; worker/src/db.ts maps rows back to the camelCase TS types.

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  display_mode TEXT NOT NULL DEFAULT 'detail' CHECK (display_mode IN ('compact', 'detail')),
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

CREATE TABLE IF NOT EXISTS bookmarks (
  id           TEXT PRIMARY KEY,
  category_id  TEXT NOT NULL DEFAULT '',
  title        TEXT NOT NULL,
  url          TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  icon         TEXT,                         -- nullable (NULL == auto favicon)
  open_target  TEXT NOT NULL DEFAULT 'new' CHECK (open_target IN ('new', 'self')),
  display_mode TEXT NOT NULL DEFAULT 'compact' CHECK (display_mode IN ('compact', 'detail')),
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_cat ON bookmarks(category_id, sort_order);

CREATE TABLE IF NOT EXISTS search_engines (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  url       TEXT NOT NULL,
  icon      TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1  -- 0/1 boolean
);

-- Key/value tables for global settings and runtime metadata.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,        -- e.g. 'all_view_mode'
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,        -- 'password_hash', 'jwt_issued_at', ...
  value TEXT NOT NULL
);
