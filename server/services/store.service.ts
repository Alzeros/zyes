import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDataDir } from '../config.js';
import writeFileAtomic from 'write-file-atomic';
import { nanoid } from 'nanoid';
import type { AppData, Bookmark, Category, SearchEngine, ViewSettings } from '../types.js';

export const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'google', isActive: true },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}', icon: 'bing', isActive: true },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}', icon: 'duckduckgo', isActive: true },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'github', isActive: true },
];

function getStorePath(): string {
  return resolve(getDataDir(), 'data.json');
}

let cache: AppData | null = null;

function ensureDataDir(): void {
  const dir = getDataDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function defaultData(): AppData {
  return {
    categories: [],
    bookmarks: [],
    searchEngines: [...DEFAULT_SEARCH_ENGINES],
  };
}

export function loadData(): AppData {
  if (cache) return cache;
  ensureDataDir();
  const storePath = getStorePath();
  if (!existsSync(storePath)) {
    cache = defaultData();
    saveData(cache);
    return cache;
  }
  try {
    const raw = readFileSync(storePath, 'utf-8');
    cache = migrateData(JSON.parse(raw) as AppData);
  } catch {
    cache = defaultData();
    saveData(cache);
  }
  return cache;
}

// Backfill new fields on data written by older versions.
function migrateData(data: AppData): AppData {
  for (const cat of data.categories) {
    if (cat.displayMode !== 'compact' && cat.displayMode !== 'detail') {
      cat.displayMode = 'detail';
    }
  }
  for (const b of data.bookmarks) {
    if (b.openTarget !== 'new' && b.openTarget !== 'self') {
      b.openTarget = 'new';
    }
    // Backfill per-card display mode (added in the per-card-display-mode change).
    // Old bookmarks written before this field existed default to compact.
    if (b.displayMode !== 'compact' && b.displayMode !== 'detail') {
      b.displayMode = 'compact';
    }
  }
  if (data.settings?.allViewMode !== 'compact' && data.settings?.allViewMode !== 'detail') {
    data.settings = { allViewMode: 'detail' };
  }
  // Prune to the whitelisted engines and ensure all defaults are present,
  // preserving any per-engine isActive toggles the user already set.
  const existing = new Map(data.searchEngines.map((e) => [e.id, e]));
  data.searchEngines = DEFAULT_SEARCH_ENGINES.map((def) => {
    const cur = existing.get(def.id);
    return cur ? { ...def, isActive: cur.isActive } : def;
  });
  return data;
}

export function getData(): AppData {
  return loadData();
}

export function saveData(data: AppData): void {
  ensureDataDir();
  cache = data;
  const storePath = getStorePath();
  writeFileAtomic.sync(storePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Bookmark operations
export function addBookmark(input: Omit<Bookmark, 'id' | 'createdAt' | 'updatedAt'>): Bookmark {
  const data = getData();
  const now = new Date().toISOString();
  const bookmark: Bookmark = {
    ...input,
    id: nanoid(10),
    createdAt: now,
    updatedAt: now,
  };
  data.bookmarks.push(bookmark);
  saveData(data);
  return bookmark;
}

export function updateBookmark(id: string, patch: Partial<Bookmark>): Bookmark | null {
  const data = getData();
  const idx = data.bookmarks.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  data.bookmarks[idx] = {
    ...data.bookmarks[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  saveData(data);
  return data.bookmarks[idx];
}

export function deleteBookmark(id: string): boolean {
  const data = getData();
  const idx = data.bookmarks.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  data.bookmarks.splice(idx, 1);
  saveData(data);
  return true;
}

// Bulk reorder: update sortOrder for many bookmarks in one write.
export function reorderBookmarks(items: { id: string; sortOrder: number }[]): void {
  const data = getData();
  const orderById = new Map(items.map((it) => [it.id, it.sortOrder]));
  let changed = false;
  for (const b of data.bookmarks) {
    const next = orderById.get(b.id);
    if (next !== undefined && next !== b.sortOrder) {
      b.sortOrder = next;
      changed = true;
    }
  }
  if (changed) saveData(data);
}

// Bulk reassign: set categoryId and sortOrder for many bookmarks in one write.
// Used for cross-category drag: each entry pins a card to a target group at an index.
export function reassignBookmarks(items: { id: string; categoryId: string; sortOrder: number }[]): void {
  const data = getData();
  const patchById = new Map(items.map((it) => [it.id, it]));
  let changed = false;
  for (const b of data.bookmarks) {
    const patch = patchById.get(b.id);
    if (!patch) continue;
    if (b.categoryId !== patch.categoryId) { b.categoryId = patch.categoryId; changed = true; }
    if (b.sortOrder !== patch.sortOrder) { b.sortOrder = patch.sortOrder; changed = true; }
  }
  if (changed) saveData(data);
}

// Category operations
export function addCategory(input: Omit<Category, 'id' | 'createdAt'>): Category {
  const data = getData();
  const category: Category = {
    ...input,
    id: nanoid(10),
    createdAt: new Date().toISOString(),
  };
  data.categories.push(category);
  saveData(data);
  return category;
}

export function updateCategory(id: string, patch: Partial<Category>): Category | null {
  const data = getData();
  const idx = data.categories.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data.categories[idx] = { ...data.categories[idx], ...patch, id };
  saveData(data);
  return data.categories[idx];
}

// Bulk reorder: update sortOrder for many categories in one write.
// The "All" page groups render in sortOrder, so this also reorders those sections.
export function reorderCategories(items: { id: string; sortOrder: number }[]): void {
  const data = getData();
  const orderById = new Map(items.map((it) => [it.id, it.sortOrder]));
  let changed = false;
  for (const c of data.categories) {
    const next = orderById.get(c.id);
    if (next !== undefined && next !== c.sortOrder) {
      c.sortOrder = next;
      changed = true;
    }
  }
  if (changed) saveData(data);
}

export function deleteCategory(id: string, strategy: 'move' | 'cascade' = 'move'): boolean {
  const data = getData();
  const idx = data.categories.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  data.categories.splice(idx, 1);

  if (strategy === 'cascade') {
    data.bookmarks = data.bookmarks.filter((b) => b.categoryId !== id);
  } else {
    // Move bookmarks to uncategorized (empty categoryId)
    data.bookmarks.forEach((b) => {
      if (b.categoryId === id) b.categoryId = '';
    });
  }
  saveData(data);
  return true;
}

// Search engine operations
export function updateSearchEngine(id: string, patch: Partial<SearchEngine>): SearchEngine | null {
  const data = getData();
  const idx = data.searchEngines.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  data.searchEngines[idx] = { ...data.searchEngines[idx], ...patch };
  saveData(data);
  return data.searchEngines[idx];
}

// View settings (global). Persisted to data.settings as a key/value blob so
// cardSize/siteName survive across restarts (previously only allViewMode was
// saved, which made the settings panel's card-size change silently no-op on
// the Node backend). getSettings returns a complete object with defaults.
export function getSettings(): ViewSettings {
  const data = getData();
  const s = data.settings ?? (data.settings = { allViewMode: 'detail' } as any);
  if (s.allViewMode !== 'compact' && s.allViewMode !== 'detail') s.allViewMode = 'detail';
  if (s.cardSize !== 'xs' && s.cardSize !== 'sm' && s.cardSize !== 'md' && s.cardSize !== 'lg') s.cardSize = 'md';
  if (typeof s.siteName !== 'string') s.siteName = 'zyes';
  saveData(data);
  return { allViewMode: s.allViewMode, cardSize: s.cardSize, siteName: s.siteName };
}

export function updateSettings(patch: { allViewMode?: 'compact' | 'detail'; cardSize?: 'xs' | 'sm' | 'md' | 'lg'; siteName?: string }): ViewSettings {
  const data = getData();
  const s = data.settings ?? (data.settings = { allViewMode: 'detail' } as any);
  if (s.allViewMode !== 'compact' && s.allViewMode !== 'detail') s.allViewMode = 'detail';
  if (s.cardSize !== 'xs' && s.cardSize !== 'sm' && s.cardSize !== 'md' && s.cardSize !== 'lg') s.cardSize = 'md';
  if (typeof s.siteName !== 'string') s.siteName = 'zyes';
  if (patch.allViewMode === 'compact' || patch.allViewMode === 'detail') s.allViewMode = patch.allViewMode;
  if (patch.cardSize === 'xs' || patch.cardSize === 'sm' || patch.cardSize === 'md' || patch.cardSize === 'lg') s.cardSize = patch.cardSize;
  if (typeof patch.siteName === 'string') s.siteName = patch.siteName.slice(0, 64).trim() || 'zyes';
  saveData(data);
  return { allViewMode: s.allViewMode, cardSize: s.cardSize, siteName: s.siteName };
}
