// API base: same-origin by default (Node backend proxied at /api, or Worker
// serving both SPA + /api under one domain). Set VITE_API_BASE to point the
// frontend at a separately-hosted backend (e.g. Worker on another domain).
// Lives in its own module because auth.ts needs it too, and api.ts imports
// auth.ts — exporting it from api.ts would create a circular import.
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '';
