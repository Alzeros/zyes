-- Seed the four whitelisted search engines (mirroring DEFAULT_SEARCH_ENGINES).
-- Run via `npm run seed:engines` (remote) or `seed:engines:local`.

INSERT INTO search_engines (id, name, url, icon, is_active) VALUES
  ('google',     'Google',     'https://www.google.com/search?q={query}', 'google',     1)
, ('bing',       'Bing',       'https://www.bing.com/search?q={query}',   'bing',       1)
, ('duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q={query}',        'duckduckgo', 1)
, ('github',     'GitHub',     'https://github.com/search?q={query}',      'github',     1)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  url  = excluded.url,
  icon = excluded.icon;

-- Default global view mode.
INSERT INTO settings (key, value) VALUES ('all_view_mode', 'detail')
  ON CONFLICT(key) DO NOTHING;
