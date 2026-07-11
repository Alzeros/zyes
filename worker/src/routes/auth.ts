import { Hono } from 'hono';
import type { Env } from '../types';
import { JWT_EXPIRY } from '../types';
import { verifyPassword, signToken } from '../auth';

// Mounted under /api/auth. login + refresh are public (whitelisted in index.ts),
// /me is auth-gated. Mirrors server/routes/auth.routes.ts response shapes.
export function authRoutes(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  app.post('/login', async (c) => {
    const { password } = await c.req.json<{ password: string }>();
    const stored = c.env.ZYES_PASSWORD;
    if (!stored) {
      return c.json(
        { ok: false, error: 'Server not initialized. Set ZYES_PASSWORD variable first.', code: 'NOT_INITIALIZED' },
        503
      );
    }
    const valid = await verifyPassword(password, stored);
    if (!valid) {
      return c.json({ ok: false, error: 'Invalid password', code: 'INVALID_PASSWORD' }, 401);
    }
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
