import { Hono } from 'hono';
import type { Env } from '../types';
import { JWT_EXPIRY } from '../types';
import { dbOf } from '../db';
import { verifyPassword, signToken, getPasswordHash } from '../auth';

// Mounted under /api/auth. login + refresh are public (whitelisted in index.ts),
// /me is auth-gated. Mirrors server/routes/auth.routes.ts response shapes.
export function authRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/login', async (c) => {
    const { password } = await c.req.json<{ password: string }>();
    const db = dbOf(c.env);
    const hash = await getPasswordHash(db);
    if (!hash) {
      return c.json(
        { ok: false, error: 'Server not initialized. Run set-password first.', code: 'NOT_INITIALIZED' },
        503
      );
    }
    const valid = await verifyPassword(password, hash);
    if (!valid) {
      return c.json({ ok: false, error: 'Invalid password', code: 'INVALID_PASSWORD' }, 401);
    }
    // Save a per-session id in meta so future can correlate if needed; not required.
    const token = await signToken(c.env.JWT_SECRET, JWT_EXPIRY);
    return c.json({ ok: true, data: { token, expiresIn: JWT_EXPIRY } });
  });

  app.post('/refresh', async (c) => {
    // Reached only if auth middleware passed (already verified).
    const token = await signToken(c.env.JWT_SECRET, JWT_EXPIRY);
    return c.json({ ok: true, data: { token, expiresIn: JWT_EXPIRY } });
  });

  app.get('/me', (c) => c.json({ ok: true, data: { authenticated: true } }));

  return app;
}
