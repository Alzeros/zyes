import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyToken, tokenFromRequest } from './auth';
import { ensureSchema } from './migrations';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { bookmarkRoutes } from './routes/bookmarks';
import { categoryRoutes } from './routes/categories';
import { searchRoutes } from './routes/search';
import { settingsRoutes } from './routes/settings';
import { initRoutes } from './routes/init';
import { iconRoutes } from './routes/icon';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', credentials: true }));

const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/init']);
const PUBLIC_GET = ['/api/search/engines'];

function isPublic(method: string, url: string): boolean {
  // strip query string
  const path = url.split('?')[0];
  if (PUBLIC_PATHS.has(path)) return true;
  if (method === 'GET' && PUBLIC_GET.some((p) => path.startsWith(p))) return true;
  if (!path.startsWith('/api/')) return true; // static assets handled by [assets] binding
  return false;
}

// Auth gate (mirrors the server's root-level onRequest hook). Accepts the JWT
// from EITHER the Authorization: Bearer header (regular API client) OR a `t`
// query param (the <img>-driven icon proxy at /api/icon, which can't set
// headers). Public paths skip auth entirely.
//
// Schema self-heal: ensureSchema runs on the module instance's first authed
// request and brings D1 up to the version the code expects (idempotent + skips
// after the first call per cold start via a module flag). This is the
// fork-friendly migration path — `wrangler deploy` never applies D1 migrations,
// so the Worker heals its own schema on cold start. Run BEFORE the route so a
// write (e.g. POST /api/bookmarks needing the display_mode column) never lands
// before the column exists. We await it (best-effort) but never let a schema
// failure 500 the whole API — a broken migration surfaces in /api/init/logs,
// not as a site-wide outage; the request still proceeds against the DB as-is.
app.use('/api/*', async (c, next) => {
  if (isPublic(c.req.method, c.req.path)) return next();
  // Best-effort schema convergence. Cheap after the first request (module flag
  // short-circuits before even reading the version).
  try {
    await ensureSchema(c.env);
  } catch (e) {
    console.error('ensureSchema threw (non-fatal):', String(e));
  }
  const token = tokenFromRequest(c);
  if (!token) return c.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  const ok = await verifyToken(token, c.env.JWT_SECRET);
  if (!ok) return c.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  return next();
});

// Route modules.
app.route('/api/auth', authRoutes());
app.route('/api/bookmarks', bookmarkRoutes());
app.route('/api/categories', categoryRoutes());
app.route('/api/search', searchRoutes());
app.route('/api/settings', settingsRoutes());
app.route('/api/init', initRoutes());
app.route('/api/icon', iconRoutes());

// SPA fallback: any non-/api path serves the built client via the assets binding.
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;

