import type { Bookmark, Category, SearchEngine, ViewSettings } from '../../src/lib/types';
import type { Env } from './types';
import { nanoid } from 'nanoid';
import { parseNetscape, type ParsedBookmarkFile } from '../../src/lib/netscape';

// ── Row shapes as returned by D1 (snake_case columns) ───────────────────────
interface BookmarkRow {
  id: string;
  category_id: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  open_target: 'new' | 'self';
  display_mode: 'compact' | 'detail';
  sort_order: number;
  created_at: string;
  updated_at: string;
}
interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  display_mode: 'compact' | 'detail';
  created_at: string;
}
interface SearchEngineRow {
  id: string;
  name: string;
  url: string;
  icon: string;
  is_active: number;
}
interface SettingsRow {
  key: string;
  value: string;
}

// ── Mappers (snake_case row -> camelCase TS type) ───────────────────────────
const mapBookmark = (r: BookmarkRow): Bookmark => ({
  id: r.id,
  categoryId: r.category_id,
  title: r.title,
  url: r.url,
  description: r.description,
  icon: r.icon,
  openTarget: r.open_target,
  displayMode: r.display_mode === 'detail' ? 'detail' : 'compact',
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const mapCategory = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  sortOrder: r.sort_order,
  displayMode: r.display_mode,
  createdAt: r.created_at,
});

const mapEngine = (r: SearchEngineRow): SearchEngine => ({
  id: r.id,
  name: r.name,
  url: r.url,
  icon: r.icon,
  isActive: r.is_active === 1,
});

export const mapSettings = (rows: SettingsRow[]): ViewSettings => {
  const all = rows.find((r) => r.key === 'all_view_mode')?.value;
  const card = rows.find((r) => r.key === 'card_size')?.value;
  const site = rows.find((r) => r.key === 'site_name')?.value;
  const logo = rows.find((r) => r.key === 'site_logo')?.value;
  return {
    allViewMode: all === 'compact' || all === 'detail' ? all : 'detail',
    cardSize: card === 'xs' || card === 'sm' || card === 'lg' ? (card as ViewSettings['cardSize']) : 'md',
    siteName: (site ?? '').trim() || 'zyes',
    // Empty/missing = use the built-in Z wordmark. No fallback value here
    // (unlike siteName which defaults to 'zyes'): empty IS the "use default" signal.
    siteLogo: (logo ?? '').trim(),
  };
};

// Validate + normalize an untrusted import payload (shared shape with the
// Node backend's parseImport). Rejects malformed shapes BEFORE any DB write so
// a bad file can't half-overwrite data. Coerces each row to a safe shape;
// missing ids get fresh nanoids so categoryId refs (which may point at imported
// category ids) stay intact.
function parseImportPayload(
  raw: unknown
): { categories: Category[]; bookmarks: Bookmark[]; settings: ViewSettings } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Import file is not a JSON object' };
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return { error: `Unsupported export version: ${String(obj.version)}` };
  if (!Array.isArray(obj.categories)) return { error: 'categories is missing or not an array' };
  if (!Array.isArray(obj.bookmarks)) return { error: 'bookmarks is missing or not an array' };

  const categories: Category[] = obj.categories.map((c, i) => {
    const r = c as Record<string, unknown>;
    return {
      id: typeof r.id === 'string' ? r.id : nanoid(10),
      name: typeof r.name === 'string' ? r.name : `Category ${i + 1}`,
      icon: typeof r.icon === 'string' ? r.icon : '',
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
      displayMode: r.displayMode === 'compact' || r.displayMode === 'detail' ? r.displayMode : 'detail',
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    };
  });

  const bookmarks: Bookmark[] = obj.bookmarks.map((b, i) => {
    const r = b as Record<string, unknown>;
    const now = new Date().toISOString();
    return {
      id: typeof r.id === 'string' ? r.id : nanoid(10),
      categoryId: typeof r.categoryId === 'string' ? r.categoryId : '',
      title: typeof r.title === 'string' ? r.title : `Bookmark ${i + 1}`,
      url: typeof r.url === 'string' ? r.url : '',
      description: typeof r.description === 'string' ? r.description : '',
      icon: r.icon === null || typeof r.icon === 'string' ? r.icon : null,
      openTarget: r.openTarget === 'self' ? 'self' : 'new',
      displayMode: r.displayMode === 'compact' || r.displayMode === 'detail' ? r.displayMode : 'compact',
      sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : i,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : now,
      updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : now,
    };
  });

  const sIn = (obj.settings ?? {}) as Record<string, unknown>;
  const settings: ViewSettings = {
    allViewMode: sIn.allViewMode === 'compact' || sIn.allViewMode === 'detail' ? sIn.allViewMode : 'detail',
    cardSize: sIn.cardSize === 'xs' || sIn.cardSize === 'sm' || sIn.cardSize === 'md' || sIn.cardSize === 'lg' ? sIn.cardSize : 'md',
    siteName: typeof sIn.siteName === 'string' ? sIn.siteName : 'zyes',
    siteLogo: typeof sIn.siteLogo === 'string' ? sIn.siteLogo : '',
  };

  return { categories, bookmarks, settings };
}

