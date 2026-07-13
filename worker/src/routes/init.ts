import { Hono } from 'hono';
import type { Env } from '../types';
import { ensureSchema, TARGET_SCHEMA_VERSION } from '../migrations';

// Mounted under /api/init.
//
// Schema is now self-healing: the auth gate in index.ts runs `ensureSchema` on
// the module instance's first request, so any deployment — forked or not —
// converges to the schema the code expects without anyone running `wrangler
// d1 migrations apply`. This endpoint is retained as a manual "run it now and
// show me the result" trigger (useful when a deploy just shipped and you want
// to force a heal without waiting for a cold start, or to diagnose why a step
// failed). It calls the SAME ensureSchema, so the result is identical to what
// the gate would produce.
export function initRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/', async (c) => {
    const result = await ensureSchema(c.env);
    return c.json({
      ok: result.ok,
      data: {
        targetVersion: TARGET_SCHEMA_VERSION,
        fromVersion: result.fromVersion,
        toVersion: result.toVersion,
        ran: result.ran,
        steps: result.steps,
      },
    }, result.ok ? 200 : 500);
  });

  // GET check — returns whether the schema has been initialised at all (the
  // `meta` table exists + a schema_version row is present).
  app.get('/', async (c) => {
    try {
      const row = await c.env.DB.prepare(
        `SELECT value FROM meta WHERE key = 'schema_version'`
      ).first<{ value: string }>();
      return c.json({ ok: true, data: { initialized: !!row, schemaVersion: row ? parseInt(row.value, 10) : 0, target: TARGET_SCHEMA_VERSION } });
    } catch {
      return c.json({ ok: true, data: { initialized: false, schemaVersion: 0, target: TARGET_SCHEMA_VERSION } });
    }
  });

  return app;
}
