import type { FastifyInstance } from 'fastify';
import { verifyPassword, signToken } from '../services/auth.service.js';
import { loadConfig } from '../config.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const { password } = request.body as { password: string };
    const config = loadConfig();

    if (!config.passwordHash) {
      return reply.status(503).send({
        ok: false,
        error: 'Server not initialized. Run "npm run init" first.',
        code: 'NOT_INITIALIZED',
      });
    }

    const valid = await verifyPassword(password, config.passwordHash);
    if (!valid) {
      return reply.status(401).send({ ok: false, error: 'Invalid password', code: 'INVALID_PASSWORD' });
    }

    const token = signToken(config.jwtSecret, config.jwtExpiry);
    return { ok: true, data: { token, expiresIn: config.jwtExpiry } };
  });

  // POST /api/auth/refresh
  fastify.post('/refresh', async () => {
    const config = loadConfig();
    const token = signToken(config.jwtSecret, config.jwtExpiry);
    return { ok: true, data: { token, expiresIn: config.jwtExpiry } };
  });

  // GET /api/auth/me
  fastify.get('/me', async () => {
    return { ok: true, data: { authenticated: true } };
  });
}
