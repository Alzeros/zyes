// Shared types for server-side use (mirrors frontend types)
export interface Bookmark {
  id: string;
  categoryId: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
  isActive: boolean;
}

export interface AppData {
  categories: Category[];
  bookmarks: Bookmark[];
  searchEngines: SearchEngine[];
}

export interface AppConfig {
  passwordHash: string;
  jwtSecret: string;
  jwtExpiry: string;
  port: number;
  host: string;
}
