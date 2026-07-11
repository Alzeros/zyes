import { Hono } from 'hono';
import type { Env } from '../types';
import { dbOf } from '../db';

// Mounted under /api/settings.
export function settingsRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/view', async (c) => {
    const settings = await dbOf(c.env).getSettingsData();
    return c.json({ ok: true, data: settings });
  });

  app.put('/view', async (c) => {
    const body = await c.req.json<{ allViewMode?: string }>();
    const mode = body?.allViewMode;
    if (mode !== 'compact' && mode !== 'detail') {
      return c.json({ ok: false, error: 'Invalid allViewMode', code: 'BAD_REQUEST' }, 400);
    }
    await dbOf(c.env).setAllViewMode(mode);
    return c.json({ ok: true, data: { allViewMode: mode } });
  });

  return app;
}
