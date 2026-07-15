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

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ViewSettings {
  allViewMode: 'compact' | 'detail';
  cardSize: CardSize;
  siteName: string;
  // Custom site logo: an iconify name (e.g. "mdi:github") or an image URL.
  // Empty string = render the built-in Z SVG + "yes" wordmark everywhere it
  // appears (Header / LoginScreen / AboutModal). Stored server-side so it
  // syncs across devices, same as siteName.
  siteLogo: string;
  // The default search engine id (e.g. "google"). Stored server-side so it
  // syncs across devices. SearchBar uses this as the initial engine when no
  // local preference has been set.
  defaultEngine: string;
}

export interface AppData {
  categories: Category[];
  bookmarks: Bookmark[];
  searchEngines: SearchEngine[];
  settings?: ViewSettings;
}

export interface LoginRequest {
  password: string;
}

export interface LoginResponse {
  ok: boolean;
  data: {
    token: string;
    expiresIn: string;
  };
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
}

export interface ApiError {
  ok: false;
  error: string;
  code: string;
}

// ── Data export / import format ────────────────────────────────────────────
// A portable snapshot of the user's bookmarks, categories, and settings. Used
// by GET /api/data/export (download) and POST /api/data/import (overwrite).
// searchEngines are NOT included — they're a fixed default set seeded on init,
// so carrying them across instances is noise. Import preserves original ids so
// bookmark.categoryId references stay intact.
//
// `version` lets future format changes migrate old exports. Bump only when the
// shape changes, and add an import migration path in the same change.
export interface ExportData {
  version: 1;
  exportedAt: string;          // ISO timestamp of the export
  categories: Category[];
  bookmarks: Bookmark[];
  settings: ViewSettings;
}
