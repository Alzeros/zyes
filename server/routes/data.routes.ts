import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

// GET /api/data/export — download a portable JSON snapshot of the user's data
// (categories + bookmarks + settings; no searchEngines). The reply is sent as
// an attachment so the browser offers to save it rather than rendering it.
//
// POST /api/data/import — overwrite the store with the posted snapshot. REPLACE
// strategy: existing categories/bookmarks are wiped, settings overwritten.
// Before touching anything, the current data.json is copied to data.json.bak
// as a manual-recovery safety net. The client gates this behind a confirm
// dialog; the .bak is the last-resort undo.
export async function dataRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/export', async (request, reply) => {
    const snapshot = store.buildExport();
    // Filename with the export date so repeated exports don't clobber each other.
    const date = snapshot.exportedAt.slice(0, 10); // YYYY-MM-DD
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="zyes-export-${date}.json"`);
    return reply.send(snapshot);
  });

  fastify.post('/import', async (request, reply) => {
    const result = store.importData(request.body);
    if (!result.ok) {
      return reply.status(400).send({ ok: false, error: result.error, code: 'INVALID_IMPORT' });
    }
    return { ok: true, data: { settings: result.settings } };
  });
}
