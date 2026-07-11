import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

export async function settingsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/settings/view — global view settings (incl. the "All" category view mode)
  fastify.get('/view', async () => {
    const settings = store.getSettings();
    return { ok: true, data: settings };
  });

  // PUT /api/settings/view — update the "All" category view mode
  fastify.put('/view', async (request) => {
    const { allViewMode } = request.body as { allViewMode?: string };
    if (allViewMode !== 'compact' && allViewMode !== 'detail') {
      return { ok: false, error: 'Invalid view mode', code: 'INVALID_MODE' };
    }
    const settings = store.updateAllViewMode(allViewMode);
    return { ok: true, data: settings };
  });
}
