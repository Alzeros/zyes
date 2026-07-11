import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Category } from '../../../src/lib/types';
import type { Env } from '../types';
import { dbOf } from '../db';

// Mounted under /api/categories. Mirrors server/routes/category.routes.ts.
export function categoryRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // GET /api/categories (sorted by sortOrder)
  app.get('/', async (c) => {
    const categories = await dbOf(c.env).allCategories();
    return c.json({ ok: true, data: categories });
  });

  // POST /api/categories
  app.post('/', async (c) => {
    const body = await c.req.json<{ name: string; icon?: string; displayMode?: 'compact' | 'detail' }>();
    const db = dbOf(c.env);
    // Next sort index = current count (append at end), mirroring the server.
    const existing = await db.allCategories();
    const sortOrder = existing.length;
    const category = await db.insertCategory(
      {
        name: body.name.trim(),
        icon: body.icon || '',
        sortOrder,
        displayMode: body.displayMode === 'compact' || body.displayMode === 'detail' ? body.displayMode : 'detail',
        createdAt: new Date().toISOString(),
      },
      nanoid(10)
    );
    return c.json({ ok: true, data: category });
  });

  // PUT /api/categories/reorder (static path before /:id)
  app.put('/reorder', async (c) => {
    const body = await c.req.json<{ items: { id: string; sortOrder: number }[] }>();
    if (!Array.isArray(body?.items)) {
      return c.json({ ok: false, error: 'items must be an array', code: 'BAD_REQUEST' }, 400);
    }
    await dbOf(c.env).reorderCategories(body.items);
    return c.json({ ok: true, data: { updated: body.items.length } });
  });

  // PUT /api/categories/:id
  app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const patch = await c.req.json<Partial<Category>>();
    const updated = await dbOf(c.env).updateCategory(id, patch);
    if (!updated) return c.json({ ok: false, error: 'Category not found', code: 'NOT_FOUND' }, 404);
    return c.json({ ok: true, data: updated });
  });

  // DELETE /api/categories/:id?strategy=move|cascade
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const strategy = c.req.query('strategy') === 'cascade' ? 'cascade' : 'move';
    const deleted = await dbOf(c.env).deleteCategory(id, strategy);
    if (!deleted) return c.json({ ok: false, error: 'Category not found', code: 'NOT_FOUND' }, 404);
    return c.json({ ok: true, data: { deleted: true } });
  });

  return app;
}
