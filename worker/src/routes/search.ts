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

  return app;
}
