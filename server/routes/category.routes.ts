import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/categories
  fastify.get('/', async () => {
    const data = store.getData();
    const sorted = [...data.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    return { ok: true, data: sorted };
  });

  // POST /api/categories
  fastify.post('/', async (request, reply) => {
    const { name, icon, displayMode } = request.body as {
      name: string;
      icon?: string;
      displayMode?: 'compact' | 'detail';
    };
    const data = store.getData();
    const sortOrder = data.categories.length;
    const category = store.addCategory({
      name: name.trim(),
      icon: icon || '',
      displayMode: displayMode === 'compact' || displayMode === 'detail' ? displayMode : 'detail',
      sortOrder,
    });
    return { ok: true, data: category };
  });

  // PUT /api/categories/reorder — must precede /:id (static path vs param).
  fastify.put('/reorder', async (request, reply) => {
    const { items } = request.body as { items: { id: string; sortOrder: number }[] };
    if (!Array.isArray(items)) {
      return reply.status(400).send({ ok: false, error: 'items must be an array', code: 'BAD_REQUEST' });
    }
    store.reorderCategories(items);
    return { ok: true, data: { updated: items.length } };
  });

  // PUT /api/categories/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = request.body as {
      name?: string;
      icon?: string;
      sortOrder?: number;
      displayMode?: 'compact' | 'detail';
    };
    const category = store.updateCategory(id, patch);
    if (!category) {
      return reply.status(404).send({ ok: false, error: 'Category not found', code: 'NOT_FOUND' });
    }
    return { ok: true, data: category };
  });

  // DELETE /api/categories/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { strategy } = request.query as { strategy?: string };
    const deleted = store.deleteCategory(id, strategy === 'cascade' ? 'cascade' : 'move');
    if (!deleted) {
      return reply.status(404).send({ ok: false, error: 'Category not found', code: 'NOT_FOUND' });
    }
    return { ok: true, data: { deleted: true } };
  });
}