// ── Tiny query helpers around env.DB ─────────────────────────────────────────
export class Db {
  constructor(private readonly db: D1Database) {}

  async allBookmarks(): Promise<Bookmark[]> {
    const { results } = await this.db.prepare('SELECT * FROM bookmarks ORDER BY sort_order ASC').all<BookmarkRow>();
    return results.map(mapBookmark);
  }

  async bookmarksByCategory(categoryId: string): Promise<Bookmark[]> {
    const { results } = await this.db
      .prepare('SELECT * FROM bookmarks WHERE category_id = ? ORDER BY sort_order ASC')
      .bind(categoryId)
      .all<BookmarkRow>();
    return results.map(mapBookmark);
  }

  async bookmark(id: string): Promise<Bookmark | null> {
    const row = await this.db.prepare('SELECT * FROM bookmarks WHERE id = ?').bind(id).first<BookmarkRow>();
    return row ? mapBookmark(row) : null;
  }

  async insertBookmark(b: Omit<Bookmark, 'id'>, id: string): Promise<Bookmark> {
    await this.db
      .prepare(
        'INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, b.categoryId, b.title, b.url, b.description, b.icon, b.openTarget, b.displayMode, b.sortOrder, b.createdAt, b.updatedAt)
      .run();
    return { ...b, id };
  }

  async updateBookmark(id: string, patch: Partial<Bookmark>): Promise<Bookmark | null> {
    const cols: string[] = [];
    const vals: unknown[] = [];
    const set = (col: string, v: unknown) => {
      cols.push(`${col} = ?`);
      vals.push(v);
    };
    if (patch.categoryId !== undefined) set('category_id', patch.categoryId);
    if (patch.title !== undefined) set('title', patch.title);
    if (patch.url !== undefined) set('url', patch.url);
    if (patch.description !== undefined) set('description', patch.description);
    if (patch.icon !== undefined) set('icon', patch.icon);
    if (patch.openTarget !== undefined) set('open_target', patch.openTarget);
    if (patch.displayMode !== undefined) set('display_mode', patch.displayMode);
    if (patch.sortOrder !== undefined) set('sort_order', patch.sortOrder);
    set('updated_at', new Date().toISOString());
    if (cols.length <= 1) return this.bookmark(id); // only updated_at changed
    vals.push(id);
    await this.db.prepare(`UPDATE bookmarks SET ${cols.join(', ')} WHERE id = ?`).bind(...vals).run();
    return this.bookmark(id);
  }

  async deleteBookmark(id: string): Promise<boolean> {
    const { meta: { changes = 0 } = {} } = await this.db.prepare('DELETE FROM bookmarks WHERE id = ?').bind(id).run();
    return changes > 0;
  }

  async allCategories(): Promise<Category[]> {
    const { results } = await this.db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all<CategoryRow>();
    return results.map(mapCategory);
  }

  async category(id: string): Promise<Category | null> {
    const row = await this.db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first<CategoryRow>();
    return row ? mapCategory(row) : null;
  }

  async insertCategory(c: Omit<Category, 'id'>, id: string): Promise<Category> {
    await this.db
      .prepare('INSERT INTO categories (id, name, icon, sort_order, display_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, c.name, c.icon, c.sortOrder, c.displayMode, c.createdAt)
      .run();
    return { ...c, id };
  }

  async updateCategory(id: string, patch: Partial<Category>): Promise<Category | null> {
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (patch.name !== undefined) { cols.push('name = ?'); vals.push(patch.name); }
    if (patch.icon !== undefined) { cols.push('icon = ?'); vals.push(patch.icon); }
    if (patch.sortOrder !== undefined) { cols.push('sort_order = ?'); vals.push(patch.sortOrder); }
    if (patch.displayMode !== undefined) { cols.push('display_mode = ?'); vals.push(patch.displayMode); }
    if (!cols.length) return this.category(id);
    vals.push(id);
    await this.db.prepare(`UPDATE categories SET ${cols.join(', ')} WHERE id = ?`).bind(...vals).run();
    return this.category(id);
  }

  async deleteCategory(id: string, strategy: 'move' | 'cascade'): Promise<boolean> {
    const batch: D1PreparedStatement[] = [];
    if (strategy === 'cascade') {
      batch.push(this.db.prepare('DELETE FROM bookmarks WHERE category_id = ?').bind(id));
    } else {
      batch.push(this.db.prepare('UPDATE bookmarks SET category_id = ? WHERE category_id = ?').bind('', id));
    }
    batch.push(this.db.prepare('DELETE FROM categories WHERE id = ?').bind(id));
    const res = await this.db.batch(batch);
    const deleted = res.at(-1)?.meta.changes ?? 0;
    return deleted > 0;
  }

  async allEngines(): Promise<SearchEngine[]> {
    const { results } = await this.db.prepare('SELECT * FROM search_engines ORDER BY id ASC').all<SearchEngineRow>();
    return results.map(mapEngine);
  }

  async updateEngine(id: string, patch: Partial<SearchEngine>): Promise<SearchEngine | null> {
    const cols: string[] = [];
    const vals: unknown[] = [];
    if (patch.name !== undefined) { cols.push('name = ?'); vals.push(patch.name); }
    if (patch.url !== undefined) { cols.push('url = ?'); vals.push(patch.url); }
    if (patch.icon !== undefined) { cols.push('icon = ?'); vals.push(patch.icon); }
    if (patch.isActive !== undefined) { cols.push('is_active = ?'); vals.push(patch.isActive ? 1 : 0); }
    if (!cols.length) return (await this.allEngines()).find((e) => e.id === id) ?? null;
    vals.push(id);
    await this.db.prepare(`UPDATE search_engines SET ${cols.join(', ')} WHERE id = ?`).bind(...vals).run();
    return (await this.allEngines()).find((e) => e.id === id) ?? null;
  }

  // ── Bulk reorders / reassign (D1 batch for atomicity + throughput) ────────
  async reorderBookmarks(items: { id: string; sortOrder: number }[]): Promise<void> {
    await this.db.batch(
      items.map((it) => this.db.prepare('UPDATE bookmarks SET sort_order = ? WHERE id = ?').bind(it.sortOrder, it.id))
    );
  }

  async reassignBookmarks(items: { id: string; categoryId: string; sortOrder: number }[]): Promise<void> {
    await this.db.batch(
      items.map((it) =>
        this.db
          .prepare('UPDATE bookmarks SET category_id = ?, sort_order = ? WHERE id = ?')
          .bind(it.categoryId, it.sortOrder, it.id)
      )
    );
  }

  async reorderCategories(items: { id: string; sortOrder: number }[]): Promise<void> {
    await this.db.batch(
      items.map((it) => this.db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?').bind(it.sortOrder, it.id))
    );
  }

  // ── Meta + settings (key/value rows) ───────────────────────────────────────
  async getMeta(key: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<SettingsRow>();
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    await this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
  }

  async getSettingsData(): Promise<ViewSettings> {
    const { results } = await this.db.prepare('SELECT key, value FROM settings').all<SettingsRow>();
    return mapSettings(results);
  }

  async setAllViewMode(mode: 'compact' | 'detail'): Promise<void> {
    await this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('all_view_mode', mode).run();
  }

  async setCardSize(size: ViewSettings['cardSize']): Promise<void> {
    await this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('card_size', size).run();
  }

  async setSiteName(name: string): Promise<void> {
    await this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('site_name', name).run();
  }

  async setSiteLogo(logo: string): Promise<void> {
    await this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind('site_logo', logo).run();
  }

  // Next sort index for a new item appended to a group.
  async nextSortOrder(categoryId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM bookmarks WHERE category_id = ?')
      .bind(categoryId)
      .first<{ next: number }>();
    return row?.next ?? 0;
  }

  // ── Export / import (portable JSON snapshot) ─────────────────────────────
  // Mirrors server/services/store.service.ts buildExport/importData. The
  // snapshot carries categories + bookmarks + settings (no searchEngines —
  // fixed default set). Import is REPLACE: wipe + rewrite in one D1 batch so
  // it's atomic. A pre-import backup is stashed in `meta` as
  // `backup_<timestamp>` (JSON of the full snapshot), capped to the 5 most
  // recent so meta doesn't grow unbounded across many imports.

  async buildExport(): Promise<{
    version: 1;
    exportedAt: string;
    categories: Category[];
    bookmarks: Bookmark[];
    settings: ViewSettings;
  }> {
    const [categories, bookmarks, settings] = await Promise.all([
      this.allCategories(),
      this.allBookmarks(),
      this.getSettingsData(),
    ]);
    return {
      version: 1,
      // Note: Date is unavailable in some Worker contexts for the *module*
      // lifecycle, but fine inside a request handler (this runs per-request).
      exportedAt: new Date().toISOString(),
      categories,
      bookmarks,
      settings,
    };
  }

  // Overwrite the DB with the imported snapshot. REPLACE strategy: existing
  // categories + bookmarks are DELETEd, then the imported rows INSERTed, all in
  // one D1 batch (atomic). searchEngines untouched. Before any mutation, the
  // current snapshot is stashed to meta for manual recovery. settings keys are
  // upserted. Returns the freshly-imported settings.
  async importData(raw: unknown): Promise<{ ok: true; settings: ViewSettings } | { ok: false; error: string }> {
    const parsed = parseImportPayload(raw);
    if ('error' in parsed) return { ok: false, error: parsed.error };

    // Pre-import backup: stash the current full snapshot to meta under a
    // timestamped key. Capped to 5 most recent (oldest pruned) so repeated
    // imports don't bloat meta. Recovery is manual via wrangler d1 execute.
    try {
      const backup = await this.buildExport();
      const ts = backup.exportedAt.replace(/[-:.]/g, '').slice(0, 15); // YYYYMMDDHHMMSS
      const batch: D1PreparedStatement[] = [
        this.db
          .prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
          .bind(`backup_${ts}`, JSON.stringify(backup)),
      ];
      // Prune old backups: keep the 5 newest backup_* keys.
      batch.push(
        this.db.prepare(
          `DELETE FROM meta WHERE key LIKE 'backup_%' AND key NOT IN (
             SELECT key FROM meta WHERE key LIKE 'backup_%' ORDER BY key DESC LIMIT 5
           )`
        )
      );
      await this.db.batch(batch);
    } catch (e) {
      // Backup failure is non-fatal — log and proceed (user confirmed overwrite).
      console.error('import backup stash failed (non-fatal):', String(e));
    }

    // Atomic replace: wipe + insert in one batch. D1 batch is transactional.
    const stmts: D1PreparedStatement[] = [
      this.db.prepare('DELETE FROM bookmarks'),
      this.db.prepare('DELETE FROM categories'),
    ];
    for (const c of parsed.categories) {
      stmts.push(
        this.db
          .prepare('INSERT INTO categories (id, name, icon, sort_order, display_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(c.id, c.name, c.icon, c.sortOrder, c.displayMode, c.createdAt)
      );
    }
    for (const b of parsed.bookmarks) {
      stmts.push(
        this.db
          .prepare(
            'INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(b.id, b.categoryId, b.title, b.url, b.description, b.icon, b.openTarget, b.displayMode, b.sortOrder, b.createdAt, b.updatedAt)
      );
    }
    await this.db.batch(stmts);

    // Settings: upsert the 4 keys (idempotent, replaces existing).
    const sBatch: D1PreparedStatement[] = [
      this.db
        .prepare(`INSERT INTO settings (key, value) VALUES ('all_view_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
        .bind(parsed.settings.allViewMode),
      this.db
        .prepare(`INSERT INTO settings (key, value) VALUES ('card_size', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
        .bind(parsed.settings.cardSize),
      this.db
        .prepare(`INSERT INTO settings (key, value) VALUES ('site_name', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
        .bind(parsed.settings.siteName),
      this.db
        .prepare(`INSERT INTO settings (key, value) VALUES ('site_logo', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
        .bind(parsed.settings.siteLogo),
    ];
    await this.db.batch(sBatch);

    const settings = await this.getSettingsData();
    return { ok: true, settings };
  }

  // ── HTML import (NETSCAPE-Bookmark-file-1) ───────────────────────────────
  // Mirrors server/services/store.service.ts importHtmlData. Parsing is shared
  // via src/lib/netscape.ts. mode='replace' wipes+writes (atomic D1 batch);
  // mode='merge' keeps existing data, reuses categories by name, appends
  // bookmarks with fresh ids + continuing sortOrder. Both stash a backup first.
  async importHtmlData(
    html: string,
    mode: 'replace' | 'merge'
  ): Promise<{ ok: true; settings: ViewSettings } | { ok: false; error: string }> {
    let parsed: ParsedBookmarkFile;
    try {
      parsed = parseNetscape(html);
    } catch (e) {
      return { ok: false, error: `解析 HTML 失败: ${String(e)}` };
    }

    const totalBookmarks = parsed.unfiled.length + parsed.categories.reduce((n, c) => n + c.bookmarks.length, 0);
    if (totalBookmarks === 0) {
      return { ok: false, error: '文件中未找到任何书签(可能不是有效的 NETSCAPE 书签文件)' };
    }

    // Pre-import backup (same stash as importData: snapshot → meta, prune to 5).
    await this.stashBackup();

    const now = () => new Date().toISOString();
    const toBookmark = (b: { title: string; url: string; addDate?: number }, categoryId: string, sortOrder: number): Bookmark => ({
      id: nanoid(10),
      categoryId,
      title: b.title || b.url,
      url: b.url,
      description: '',
      icon: null,
      openTarget: 'new',
      displayMode: 'compact',
      sortOrder,
      createdAt: b.addDate ? new Date(b.addDate * 1000).toISOString() : now(),
      updatedAt: b.addDate ? new Date(b.addDate * 1000).toISOString() : now(),
    });

    if (mode === 'replace') {
      // Atomic wipe + insert in one batch.
      const stmts: D1PreparedStatement[] = [
        this.db.prepare('DELETE FROM bookmarks'),
        this.db.prepare('DELETE FROM categories'),
      ];
      const categoryIds: string[] = [];
      parsed.categories.forEach((c, ci) => {
        const catId = nanoid(10);
        categoryIds.push(catId);
        stmts.push(
          this.db
            .prepare('INSERT INTO categories (id, name, icon, sort_order, display_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(catId, c.name, '', ci, 'detail', now())
        );
      });
      let bi = 0;
      parsed.categories.forEach((c, ci) => {
        c.bookmarks.forEach((b, i) => {
          const bm = toBookmark(b, categoryIds[ci], i);
          stmts.push(
            this.db
              .prepare('INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .bind(bm.id, bm.categoryId, bm.title, bm.url, bm.description, bm.icon, bm.openTarget, bm.displayMode, bm.sortOrder, bm.createdAt, bm.updatedAt)
          );
          bi++;
        });
      });
      let ui = 0;
      parsed.unfiled.forEach((b) => {
        const bm = toBookmark(b, '', ui);
        stmts.push(
          this.db
            .prepare('INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(bm.id, bm.categoryId, bm.title, bm.url, bm.description, bm.icon, bm.openTarget, bm.displayMode, bm.sortOrder, bm.createdAt, bm.updatedAt)
        );
        ui++;
      });
      await this.db.batch(stmts);
      const settings = await this.getSettingsData();
      return { ok: true, settings };
    }

    // merge: reuse existing categories by name, create missing, append.
    const existingCats = await this.allCategories();
    const existingByName = new Map(existingCats.map((c) => [c.name, c]));
    // Max sortOrder per category for continuing numbering.
    const existingBms = await this.allBookmarks();
    const maxSortByCat = new Map<string, number>();
    for (const b of existingBms) {
      const cur = maxSortByCat.get(b.categoryId) ?? -1;
      if (b.sortOrder > cur) maxSortByCat.set(b.categoryId, b.sortOrder);
    }
    const nextSort = (catId: string): number => {
      const cur = maxSortByCat.get(catId) ?? -1;
      const next = cur + 1;
      maxSortByCat.set(catId, next);
      return next;
    };

    const stmts: D1PreparedStatement[] = [];
    let catSortBase = existingCats.length;
    parsed.categories.forEach((c, ci) => {
      let cat = existingByName.get(c.name);
      if (!cat) {
        cat = {
          id: nanoid(10), name: c.name, icon: '',
          sortOrder: catSortBase + ci, displayMode: 'detail', createdAt: now(),
        };
        stmts.push(
          this.db
            .prepare('INSERT INTO categories (id, name, icon, sort_order, display_mode, created_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(cat.id, cat.name, cat.icon, cat.sortOrder, cat.displayMode, cat.createdAt)
        );
        existingByName.set(c.name, cat);
      }
      c.bookmarks.forEach((b) => {
        const bm = toBookmark(b, cat!.id, nextSort(cat!.id));
        stmts.push(
          this.db
            .prepare('INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(bm.id, bm.categoryId, bm.title, bm.url, bm.description, bm.icon, bm.openTarget, bm.displayMode, bm.sortOrder, bm.createdAt, bm.updatedAt)
        );
      });
    });
    parsed.unfiled.forEach((b) => {
      const bm = toBookmark(b, '', nextSort(''));
      stmts.push(
        this.db
          .prepare('INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, display_mode, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(bm.id, bm.categoryId, bm.title, bm.url, bm.description, bm.icon, bm.openTarget, bm.displayMode, bm.sortOrder, bm.createdAt, bm.updatedAt)
      );
    });
    if (stmts.length) await this.db.batch(stmts);

    const settings = await this.getSettingsData();
    return { ok: true, settings };
  }

  // Stash the current full snapshot to meta as backup_<timestamp>, pruning to
  // the 5 most recent. Shared by importData + importHtmlData.
  private async stashBackup(): Promise<void> {
    try {
      const backup = await this.buildExport();
      const ts = backup.exportedAt.replace(/[-:.]/g, '').slice(0, 15);
      await this.db.batch([
        this.db
          .prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
          .bind(`backup_${ts}`, JSON.stringify(backup)),
        this.db.prepare(
          `DELETE FROM meta WHERE key LIKE 'backup_%' AND key NOT IN (
             SELECT key FROM meta WHERE key LIKE 'backup_%' ORDER BY key DESC LIMIT 5
           )`
        ),
      ]);
    } catch (e) {
      console.error('import backup stash failed (non-fatal):', String(e));
    }
  }
}

export type { BookmarkRow, CategoryRow, SearchEngineRow, SettingsRow };

// Convenience: derive a Db helper from the request env.
export function dbOf(env: Env): Db {
  return new Db(env.DB);
}
