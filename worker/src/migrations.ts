import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from './types';

// ── Versioned, self-healing schema for D1 ─────────────────────────────────
//
// Why this exists: `wrangler deploy` (the push-triggered Workers Build) only
// ships Worker code + static assets — it NEVER applies D1 migrations. The
// `wrangler d1 migrations apply` step is separate and requires the deployer's
// own Cloudflare auth, so forkers who "Deploy to Cloudflare" or sync updates
// never run it. Result: code ships expecting a column the DB doesn't have,
// writes blow up (the display_mode bug). This module makes the Worker heal its
// own schema on cold start, so any deployment — forked or not — converges to
// the schema the code expects, with zero config / secrets / CI.
//
// Model: a monotonically increasing `schema_version` stored in `meta`. Each
// entry in MIGRATIONS is a forward step { v, run }; code declares TARGET =
// highest v. On cold start we read the stored version; if it's < TARGET we run
// every migration from (stored+1) up to TARGET in order, then stamp TARGET.
// Every step MUST be idempotent (re-runnable on a DB that already has the
// change) because a half-applied migration + crash would otherwise leave us
// unable to re-run. New schema changes = APPEND a migration + bump TARGET;
// never edit an existing migration (a live DB may be parked on it).
//
// `meta` itself is created by v1, so the version read before v1 runs must
// tolerate a missing table (returns 0 → run v1).

export interface Migration {
  v: number;
  desc: string;
  // Receives env.DB. Each statement wrapped in its own try so one failure
  // doesn't abort the rest of that step (D1's exec is all-or-nothing per call;
  // we want best-effort + a recorded result, like the old /api/init).
  run: (db: D1Database) => Promise<{ ok: boolean; error?: string }>;
}

// The schema version the CURRENT code expects. Bump this when appending a
// migration. Stored in meta.schema_version after a successful run.
export const TARGET_SCHEMA_VERSION = 3;

