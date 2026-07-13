import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';
import { buildNetscape } from '../../src/lib/netscape.js';

// GET /api/data/export          — JSON snapshot (zyes's own backup format)
// GET /api/data/export-html      — NETSCAPE-Bookmark-file-1 HTML (browser-importable)
// POST /api/data/import         — JSON snapshot, REPLACE (overwrite + auto-backup)
// POST /api/data/import-html    — NETSCAPE HTML, replace OR merge (?mode=merge default)
//
// The HTML endpoints are the browser interop path: users export bookmarks from
// Chrome/Firefox/etc. and import here, or export from zyes back to a browser.
// JSON is zyes's own lossless backup. Both HTML import modes auto-back-up first.
export async function dataRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/export', async (_request, reply) => {
    const snapshot = store.buildExport();
    const date = snapshot.exportedAt.slice(0, 10);
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="zyes-export-${date}.json"`);
    return reply.send(snapshot);
  });

  fastify.get('/export-html', async (_request, reply) => {
    const data = store.getData();
    const html = buildNetscape({ categories: data.categories, bookmarks: data.bookmarks });
    // Date for the filename — use current time (the snapshot reflects "now").
    const date = new Date().toISOString().slice(0, 10);
    reply.header('Content-Type', 'text/html; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="zyes-bookmarks-${date}.html"`);
    return reply.send(html);
  });

  fastify.post('/import', async (request, reply) => {
    const result = store.importData(request.body);
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error, code: 'INVALID_IMPORT' });
    }
    return { ok: true, data: { settings: result.settings } };
  });

  fastify.post('/import-html', async (request, reply) => {
    const body = request.body as { html?: string; mode?: string } | undefined;
    if (!body || typeof body.html !== 'string') {
      return reply.status(400).send({ ok: false, error: 'Missing html field', code: 'INVALID_IMPORT' });
    }
    const mode: 'replace' | 'merge' = body.mode === 'merge' ? 'merge' : 'replace';
    const result = store.importHtmlData(body.html, mode);
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error, code: 'INVALID_IMPORT' });
    }
    return { ok: true, data: { settings: result.settings } };
  });
}
