import { Hono } from 'hono';
import type { Env } from '../types';
import { dbOf } from '../db';
import { buildNetscape } from '../../../src/lib/netscape';

// Mounted under /api/data. Mirrors server/routes/data.routes.ts.
//
// GET  /export        — JSON snapshot (zyes's own backup format)
// GET  /export-html    — NETSCAPE-Bookmark-file-1 HTML (browser-importable)
// POST /import         — JSON snapshot, REPLACE (overwrite + auto-backup)
// POST /import-html    — NETSCAPE HTML, {html, mode:'replace'|'merge'}
export function dataRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.get('/export', async (c) => {
    const snapshot = await dbOf(c.env).buildExport();
    const date = snapshot.exportedAt.slice(0, 10);
    c.header('Content-Type', 'application/json; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="zyes-export-${date}.json"`);
    return c.body(JSON.stringify(snapshot));
  });

  app.get('/export-html', async (c) => {
    const db = dbOf(c.env);
    const [categories, bookmarks] = await Promise.all([db.allCategories(), db.allBookmarks()]);
    const html = buildNetscape({ categories, bookmarks });
    const date = new Date().toISOString().slice(0, 10);
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="zyes-bookmarks-${date}.html"`);
    return c.body(html);
  });

  app.post('/import', async (c) => {
    const body = await c.req.json().catch(() => null);
    const result = await dbOf(c.env).importData(body);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error, code: 'INVALID_IMPORT' }, 400);
    }
    return c.json({ ok: true, data: { settings: result.settings } });
  });

  app.post('/import-html', async (c) => {
    const body = await c.req.json<{ html?: string; mode?: string }>().catch(() => null);
    if (!body || typeof body.html !== 'string') {
      return c.json({ ok: false, error: 'Missing html field', code: 'INVALID_IMPORT' }, 400);
    }
    const mode: 'replace' | 'merge' = body.mode === 'merge' ? 'merge' : 'replace';
    const result = await dbOf(c.env).importHtmlData(body.html, mode);
    if (!result.ok) {
      return c.json({ ok: false, error: result.error, code: 'INVALID_IMPORT' }, 400);
    }
    return c.json({ ok: true, data: { settings: result.settings } });
  });

  return app;
}

