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
    const { categoryId, title, url, description, icon, openTarget, displayMode } = request.body as {
      categoryId: string;
      title: string;
      url: string;
      description?: string;
      icon?: string | null;
      openTarget?: 'new' | 'self';
      displayMode?: 'compact' | 'detail';
    };

    // Validate URL
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
        return { ok: false, error: 'Only http(s) URLs allowed', code: 'INVALID_URL' };
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
      openTarget: openTarget === 'self' ? 'self' : 'new',
      displayMode: displayMode === 'detail' ? 'detail' : 'compact',
      sortOrder,
    });
    return { ok: true, data: bookmark };
  });

  // PUT /api/bookmarks/:id
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const patch = request.body as {
      categoryId?: string;
      title?: string;
      url?: string;
      description?: string;
      icon?: string | null;
      openTarget?: 'new' | 'self';
      displayMode?: 'compact' | 'detail';
      sortOrder?: number;
    };

    // Validate URL if provided
    if (patch.url) {
      try {
        const parsedUrl = new URL(patch.url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:')
          return reply.status(400).send({ ok: false, error: 'Only http(s) URLs allowed', code: 'INVALID_URL' });
      } catch {
        return reply.status(400).send({ ok: false, error: 'Invalid URL', code: 'INVALID_URL' });
      }
    }

    // Coerce displayMode to a valid value; reject unknown enum values rather
    // than silently defaulting, so a bad client doesn't flip a card unexpectedly.
    if (patch.displayMode !== undefined && patch.displayMode !== 'compact' && patch.displayMode !== 'detail') {
      return reply.status(400).send({ ok: false, error: 'Invalid displayMode', code: 'INVALID_MODE' });
    }

    const bookmark = store.updateBookmark(id, patch);
    if (!bookmark) {
      return reply.status(404).send({ ok: false, error: 'Bookmark not found', code: 'NOT_FOUND' });
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

  // PUT /api/bookmarks/reorder — bulk update sortOrder across many bookmarks.
  fastify.put('/reorder', async (request) => {
    const body = request.body as { items?: { id: string; sortOrder: number }[] };
    if (!body?.items || !Array.isArray(body.items)) {
      return { ok: false, error: 'Invalid payload', code: 'INVALID_PAYLOAD' };
    }
    store.reorderBookmarks(body.items);
    return { ok: true, data: { reordered: true } };
  });

  // PUT /api/bookmarks/reassign — bulk set categoryId + sortOrder across many
  // bookmarks. Used for cross-category drag: each entry pins a card to a group.
  fastify.put('/reassign', async (request) => {
    const body = request.body as {
      items?: { id: string; categoryId: string; sortOrder: number }[];
    };
    if (!body?.items || !Array.isArray(body.items)) {
      return { ok: false, error: 'Invalid payload', code: 'INVALID_PAYLOAD' };
    }
    store.reassignBookmarks(body.items);
    return { ok: true, data: { reassigned: body.items.length } };
  });
}
