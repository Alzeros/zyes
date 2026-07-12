import { Hono } from 'hono';
import type { Env } from '../types';

// One-shot schema init endpoint.
// Call once after binding D1 in the dashboard. Idempotent (all statements use
// `CREATE TABLE IF NOT EXISTS` / `INSERT … ON CONFLICT DO UPDATE`).
// Mounted under /api/init.
export function initRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/', async (c) => {
    const sql = [
      // ── 0001_init.sql (schema) ──────────────────────────────────────────
      `CREATE TABLE IF NOT EXISTS categories (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        icon        TEXT NOT NULL DEFAULT '',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        display_mode TEXT NOT NULL DEFAULT 'detail' CHECK (display_mode IN ('compact', 'detail')),
        created_at  TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order)`,

      `CREATE TABLE IF NOT EXISTS bookmarks (
        id           TEXT PRIMARY KEY,
        category_id  TEXT NOT NULL DEFAULT '',
        title        TEXT NOT NULL,
        url          TEXT NOT NULL,
        description  TEXT NOT NULL DEFAULT '',
        icon         TEXT,
        open_target  TEXT NOT NULL DEFAULT 'new' CHECK (open_target IN ('new', 'self')),
        sort_order   INTEGER NOT NULL DEFAULT 0,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_bookmarks_cat ON bookmarks(category_id, sort_order)`,

      `CREATE TABLE IF NOT EXISTS search_engines (
        id        TEXT PRIMARY KEY,
        name      TEXT NOT NULL,
        url       TEXT NOT NULL,
        icon      TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1
      )`,

      `CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // ── 0002_seed_engines.sql (seeds) ───────────────────────────────────
      `INSERT INTO search_engines (id, name, url, icon, is_active) VALUES
        ('google',     'Google',     'https://www.google.com/search?q={query}', 'google',     1),
        ('bing',       'Bing',       'https://www.bing.com/search?q={query}',   'bing',       1),
        ('duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q={query}',        'duckduckgo', 1),
        ('github',     'GitHub',     'https://github.com/search?q={query}',      'github',     1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        url  = excluded.url,
        icon = excluded.icon`,

      `INSERT INTO settings (key, value) VALUES ('all_view_mode', 'detail')
        ON CONFLICT(key) DO NOTHING`,

      `INSERT INTO settings (key, value) VALUES ('card_size', 'md')
        ON CONFLICT(key) DO NOTHING`,

      `INSERT INTO settings (key, value) VALUES ('site_name', 'zyes')
        ON CONFLICT(key) DO NOTHING`,
    ];

    try {
      const results: { ok: boolean; sql: string; error?: string }[] = [];

      for (const s of sql) {
        try {
          await c.env.DB.exec(s);
          results.push({ ok: true, sql: s.slice(0, 50) + '...' });
        } catch (e) {
          results.push({ ok: false, sql: s.slice(0, 50) + '...', error: String(e) });
        }
      }

      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        return c.json({ ok: false, error: `${failed.length} statement(s) failed`, detail: failed }, 500);
      }

      return c.json({ ok: true, data: { message: `Schema initialised. ${results.length} statements executed.` } });
    } catch (e) {
      return c.json({ ok: false, error: String(e) }, 500);
    }
  });

  // GET check — returns whether tables exist
  app.get('/', async (c) => {
    try {
      const row = await c.env.DB.prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='categories'`
      ).first<{ name: string }>();
      return c.json({ ok: true, data: { initialized: !!row } });
    } catch {
      return c.json({ ok: true, data: { initialized: false } });
    }
  });

  return app;
}