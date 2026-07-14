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
}
