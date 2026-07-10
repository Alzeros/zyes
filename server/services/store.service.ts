import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDataDir } from '../config.js';
import writeFileAtomic from 'write-file-atomic';
import { nanoid } from 'nanoid';
import type { AppData, Bookmark, Category, SearchEngine } from '../types.js';

const DEFAULT_SEARCH_ENGINES: SearchEngine[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={query}', icon: 'google', isActive: true },
  { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={query}', icon: 'bing', isActive: true },
  { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={query}', icon: 'duckduckgo', isActive: true },
  { id: 'baidu', name: 'Baidu', url: 'https://www.baidu.com/s?wd={query}', icon: 'baidu', isActive: true },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q={query}', icon: 'github', isActive: true },
  { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q={query}', icon: 'stackoverflow', isActive: true },
  { id: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q={query}', icon: 'npm', isActive: true },
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
    cache = JSON.parse(raw) as AppData;
  } catch {
    cache = defaultData();
    saveData(cache);
  }
  return cache;
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
