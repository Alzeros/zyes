import { Hono } from 'hono';
import type { Env } from '../types';
import { dbOf } from '../db';

// Mounted under /api/search. GET /engines is public (whitelisted).
export function searchRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/engines', async (c) => {
    const engines = await dbOf(c.env).allEngines();
    return c.json({ ok: true, data: engines });
  });

  app.put('/engines/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json<{ isActive?: boolean }>();
    const engine = await dbOf(c.env).updateEngine(id, patch);
    if (!engine) return c.json({ ok: false, error: 'Search engine not found', code: 'NOT_FOUND' }, 404);
    return c.json({ ok: true, data: engine });
  });

  // Bulk-save engine config from the Search settings panel. Accepts the full
  // desired state of all engines (isActive toggles) plus an optional default
  // engine id. Applied atomically in one D1 batch. Returns the refreshed
  // engine list so the client can update local state from one source.
  app.put('/engines', async (c) => {
    const body = await c.req.json<{ engines: { id: string; isActive: boolean }[]; defaultEngine?: string }>();
    if (!Array.isArray(body?.engines)) {
      return c.json({ ok: false, error: 'Invalid engines payload', code: 'BAD_REQUEST' }, 400);
    }
    const db = dbOf(c.env);
    await db.saveEnginesConfig(body.engines, body.defaultEngine);
    const engines = await db.allEngines();
    return c.json({ ok: true, data: engines });
  });

  // GET the default search engine id. Also public (like GET /engines) so the
  // login screen / pre-auth state can render the correct default. Actually
  // this is NOT in the public whitelist — it's auth-gated. That's fine: the
  // default engine is only needed after login (SearchBar uses it).
  app.get('/default', async (c) => {
    const defaultEngine = await dbOf(c.env).getDefaultEngine();
    return c.json({ ok: true, data: { defaultEngine } });
  });

  return app;
}
