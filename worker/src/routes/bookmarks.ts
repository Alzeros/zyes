import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Bookmark } from '../../../src/lib/types';
import type { Env } from '../types';
import { dbOf } from '../db';

// Mounted under /api/bookmarks. Mirrors server/routes/bookmark.routes.ts.
export function bookmarkRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // GET /api/bookmarks[?categoryId=]
  app.get('/', async (c) => {
    const db = dbOf(c.env);
    const categoryId = c.req.query('categoryId');
    const bookmarks =
      categoryId !== undefined ? await db.bookmarksByCategory(categoryId) : await db.allBookmarks();
    return c.json({ ok: true, data: bookmarks });
  });

  // POST /api/bookmarks
  app.post('/', async (c) => {
    const body = await c.req.json<{
      categoryId: string;
      title: string;
      url: string;
      description?: string;
      icon?: string | null;
      openTarget?: 'new' | 'self';
      displayMode?: 'compact' | 'detail';
    }>();
    try {
      new URL(body.url);
    } catch {
      return c.json({ ok: false, error: 'Invalid URL', code: 'INVALID_URL' }, 400);
    }
    const db = dbOf(c.env);
    const sortOrder = await db.nextSortOrder(body.categoryId);
    const now = new Date().toISOString();
    const bookmark = await db.insertBookmark(
      {
        categoryId: body.categoryId,
        title: body.title.trim(),
        url: body.url,
        description: body.description?.trim() || '',
        icon: body.icon || null,
        openTarget: body.openTarget === 'self' ? 'self' : 'new',
        displayMode: body.displayMode === 'detail' ? 'detail' : 'compact',
        sortOrder,
        createdAt: now,
        updatedAt: now,
      },
      nanoid(10)
    );
    return c.json({ ok: true, data: bookmark });
  });

  // PUT /api/bookmarks/reorder (static path declared before /:id)
  app.put('/reorder', async (c) => {
    const body = await c.req.json<{ items?: { id: string; sortOrder: number }[] }>();
    if (!body?.items || !Array.isArray(body.items)) {
      return c.json({ ok: false, error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, 400);
    }
    await dbOf(c.env).reorderBookmarks(body.items);
    return c.json({ ok: true, data: { reordered: true } });
  });

  // PUT /api/bookmarks/reassign (static path declared before /:id)
  app.put('/reassign', async (c) => {
    const body = await c.req.json<{ items?: { id: string; categoryId: string; sortOrder: number }[] }>();
    if (!body?.items || !Array.isArray(body.items)) {
      return c.json({ ok: false, error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, 400);
    }
    await dbOf(c.env).reassignBookmarks(body.items);
    return c.json({ ok: true, data: { reassigned: body.items.length } });
  });

  // PUT /api/bookmarks/:id
  app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json<Partial<Bookmark>>();
    if (patch.url) {
      try {
        new URL(patch.url);
      } catch {
        return c.json({ ok: false, error: 'Invalid URL', code: 'INVALID_URL' }, 400);
      }
    }
    // Reject unknown displayMode enum values rather than silently defaulting.
    if (patch.displayMode !== undefined && patch.displayMode !== 'compact' && patch.displayMode !== 'detail') {
      return c.json({ ok: false, error: 'Invalid displayMode', code: 'INVALID_MODE' }, 400);
    }
    const updated = await dbOf(c.env).updateBookmark(id, patch);
    if (!updated) return c.json({ ok: false, error: 'Bookmark not found', code: 'NOT_FOUND' }, 404);
    return c.json({ ok: true, data: updated });
  });

  // DELETE /api/bookmarks/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await dbOf(c.env).deleteBookmark(id);
    if (!deleted) return c.json({ ok: false, error: 'Bookmark not found', code: 'NOT_FOUND' }, 404);
    return c.json({ ok: true, data: { deleted: true } });
  });

  return app;
}
