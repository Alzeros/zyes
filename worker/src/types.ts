// Minimal shared types for the Worker side. The full domain types
// (Bookmark / Category / SearchEngine / ViewSettings) live in
// src/lib/types.ts and are imported from there by the worker too, so the
// API contract stays identical across the Node backend (`server/`) and the
// Cloudflare Worker backend (`worker/`).

export interface Env {
  // D1 binding declared in wrangler.toml [[d1_databases]].
  DB: D1Database;
  // Workers Secret, set via `wrangler secret put JWT_SECRET`.
  JWT_SECRET: string;
  // Login password (plain text, set as a Worker variable). Forkers set this to
  // their own password in the dashboard. Compared at login time directly.
  ZYES_PASSWORD: string;
  // Static assets binding (Workers Assets) declared in wrangler.toml [assets].
  ASSETS: Fetcher;
}

export const JWT_EXPIRY = '24h';
