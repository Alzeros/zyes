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
  fastify.post('/', async (request) => {
    const { name, icon } = request.body as { name: string; icon?: string };
    const data = store.getData();
    const sortOrder = data.categories.length;
    const category = store.addCategory({
      name: name.trim(),
      icon: icon || '',
      sortOrder,
    });
    return { ok: true, data: category };
  });

  // PUT /api/categories/:id
  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const patch = request.body as { name?: string; icon?: string; sortOrder?: number };
    const category = store.updateCategory(id, patch);
    if (!category) {
      return { ok: false, error: 'Category not found', code: 'NOT_FOUND' };
    }
    return { ok: true, data: category };
  });

  // DELETE /api/categories/:id
  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const { strategy } = request.query as { strategy?: string };
    const deleted = store.deleteCategory(id, strategy === 'cascade' ? 'cascade' : 'move');
    if (!deleted) {
      return { ok: false, error: 'Category not found', code: 'NOT_FOUND' };
    }
    return { ok: true, data: { deleted: true } };
  });
}