// D1 EXEC gotcha: `db.exec(sql)` only accepts statements delimited by newlines
// and chokes on multi-line single statements (it splits on \n and tries each
// "line" as its own statement → "incomplete input" on `CREATE TABLE ... (\n`).
// `prepare().run()` compiles the whole string as one statement and handles
// multi-line DDL correctly, so we use that for every migration statement.
const safeExec = async (db: D1Database, sql: string): Promise<{ ok: boolean; error?: string }> => {
  try {
    await db.prepare(sql).run();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
};

// Each migration is the FULL forward step from v-1 → v. They are written to be
// idempotent: CREATE TABLE IF NOT EXISTS, INSERT ... ON CONFLICT DO
// NOTHING/UPDATE, and ALTER guarded by a pragma_table_info probe (SQLite
// errors on duplicate column, so we must check before ADD COLUMN).
const columnExists = async (db: D1Database, table: string, col: string): Promise<boolean> => {
  const row = await db
    .prepare(`SELECT name FROM pragma_table_info(?) WHERE name = ?`)
    .bind(table, col)
    .first<{ name: string }>();
  return !!row;
};

export const MIGRATIONS: Migration[] = [
  {
    v: 1,
    desc: 'initial schema: categories / bookmarks / search_engines / settings / meta + seed engines + base settings',
    run: async (db) => {
      // Each statement individually guarded so the recorded result reflects
      // exactly which failed (matches old /api/init behaviour). D1 exec runs
      // one statement per call cleanly when separated.
      const stmts = [
        `CREATE TABLE IF NOT EXISTS categories (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          icon         TEXT NOT NULL DEFAULT '',
          sort_order   INTEGER NOT NULL DEFAULT 0,
          display_mode TEXT NOT NULL DEFAULT 'detail' CHECK (display_mode IN ('compact', 'detail')),
          created_at   TEXT NOT NULL
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
          display_mode TEXT NOT NULL DEFAULT 'compact' CHECK (display_mode IN ('compact', 'detail')),
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
      ];
      let allOk = true;
      let firstError: string | undefined;
      for (const s of stmts) {
        const r = await safeExec(db, s);
        if (!r.ok && allOk) { allOk = false; firstError = r.error; }
      }
      return { ok: allOk, error: firstError };
    },
  },
  {
    v: 2,
    desc: 'seed search engines + base view settings (idempotent upserts)',
    run: async (db) => {
      const stmts = [
        `INSERT INTO search_engines (id, name, url, icon, is_active) VALUES
          ('google',     'Google',     'https://www.google.com/search?q={query}', 'google',     1),
          ('bing',       'Bing',       'https://www.bing.com/search?q={query}',   'bing',       1),
          ('duckduckgo', 'DuckDuckGo', 'https://duckduckgo.com/?q={query}',        'duckduckgo', 1),
          ('github',     'GitHub',     'https://github.com/search?q={query}',      'github',     1)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          url  = excluded.url,
          icon = excluded.icon`,
        `INSERT INTO settings (key, value) VALUES ('all_view_mode', 'detail') ON CONFLICT(key) DO NOTHING`,
      ];
      let allOk = true;
      let firstError: string | undefined;
      for (const s of stmts) {
        const r = await safeExec(db, s);
        if (!r.ok && allOk) { allOk = false; firstError = r.error; }
      }
      return { ok: allOk, error: firstError };
    },
  },
  {
    v: 3,
    desc: 'card_size + site_name settings keys; backfill bookmarks.display_mode for pre-v1 DBs',
    run: async (db) => {
      const results: { ok: boolean; error?: string }[] = [];

      // card_size / site_name default settings (idempotent — only seed if absent).
      const settingsStmts = [
        `INSERT INTO settings (key, value) VALUES ('card_size', 'md') ON CONFLICT(key) DO NOTHING`,
        `INSERT INTO settings (key, value) VALUES ('site_name', 'zyes') ON CONFLICT(key) DO NOTHING`,
      ];
      for (const s of settingsStmts) results.push(await safeExec(db, s));

      // Backfill display_mode on bookmarks created before v1 added the column.
      // v1's CREATE TABLE IF NOT EXISTS won't add a column to an existing table,
      // so a DB that predates this code still lacks it. Probe + ALTER only if
      // missing. (A freshly-init'd DB already has it from v1 → skip.)
      try {
        const has = await columnExists(db, 'bookmarks', 'display_mode');
        if (!has) {
          results.push(
            await safeExec(
              db,
              `ALTER TABLE bookmarks ADD COLUMN display_mode TEXT NOT NULL DEFAULT 'compact' CHECK (display_mode IN ('compact', 'detail'))`
            )
          );
        } else {
          results.push({ ok: true });
        }
      } catch (e) {
        results.push({ ok: false, error: String(e) });
      }

      const failed = results.filter((r) => !r.ok);
      return {
        ok: failed.length === 0,
        error: failed.length ? failed.map((r) => r.error).join('; ') : undefined,
      };
    },
  },
];

// ── Version read/write ─────────────────────────────────────────────────────
// Stored in `meta.schema_version`. Before v1 runs, `meta` may not exist →
// reading returns null → treat as version 0.

async function readSchemaVersion(db: D1Database): Promise<number> {
  try {
    const row = await db
      .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
      .first<{ value: string }>();
    if (!row) return 0;
    const n = parseInt(row.value, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    // meta table missing (pre-v1 DB) — not an error, just version 0.
    return 0;
  }
}

async function writeSchemaVersion(db: D1Database, version: number): Promise<void> {
  await db
    .prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(String(version))
    .run();
}

// Module-level guard: ensureSchema touches D1 on every cold start of the
// module instance. Workers reuse a module instance across requests, so this
// flag prevents re-running the (cheap version-read) probe more than once per
// instance. The probe itself is a single indexed PK lookup, but skipping it
// after the first request removes even that.
let ensured = false;

export interface EnsureResult {
  ran: boolean;        // did we actually run migrations (version was behind)?
  fromVersion: number; // version before this run
  toVersion: number;   // version after (== TARGET on success)
  steps: { v: number; desc: string; ok: boolean; error?: string }[];
  ok: boolean;         // every step that ran succeeded
}

// Bring the DB up to TARGET_SCHEMA_VERSION. Runs the forward steps from the
// stored version up to TARGET. Idempotent + safe to call on every request
// (returns early once the module instance has already ensured for this cold
// start, OR when the stored version already matches TARGET).
export async function ensureSchema(env: Env): Promise<EnsureResult> {
  const db = env.DB;
  // Cold-start-fast path: after the first call on this instance, skip entirely.
  if (ensured) return { ran: false, fromVersion: TARGET_SCHEMA_VERSION, toVersion: TARGET_SCHEMA_VERSION, steps: [], ok: true };

  const fromVersion = await readSchemaVersion(db);
  if (fromVersion >= TARGET_SCHEMA_VERSION) {
    ensured = true;
    return { ran: false, fromVersion, toVersion: fromVersion, steps: [], ok: true };
  }

  // Run every migration with v in (fromVersion, TARGET]. Steps are independent
  // best-effort: a failing step is recorded but does NOT abort the rest — we
  // still stamp the highest version we reached so a partial run doesn't loop
  // forever re-running the same failing step on every request. (A genuinely
  // broken step will keep failing on the NEXT deploy that bumps past it, and
  // surfaces in the /api/init response / logs.)
  const steps: { v: number; desc: string; ok: boolean; error?: string }[] = [];
  let reached = fromVersion;
  let allOk = true;
  for (const m of MIGRATIONS) {
    if (m.v <= fromVersion) continue;
    if (m.v > TARGET_SCHEMA_VERSION) break;
    const r = await m.run(db);
    steps.push({ v: m.v, desc: m.desc, ok: r.ok, error: r.error });
    if (r.ok) {
      reached = m.v;
      await writeSchemaVersion(db, m.v);
    } else {
      allOk = false;
      // Stamp the last successful version so we don't re-run from scratch, but
      // STOP: continuing past a failure could apply v+1 on a broken v base.
      break;
    }
  }

  ensured = true;
  return { ran: true, fromVersion, toVersion: reached, steps, ok: allOk };
}
