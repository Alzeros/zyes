import type { Bookmark, Category, SearchEngine, ViewSettings } from '../../src/lib/types';
import type { Env } from './types';

// ── Row shapes as returned by D1 (snake_case columns) ───────────────────────
interface BookmarkRow {
  id: string;
  category_id: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  open_target: 'new' | 'self';
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
  return {
    allViewMode: all === 'compact' || all === 'detail' ? all : 'detail',
    cardSize: card === 'xs' || card === 'sm' || card === 'lg' ? (card as ViewSettings['cardSize']) : 'md',
    siteName: (site ?? '').trim() || 'zyes',
  };
};

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
        'INSERT INTO bookmarks (id, category_id, title, url, description, icon, open_target, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(id, b.categoryId, b.title, b.url, b.description, b.icon, b.openTarget, b.sortOrder, b.createdAt, b.updatedAt)
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

  // Next sort index for a new item appended to a group.
  async nextSortOrder(categoryId: string): Promise<number> {
    const row = await this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM bookmarks WHERE category_id = ?')
      .bind(categoryId)
      .first<{ next: number }>();
    return row?.next ?? 0;
  }
}

export type { BookmarkRow, CategoryRow, SearchEngineRow, SettingsRow };

// Convenience: derive a Db helper from the request env.
export function dbOf(env: Env): Db {
  return new Db(env.DB);
}
