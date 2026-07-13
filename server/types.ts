// Shared types for server-side use (mirrors frontend types)
export interface Bookmark {
  id: string;
  categoryId: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  openTarget: 'new' | 'self';
  displayMode: 'compact' | 'detail';
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  displayMode: 'compact' | 'detail';
  createdAt: string;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
  isActive: boolean;
}

export interface ViewSettings {
  allViewMode: 'compact' | 'detail';
  // Optional on the Node backend: it only persists allViewMode. cardSize/siteName
  // are returned with defaults by getSettings() so the frontend gets a complete
  // object, but aren't persisted (Worker-only feature).
  cardSize?: 'xs' | 'sm' | 'md' | 'lg';
  siteName?: string;
}

export interface AppData {
  categories: Category[];
  bookmarks: Bookmark[];
  searchEngines: SearchEngine[];
  settings?: ViewSettings;
}

export interface AppConfig {
  passwordHash: string;
  jwtSecret: string;
  jwtExpiry: string;
  port: number;
  host: string;
}

// Portable snapshot for export/import. Mirrors frontend ExportData in
// src/lib/types.ts. searchEngines omitted (fixed default set). Import preserves
// original ids so bookmark.categoryId refs stay intact.
export interface ExportData {
  version: 1;
  exportedAt: string;
  categories: Category[];
  bookmarks: Bookmark[];
  settings: ViewSettings;
}
