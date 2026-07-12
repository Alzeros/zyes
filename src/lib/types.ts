export interface Bookmark {
  id: string;
  categoryId: string;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  openTarget: 'new' | 'self';
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
