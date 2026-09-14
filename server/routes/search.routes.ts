import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/search/engines
  fastify.get('/engines', async () => {
    const data = store.getData();
    return { ok: true, data: data.searchEngines };
  });

  // PUT /api/search/engines/:id
  fastify.put('/engines/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = request.body as { isActive?: boolean };
    const engine = store.updateSearchEngine(id, patch);
    if (!engine) {
      return reply.status(404).send({ ok: false, error: 'Search engine not found', code: 'NOT_FOUND' });
    }
    return { ok: true, data: engine };
  });

  // PUT /api/search/engines — bulk-save engine config from the Search settings
  // panel (isActive toggles + optional default engine id). Mirrors the Worker
  // route: returns the refreshed engine list.
  fastify.put('/engines', async (request, reply) => {
    const body = request.body as { engines?: { id: string; isActive: boolean }[]; defaultEngine?: string };
    if (!Array.isArray(body?.engines)) {
      return reply.status(400).send({ ok: false, error: 'Invalid engines payload', code: 'BAD_REQUEST' });
    }
    const engines = store.saveEnginesConfig(body.engines, body.defaultEngine);
    return { ok: true, data: engines };
  });

  // GET /api/search/default — the default search engine id.
  fastify.get('/default', async () => {
    return { ok: true, data: { defaultEngine: store.getSettings().defaultEngine } };
  });
}
