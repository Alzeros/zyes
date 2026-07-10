import type { FastifyInstance } from 'fastify';
import * as store from '../services/store.service.js';

export async function bookmarkRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/bookmarks
  fastify.get('/', async (request) => {
    const { categoryId } = request.query as { categoryId?: string };
    const data = store.getData();
    let bookmarks = [...data.bookmarks].sort((a, b) => a.sortOrder - b.sortOrder);
    if (categoryId !== undefined) {
      bookmarks = bookmarks.filter((b) => b.categoryId === categoryId);
    }
    return { ok: true, data: bookmarks };
  });

  // POST /api/bookmarks
  fastify.post('/', async (request) => {
    const { categoryId, title, url, description, icon } = request.body as {
      categoryId: string;
      title: string;
      url: string;
      description?: string;
      icon?: string | null;
    };

    // Validate URL
    try {
      new URL(url);
    } catch {
      return { ok: false, error: 'Invalid URL', code: 'INVALID_URL' };
    }

    const data = store.getData();
    const sortOrder = data.bookmarks.filter((b) => b.categoryId === categoryId).length;
    const bookmark = store.addBookmark({
      categoryId,
      title: title.trim(),
      url,
      description: description?.trim() || '',
      icon: icon || null,
      sortOrder,
    });
    return { ok: true, data: bookmark };
  });

  // PUT /api/bookmarks/:id
  fastify.put('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const patch = request.body as {
      categoryId?: string;
      title?: string;
      url?: string;
      description?: string;
      icon?: string | null;
      sortOrder?: number;
    };

    // Validate URL if provided
    if (patch.url) {
      try {
        new URL(patch.url);
      } catch {
        return { ok: false, error: 'Invalid URL', code: 'INVALID_URL' };
      }
    }

    const bookmark = store.updateBookmark(id, patch);
    if (!bookmark) {
      return { ok: false, error: 'Bookmark not found', code: 'NOT_FOUND' };
    }
    return { ok: true, data: bookmark };
  });

  // DELETE /api/bookmarks/:id
  fastify.delete('/:id', async (request) => {
    const { id } = request.params as { id: string };
    const deleted = store.deleteBookmark(id);
    if (!deleted) {
      return { ok: false, error: 'Bookmark not found', code: 'NOT_FOUND' };
    }
    return { ok: true, data: { deleted: true } };
  });
}
