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
    const body = await c.req.json<{ allViewMode?: string; cardSize?: string; siteName?: unknown }>();

    // Validate the optional fields. Any subset may be sent; a field that fails
    // validation rejects the whole request.
    if (body?.allViewMode !== undefined && body.allViewMode !== 'compact' && body.allViewMode !== 'detail') {
      return c.json({ ok: false, error: 'Invalid allViewMode', code: 'BAD_REQUEST' }, 400);
    }
    if (body?.cardSize !== undefined && body.cardSize !== 'xs' && body.cardSize !== 'sm' && body.cardSize !== 'md' && body.cardSize !== 'lg') {
      return c.json({ ok: false, error: 'Invalid cardSize', code: 'BAD_REQUEST' }, 400);
    }
    // siteName: coerce to string, trim, cap at a sane length. Empty falls back
    // to the default 'zyes' on read.
    let siteName: string | undefined;
    if (body?.siteName !== undefined) {
      if (typeof body.siteName !== 'string') {
        return c.json({ ok: false, error: 'Invalid siteName', code: 'BAD_REQUEST' }, 400);
      }
      siteName = body.siteName.slice(0, 64).trim();
    }

    const db = dbOf(c.env);
    if (body.allViewMode !== undefined) await db.setAllViewMode(body.allViewMode as 'compact' | 'detail');
    if (body.cardSize !== undefined) await db.setCardSize(body.cardSize as 'md' | 'xs' | 'sm' | 'lg');
    if (siteName !== undefined) await db.setSiteName(siteName);

    // Return the full merged settings so the client can update local state from one source.
    const settings = await db.getSettingsData();
    return c.json({ ok: true, data: settings });
  });

  return app;
}
