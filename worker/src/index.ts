import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifyToken } from './auth';
import type { Env } from './types';
import { authRoutes } from './routes/auth';
import { bookmarkRoutes } from './routes/bookmarks';
import { categoryRoutes } from './routes/categories';
import { searchRoutes } from './routes/search';
import { settingsRoutes } from './routes/settings';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({ origin: '*', credentials: true }));

// Public API paths that don't require auth (mirrors server/index.ts PUBLIC_*).
const PUBLIC_PATHS = new Set(['/api/auth/login']);
const PUBLIC_GET = ['/api/search/engines'];

function isPublic(method: string, url: string): boolean {
  // strip query string
  const path = url.split('?')[0];
  if (PUBLIC_PATHS.has(path)) return true;
  if (method === 'GET' && PUBLIC_GET.some((p) => path.startsWith(p))) return true;
  if (!path.startsWith('/api/')) return true; // static assets handled by [assets] binding
  return false;
}

// Auth gate (mirrors the server's root-level onRequest hook).
app.use('/api/*', async (c, next) => {
  if (isPublic(c.req.method, c.req.path)) return next();
  const authHeader = c.req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  const token = authHeader.slice('Bearer '.length).trim();
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

// SPA fallback: any non-/api path serves the built client via the assets binding.
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;

